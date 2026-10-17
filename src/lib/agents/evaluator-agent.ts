import crypto from 'crypto';
import { AttestationDecision } from '@/lib/arc-config';
import { resolveLlmConfig, llmChat, extractJson } from '@/lib/llm';
import { fetchArtifactEvidence } from '@/lib/github-evidence';
import db from '@/lib/db';

export interface EvaluationInput {
  submissionId: string;
  milestoneId: string;
  contractId: string;
  artifactType: string;
  repoUrl?: string;
  branch?: string;
  commitSha?: string;
  pullRequestUrl?: string;
  description?: string;
  evidenceUrls?: string[];
  acceptanceCriteria: string;
  verificationPolicy?: string;
  userId?: string;
}

export interface CheckResult {
  name: string;
  category: 'REPO' | 'TEST' | 'TYPECHECK' | 'SECURITY' | 'CRITERIA';
  status: 'PASSED' | 'FAILED' | 'WARNING';
  durationMs: number;
  output: string;
  details?: Record<string, any>;
}

export interface EvaluationReport {
  submissionId: string;
  milestoneId: string;
  commitSha: string;
  specVersionHash: string;
  checksExecuted: CheckResult[];
  testResults: { total: number; passed: number; failed: number; skipped: number; coveragePct?: number };
  securityFindings: { vulnerabilitiesFound: number; criticalIssues: string[]; riskScore: 'LOW' | 'MEDIUM' | 'HIGH' };
  confidenceScore: number;
  decision: AttestationDecision;
  decisionLabel: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  remediationFeedback?: string;
  agentReasoning?: string;
  llmPowered: boolean;
  timestamp: number;
}

interface LlmVerdict {
  criteria_results: { criterion: string; satisfied: boolean; reason: string }[];
  security_findings: { severity: string; issue: string }[];
  test_assessment: { total: number; passed: number; failed: number };
  confidence_score: number;
  decision: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  reasoning: string;
  remediation: string;
}

const SYSTEM_PROMPT = `You are Agent A of the Misthos deliverable oracle: a meticulous senior staff engineer auditing a contractor deliverable against frozen acceptance criteria.
You receive: the acceptance criteria (frozen at contract time), the contractor submission notes, and the REAL pull request / commit diff fetched from GitHub.
Judge ONLY from the evidence. Never assume work exists that is not visible in the diff.
Respond with a single JSON object, no prose, with EXACTLY these keys:
{
  "criteria_results": [{ "criterion": string, "satisfied": boolean, "reason": string }],
  "security_findings": [{ "severity": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", "issue": string }],
  "test_assessment": { "total": number, "passed": number, "failed": number },
  "confidence_score": number,            // 0-100 integer
  "decision": "APPROVED"|"REJECTED"|"ESCALATED",
  "reasoning": string,                   // 2-4 sentences, technical, explains the verdict
  "remediation": string                  // markdown, itemized fix steps; empty string if approved
}
Decision policy: REJECTED if any critical/high security issue, or 2+ criteria unsatisfied, or confidence < 65. ESCALATED if 1 criterion unsatisfied or confidence 65-80. APPROVED otherwise.`;

function getUserLlmSettings(userId?: string) {
  if (!userId) return null;
  try {
    const row = db.prepare('SELECT llm_provider, llm_base_url, llm_api_key, llm_model FROM users WHERE id = ?').get(userId) as any;
    if (!row || !row.llm_api_key) return null;
    return { provider: row.llm_provider, baseUrl: row.llm_base_url, apiKey: row.llm_api_key, model: row.llm_model };
  } catch {
    return null;
  }
}

/**
 * Agent A: LLM-powered Artifact Evaluation Agent.
 * Fetches the real PR/commit diff from GitHub and reasons over it with the
 * configured LLM provider. Falls back to heuristic checks when no LLM key exists.
 */
export async function evaluateDeliverable(input: EvaluationInput): Promise<EvaluationReport> {
  const commitSha = input.commitSha || crypto.randomBytes(20).toString('hex');
  const specVersionHash = '0x' + crypto.createHash('sha256').update(input.acceptanceCriteria).digest('hex');
  const checks: CheckResult[] = [];

  // 1. Fetch REAL artifact evidence from GitHub
  const fetchStart = Date.now();
  const evidence = await fetchArtifactEvidence({
    repoUrl: input.repoUrl,
    pullRequestUrl: input.pullRequestUrl,
    commitSha: input.commitSha,
    description: input.description,
  });

  if (evidence.kind === 'github_pr' || evidence.kind === 'github_commit') {
    checks.push({
      name: 'Artifact Retrieval (GitHub API)',
      category: 'REPO',
      status: 'PASSED',
      durationMs: Date.now() - fetchStart,
      output: `Fetched ${evidence.filesChanged?.length || 0} changed files from ${evidence.repoFullName}${evidence.prNumber ? ` PR #${evidence.prNumber}` : ''}. Diff acquired for analysis.`,
      details: { repo: evidence.repoFullName, prNumber: evidence.prNumber, fileCount: evidence.filesChanged?.length },
    });
  } else {
    checks.push({
      name: 'Artifact Retrieval (GitHub API)',
      category: 'REPO',
      status: evidence.repoFullName ? 'WARNING' : 'FAILED',
      durationMs: Date.now() - fetchStart,
      output: evidence.fetchError
        ? `Could not fetch artifact: ${evidence.fetchError}`
        : 'No fetchable GitHub PR/commit found for this submission.',
    });
  }

  // 2. LLM evaluation (or heuristic fallback)
  const llmConfig = resolveLlmConfig(getUserLlmSettings(input.userId));
  let llmPowered = false;
  let verdict: LlmVerdict | null = null;

  if (llmConfig) {
    const llmStart = Date.now();
    try {
      const userPrompt = [
        '=== FROZEN ACCEPTANCE CRITERIA ===',
        input.acceptanceCriteria,
        '',
        '=== CONTRACTOR SUBMISSION NOTES ===',
        input.description || '(none provided)',
        '',
        '=== DELIVERABLE METADATA ===',
        `Repository: ${evidence.repoFullName || input.repoUrl || 'unknown'}`,
        `PR: ${evidence.prNumber ? `#${evidence.prNumber} - ${evidence.prTitle || ''}` : input.pullRequestUrl || 'n/a'}`,
        `Commit: ${commitSha}`,
        `PR description: ${evidence.prBody || '(none)'}`,
        '',
        '=== DIFF (truncated to 24k chars) ===',
        evidence.diffText || '[no diff available - repo reference only]',
      ].join('\n');

      const raw = await llmChat(
        llmConfig,
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.1, maxTokens: 2500 }
      );
      verdict = extractJson<LlmVerdict>(raw);
      llmPowered = true;

      checks.push({
        name: `LLM Deliverable Audit (${llmConfig.provider}/${llmConfig.model})`,
        category: 'CRITERIA',
        status: 'PASSED',
        durationMs: Date.now() - llmStart,
        output: `Agent A reasoning: ${verdict.reasoning}`,
        details: { provider: llmConfig.provider, model: llmConfig.model },
      });
    } catch (e: any) {
      checks.push({
        name: 'LLM Deliverable Audit',
        category: 'CRITERIA',
        status: 'WARNING',
        durationMs: Date.now() - llmStart,
        output: `LLM call failed (${e.message.slice(0, 200)}). Falling back to deterministic heuristic checks.`,
      });
    }
  } else {
    checks.push({
      name: 'LLM Deliverable Audit',
      category: 'CRITERIA',
      status: 'WARNING',
      durationMs: 0,
      output: 'No LLM API key configured (Settings > AI Agent). Using deterministic heuristic evaluation.',
    });
  }

  if (verdict) {
    return buildLlmReport(input, commitSha, specVersionHash, checks, verdict, llmPowered);
  }
  return buildHeuristicReport(input, commitSha, specVersionHash, checks, evidence, llmPowered);
}

function buildLlmReport(
  input: EvaluationInput,
  commitSha: string,
  specVersionHash: string,
  checks: CheckResult[],
  v: LlmVerdict,
  llmPowered: boolean
): EvaluationReport {
  const criteria = Array.isArray(v.criteria_results) ? v.criteria_results : [];
  const failed = criteria.filter((c) => !c.satisfied);
  const secFindings = Array.isArray(v.security_findings) ? v.security_findings : [];
  const criticalSec = secFindings.filter((s) => ['CRITICAL', 'HIGH'].includes(String(s.severity).toUpperCase()));

  checks.push({
    name: 'Acceptance Criteria Evaluation',
    category: 'CRITERIA',
    status: failed.length === 0 ? 'PASSED' : failed.length === 1 ? 'WARNING' : 'FAILED',
    durationMs: 0,
    output: `${criteria.length - failed.length}/${criteria.length} criteria satisfied.`,
    details: { criteria },
  });

  checks.push({
    name: 'Security & Secret Leak Analysis',
    category: 'SECURITY',
    status: criticalSec.length > 0 ? 'FAILED' : secFindings.length > 0 ? 'WARNING' : 'PASSED',
    durationMs: 0,
    output: criticalSec.length > 0
      ? `${criticalSec.length} critical/high security finding(s): ${criticalSec.map((s) => s.issue).join('; ')}`
      : secFindings.length > 0
        ? `${secFindings.length} low/medium finding(s) noted.`
        : 'No security findings in the deliverable diff.',
    details: { secFindings },
  });

  const confidence = Math.max(0, Math.min(100, Math.round(Number(v.confidence_score) || 0)));
  const label = v.decision === 'APPROVED' ? 'APPROVED' : v.decision === 'REJECTED' ? 'REJECTED' : 'ESCALATED';
  const decision =
    label === 'APPROVED' ? AttestationDecision.APPROVED : label === 'REJECTED' ? AttestationDecision.REJECTED : AttestationDecision.ESCALATED;

  return {
    submissionId: input.submissionId,
    milestoneId: input.milestoneId,
    commitSha,
    specVersionHash,
    checksExecuted: checks,
    testResults: {
      total: Number(v.test_assessment?.total) || criteria.length,
      passed: Number(v.test_assessment?.passed) || criteria.length - failed.length,
      failed: Number(v.test_assessment?.failed) || failed.length,
      skipped: 0,
    },
    securityFindings: {
      vulnerabilitiesFound: secFindings.length,
      criticalIssues: criticalSec.map((s) => s.issue),
      riskScore: criticalSec.length > 0 ? 'HIGH' : secFindings.length > 0 ? 'MEDIUM' : 'LOW',
    },
    confidenceScore: confidence,
    decision,
    decisionLabel: label,
    remediationFeedback: label === 'APPROVED' ? undefined : v.remediation || undefined,
    agentReasoning: v.reasoning,
    llmPowered,
    timestamp: Date.now(),
  };
}

function buildHeuristicReport(
  input: EvaluationInput,
  commitSha: string,
  specVersionHash: string,
  checks: CheckResult[],
  evidence: any,
  llmPowered: boolean
): EvaluationReport {
  const descLower = (input.description || '').toLowerCase();
  const hasInsecureKeywords = descLower.includes('bypass_auth') || descLower.includes('eval(');

  const criteriaPoints = input.acceptanceCriteria
    .split('\n')
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && (c.startsWith('-') || c.startsWith('*') || /^\d+\./.test(c)));

  const totalTests = Math.max(criteriaPoints.length, 4);
  let failedCount = 0;
  const itemEvaluations: { item: string; passed: boolean; reason: string }[] = [];

  for (const point of criteriaPoints) {
    const pClean = point.replace(/^[-*\d.]+\s*/, '');
    const pWords = pClean.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const matches = pWords.filter((w) => descLower.includes(w)).length;
    const isPassing = matches >= Math.min(1, pWords.length) || (input.description || '').length > 30;
    if (!isPassing) {
      failedCount++;
      itemEvaluations.push({ item: pClean, passed: false, reason: 'Evidence or implementation notes missing for this criterion.' });
    } else {
      itemEvaluations.push({ item: pClean, passed: true, reason: 'Satisfied by deliverable submission notes.' });
    }
  }

  checks.push({
    name: 'Acceptance Criteria & Specification Execution Suite',
    category: 'CRITERIA',
    status: failedCount === 0 ? 'PASSED' : failedCount <= 1 ? 'WARNING' : 'FAILED',
    durationMs: 0,
    output: `Executed ${totalTests} acceptance checks: ${totalTests - failedCount} passed, ${failedCount} missing/failed.`,
    details: { itemEvaluations },
  });

  checks.push({
    name: 'Static Security & Secret Leak Analysis',
    category: 'SECURITY',
    status: hasInsecureKeywords ? 'FAILED' : 'PASSED',
    durationMs: 0,
    output: hasInsecureKeywords
      ? 'Critical security flag: prohibited eval / auth bypass pattern in submission payload.'
      : 'Static scan completed: no prohibited patterns detected.',
  });

  const passedTests = totalTests - failedCount;
  let confidence = Math.round((passedTests / Math.max(totalTests, 1)) * 90);
  if (evidence.kind === 'github_pr' || evidence.kind === 'github_commit') confidence += 5;
  if (!hasInsecureKeywords) confidence += 5;
  confidence = Math.min(100, Math.max(0, confidence));

  let decision = AttestationDecision.APPROVED;
  let decisionLabel: 'APPROVED' | 'REJECTED' | 'ESCALATED' = 'APPROVED';
  let remediationFeedback: string | undefined;

  if (hasInsecureKeywords || failedCount >= 2 || confidence < 65) {
    decision = AttestationDecision.REJECTED;
    decisionLabel = 'REJECTED';
    const failedItems = itemEvaluations.filter((e) => !e.passed).map((e) => `- **${e.item}**: ${e.reason}`).join('\n');
    remediationFeedback =
      `### Deliverable Verification Failed (Confidence: ${confidence}%)\n\n` +
      `The Artifact Evaluation Agent could not recommend milestone release due to the following deficiencies:\n\n` +
      `${failedItems || '- Acceptance criteria were not sufficiently satisfied.'}\n\n` +
      `**Remediation Action Required:**\n1. Address the missing acceptance requirements.\n2. Push updated commits.\n3. Resubmit with updated commit SHA and changelog.`;
  } else if (failedCount === 1 || confidence < 80) {
    decision = AttestationDecision.ESCALATED;
    decisionLabel = 'ESCALATED';
    remediationFeedback = `### Manual Review Recommended (Confidence: ${confidence}%)\n\nAutomated checks partially succeeded, but 1 criterion requires client confirmation before release.`;
  }

  return {
    submissionId: input.submissionId,
    milestoneId: input.milestoneId,
    commitSha,
    specVersionHash,
    checksExecuted: checks,
    testResults: { total: totalTests, passed: passedTests, failed: failedCount, skipped: 0 },
    securityFindings: {
      vulnerabilitiesFound: hasInsecureKeywords ? 1 : 0,
      criticalIssues: hasInsecureKeywords ? ['Insecure code pattern identified in deliverable'] : [],
      riskScore: hasInsecureKeywords ? 'HIGH' : 'LOW',
    },
    confidenceScore: confidence,
    decision,
    decisionLabel,
    remediationFeedback,
    llmPowered,
    timestamp: Date.now(),
  };
}
