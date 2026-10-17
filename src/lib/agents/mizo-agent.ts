// MIZO - the Misthos autonomous agent. Real tool execution against the
// Misthos database and oracle pipeline, driven by the configured LLM.

import crypto from 'crypto';
import db from '@/lib/db';
import { formatUSDC, getExplorerTxUrl } from '@/lib/arc-config';
import { evaluateDeliverable } from '@/lib/agents/evaluator-agent';
import { executeTreasuryReview } from '@/lib/agents/treasury-agent';
import { resolveLlmConfig, llmChat, extractJson } from '@/lib/llm';

export interface MizoAction {
  type: string;
  summary: string;
  data?: Record<string, any>;
}

export interface MizoResult {
  reply: string;
  actions: MizoAction[];
  llmPowered: boolean;
}

const TOOL_CATALOG = `
AVAILABLE TOOLS (respond with JSON {"tool": name, "args": {...}, "reply": string}):

1. get_portfolio {} - List the user's contracts with status, funded/paid USDC, milestone progress.
2. get_contract {"contract_id": string} - Full detail of one contract: milestones, submissions, reports.
3. list_pending_verifications {} - Milestones with submitted deliverables awaiting oracle verification.
4. run_verification {"milestone_id": string} - Execute the dual-agent oracle pipeline on the latest submission of a milestone. Returns verdict, confidence, and whether a signed EIP-712 attestation was issued.
5. explain_verdict {"milestone_id": string} - Explain the latest verification report for a milestone in plain terms, including remediation.
6. get_transactions {} - Recent settlement/funding transactions with Arcscan links.
7. answer {} - Pure conversational answer about Misthos, Arc, escrow, or the user's data (use "reply" only).

RULES:
- Always return valid JSON only: {"tool": "...", "args": {...}, "reply": "..."}
- "reply" is shown to the user. Be concise, professional, specific. Use exact numbers from tool results.
- If the user asks to verify/check/review a deliverable, use run_verification.
- If unsure which milestone/contract, call list_pending_verifications or get_portfolio first.
- Never invent transaction hashes or verdicts. Only report what tools return.
`;

function toolGetPortfolio(userId: string): any {
  const contracts = db.prepare(`
    SELECT c.id, c.title, c.status, c.total_amount, c.funded_amount,
      (SELECT COUNT(*) FROM milestones m WHERE m.contract_id = c.id) as milestone_count,
      (SELECT COUNT(*) FROM milestones m WHERE m.contract_id = c.id AND m.status = 'PAID') as paid_count
    FROM contracts c
    WHERE c.client_id = ? OR c.contractor_id = ?
    ORDER BY c.created_at DESC LIMIT 20
  `).all(userId, userId) as any[];

  return contracts.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    totalUSDC: formatUSDC(c.total_amount),
    fundedUSDC: formatUSDC(c.funded_amount),
    milestones: `${c.paid_count}/${c.milestone_count} paid`,
  }));
}

function toolGetContract(userId: string, contractId: string): any {
  const c = db.prepare(`
    SELECT * FROM contracts WHERE id = ? AND (client_id = ? OR contractor_id = ?)
  `).get(contractId, userId, userId) as any;
  if (!c) return { error: 'Contract not found or access denied.' };

  const milestones = db.prepare(`
    SELECT id, order_index, title, status, amount, paid_amount FROM milestones
    WHERE contract_id = ? ORDER BY order_index ASC
  `).all(contractId) as any[];

  return {
    title: c.title,
    status: c.status,
    totalUSDC: formatUSDC(c.total_amount),
    fundedUSDC: formatUSDC(c.funded_amount),
    escrowOnChain: Boolean(c.escrow_contract_address),
    milestones: milestones.map((m) => ({
      id: m.id,
      num: m.order_index + 1,
      title: m.title,
      status: m.status,
      amountUSDC: formatUSDC(m.amount),
      paidUSDC: formatUSDC(m.paid_amount),
    })),
  };
}

function toolListPendingVerifications(userId: string): any {
  const rows = db.prepare(`
    SELECT m.id as milestone_id, m.title, m.amount, m.status, c.title as contract_title,
      s.id as submission_id, s.pull_request_url, s.submitted_at
    FROM milestones m
    JOIN contracts c ON m.contract_id = c.id
    JOIN submissions s ON s.milestone_id = m.id
    WHERE (c.client_id = ? OR c.contractor_id = ?)
      AND m.status IN ('IN_REVIEW', 'REJECTED', 'ESCALATED')
    ORDER BY s.submitted_at DESC LIMIT 10
  `).all(userId, userId) as any[];

  return rows.map((r) => ({
    milestoneId: r.milestone_id,
    title: r.title,
    contract: r.contract_title,
    amountUSDC: formatUSDC(r.amount),
    status: r.status,
    pr: r.pull_request_url,
  }));
}

async function toolRunVerification(userId: string, milestoneId: string): Promise<any> {
  const milestone = db.prepare(`
    SELECT m.*, c.title as contract_title, c.client_id, c.contractor_id,
      c.client_address, c.contractor_address, c.onchain_escrow_id, c.escrow_contract_address
    FROM milestones m JOIN contracts c ON m.contract_id = c.id
    WHERE m.id = ? AND (c.client_id = ? OR c.contractor_id = ?)
  `).get(milestoneId, userId, userId) as any;

  if (!milestone) return { error: 'Milestone not found or access denied.' };

  const submission = db.prepare(`
    SELECT * FROM submissions WHERE milestone_id = ? ORDER BY submitted_at DESC LIMIT 1
  `).get(milestoneId) as any;
  if (!submission) return { error: 'No deliverable submission exists for this milestone yet.' };

  const evaluationReport = await evaluateDeliverable({
    submissionId: submission.id,
    milestoneId,
    contractId: milestone.contract_id,
    artifactType: submission.artifact_type,
    repoUrl: submission.repo_url,
    branch: submission.branch,
    commitSha: submission.commit_sha,
    pullRequestUrl: submission.pull_request_url,
    description: submission.description,
    acceptanceCriteria: milestone.acceptance_criteria,
    verificationPolicy: milestone.verification_policy,
    userId,
  });

  const treasuryReview = await executeTreasuryReview({
    escrowId: milestone.onchain_escrow_id,
    milestoneId: milestone.order_index,
    contractId: milestone.contract_id,
    milestoneDbId: milestoneId,
    evaluationReport,
    agreedMilestoneAmount: milestone.amount,
    escrowContractAddress: milestone.escrow_contract_address,
  });

  const reportId = crypto.randomUUID();
  const now = Date.now();
  const newStatus = treasuryReview.approved ? 'VERIFIED' : 'REJECTED';

  db.transaction(() => {
    db.prepare(`
      INSERT INTO verification_reports (
        id, submission_id, milestone_id, commit_sha, spec_version_hash,
        checks_executed, test_results, failed_checks, error_logs, security_findings,
        confidence_score, decision, remediation_feedback, oracle_signature,
        attestation_nonce, attestation_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId, submission.id, milestoneId, evaluationReport.commitSha, evaluationReport.specVersionHash,
      JSON.stringify(evaluationReport.checksExecuted), JSON.stringify(evaluationReport.testResults),
      JSON.stringify(evaluationReport.checksExecuted.filter((c) => c.status === 'FAILED')), null,
      JSON.stringify(evaluationReport.securityFindings), evaluationReport.confidenceScore,
      evaluationReport.decisionLabel, evaluationReport.remediationFeedback || null,
      treasuryReview.attestation?.signature || null,
      treasuryReview.attestation?.attestationPayload.nonce || null,
      treasuryReview.attestation ? JSON.stringify(treasuryReview.attestation.attestationPayload) : null,
      now
    );
    db.prepare("UPDATE submissions SET status = 'EVALUATED' WHERE id = ?").run(submission.id);
    db.prepare('UPDATE milestones SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, milestoneId);
    db.prepare(`
      INSERT INTO audit_events (id, entity_type, entity_id, actor_id, action, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), 'VERIFICATION', reportId, userId, 'MIZO_RUN_VERIFICATION',
      JSON.stringify({ confidenceScore: evaluationReport.confidenceScore, verdict: evaluationReport.decisionLabel, llmPowered: evaluationReport.llmPowered }), now);
  })();

  return {
    verdict: evaluationReport.decisionLabel,
    confidence: evaluationReport.confidenceScore,
    llmPowered: evaluationReport.llmPowered,
    reasoning: evaluationReport.agentReasoning || null,
    treasuryApproved: treasuryReview.approved,
    attestationSigned: Boolean(treasuryReview.attestation),
    remediation: evaluationReport.remediationFeedback || null,
    milestoneStatus: newStatus,
  };
}

function toolExplainVerdict(userId: string, milestoneId: string): any {
  const report = db.prepare(`
    SELECT r.* FROM verification_reports r
    JOIN milestones m ON r.milestone_id = m.id
    JOIN contracts c ON m.contract_id = c.id
    WHERE r.milestone_id = ? AND (c.client_id = ? OR c.contractor_id = ?)
    ORDER BY r.created_at DESC LIMIT 1
  `).get(milestoneId, userId, userId) as any;
  if (!report) return { error: 'No verification report exists for this milestone.' };

  return {
    decision: report.decision,
    confidence: report.confidence_score,
    remediation: report.remediation_feedback,
    attestationSigned: Boolean(report.oracle_signature),
    checks: report.checks_executed ? JSON.parse(report.checks_executed).map((c: any) => `${c.name}: ${c.status}`) : [],
  };
}

function toolGetTransactions(userId: string): any {
  const rows = db.prepare(`
    SELECT t.tx_type, t.amount, t.tx_hash, t.status, t.created_at, c.title as contract_title
    FROM transactions t LEFT JOIN contracts c ON t.contract_id = c.id
    WHERE c.client_id = ? OR c.contractor_id = ?
    ORDER BY t.created_at DESC LIMIT 10
  `).all(userId, userId) as any[];

  return rows.map((t) => ({
    type: t.tx_type,
    amountUSDC: formatUSDC(t.amount),
    contract: t.contract_title,
    status: t.status,
    explorer: getExplorerTxUrl(t.tx_hash),
  }));
}

async function executeTool(userId: string, tool: string, args: any): Promise<{ result: any; action: MizoAction }> {
  switch (tool) {
    case 'get_portfolio': {
      const r = toolGetPortfolio(userId);
      return { result: r, action: { type: 'portfolio', summary: `Fetched ${r.length} contracts`, data: { contracts: r } } };
    }
    case 'get_contract': {
      const r = toolGetContract(userId, args.contract_id || '');
      return { result: r, action: { type: 'contract', summary: `Loaded contract detail`, data: r } };
    }
    case 'list_pending_verifications': {
      const r = toolListPendingVerifications(userId);
      return { result: r, action: { type: 'pending', summary: `${r.length} deliverable(s) awaiting verification`, data: { items: r } } };
    }
    case 'run_verification': {
      const r = await toolRunVerification(userId, args.milestone_id || '');
      return {
        result: r,
        action: {
          type: 'verification',
          summary: r.error ? 'Verification failed' : `Verdict: ${r.verdict} (${r.confidence}%)`,
          data: r,
        },
      };
    }
    case 'explain_verdict': {
      const r = toolExplainVerdict(userId, args.milestone_id || '');
      return { result: r, action: { type: 'verdict', summary: `Latest report: ${r.decision || 'none'}`, data: r } };
    }
    case 'get_transactions': {
      const r = toolGetTransactions(userId);
      return { result: r, action: { type: 'transactions', summary: `${r.length} recent transactions`, data: { transactions: r } } };
    }
    default:
      return { result: { note: 'conversational' }, action: { type: 'answer', summary: 'Answered directly' } };
  }
}

function getUserLlm(userId: string) {
  try {
    const row = db.prepare('SELECT llm_provider, llm_base_url, llm_api_key, llm_model FROM users WHERE id = ?').get(userId) as any;
    if (!row || !row.llm_api_key) return null;
    return { provider: row.llm_provider, baseUrl: row.llm_base_url, apiKey: row.llm_api_key, model: row.llm_model };
  } catch {
    return null;
  }
}

export async function mizoAgentTurn(userId: string, userMessage: string, history: { role: string; content: string }[] = []): Promise<MizoResult> {
  const config = resolveLlmConfig(getUserLlm(userId));

  if (!config) {
    return {
      reply: 'I need an LLM connection to reason and act. Open Settings > AI Agent, add your provider key (OpenRouter works out of the box with a free model), then come back. I can then verify deliverables, inspect your escrows, and run the oracle pipeline for you.',
      actions: [],
      llmPowered: false,
    };
  }

  const systemPrompt = `You are MIZO, the autonomous agent inside Misthos - a verifiable milestone escrow system on Circle's Arc L1 (chain 5042002, native 6-decimal USDC).
You act on behalf of the signed-in user: you can inspect their escrow portfolio, run the dual-agent oracle verification on contractor deliverables, explain verdicts, and report settlement transactions.
${TOOL_CATALOG}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-8).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: userMessage },
  ];

  // First LLM turn: decide tool
  let toolCall: any;
  try {
    const raw = await llmChat(config, messages, { temperature: 0.15, maxTokens: 900 });
    toolCall = extractJson(raw);
  } catch (e: any) {
    return {
      reply: `My reasoning engine failed to respond (${e.message.slice(0, 200)}). Check your AI Agent settings or provider quota.`,
      actions: [],
      llmPowered: false,
    };
  }

  const tool = typeof toolCall?.tool === 'string' ? toolCall.tool : 'answer';
  const args = toolCall?.args && typeof toolCall.args === 'object' ? toolCall.args : {};
  const actions: MizoAction[] = [];

  // Conversational answer: no tool execution needed
  if (tool === 'answer') {
    return { reply: String(toolCall.reply || 'Understood.'), actions, llmPowered: true };
  }

  const { result, action } = await executeTool(userId, tool, args);
  actions.push(action);

  // Second LLM turn: narrate tool result to user
  try {
    const narration = await llmChat(config, [
      { role: 'system', content: `You are MIZO. A tool just returned this JSON result:\n${JSON.stringify(result).slice(0, 6000)}\nSummarize it for the user in 1-4 concise sentences. Use exact numbers, statuses, and verdicts. If the result has an "error" field, explain it clearly and suggest the next step. Do not output JSON.` },
      { role: 'user', content: userMessage },
    ], { temperature: 0.3, maxTokens: 600 });
    return { reply: narration.trim(), actions, llmPowered: true };
  } catch {
    return {
      reply: String(toolCall.reply || action.summary),
      actions,
      llmPowered: true,
    };
  }
}
