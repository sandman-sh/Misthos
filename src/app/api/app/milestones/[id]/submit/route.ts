import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
import { evaluateDeliverable } from '@/lib/agents/evaluator-agent';
import { executeTreasuryReview } from '@/lib/agents/treasury-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      artifactType,
      repoUrl,
      branch,
      commitSha,
      pullRequestUrl,
      description,
      evidenceUrls,
    } = body;

    const milestone = db.prepare(`
      SELECT m.*, c.contractor_id, c.contractor_address, c.client_id,
        c.onchain_escrow_id, c.escrow_contract_address
      FROM milestones m
      JOIN contracts c ON m.contract_id = c.id
      WHERE m.id = ?
    `).get(id) as any;

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Only the assigned contractor may submit deliverables for this milestone.
    const isContractor =
      milestone.contractor_id === user.id ||
      (user.wallet_address &&
        milestone.contractor_address &&
        milestone.contractor_address.toLowerCase() === user.wallet_address.toLowerCase());

    if (!isContractor) {
      return NextResponse.json(
        { error: 'Only the assigned contractor can submit a deliverable for this milestone.' },
        { status: 403 }
      );
    }

    if (milestone.status === 'PAID') {
      return NextResponse.json({ error: 'Milestone is already settled and paid.' }, { status: 400 });
    }

    if (milestone.status === 'VERIFIED') {
      return NextResponse.json({ error: 'Milestone deliverable is already verified and awaiting settlement.' }, { status: 400 });
    }

    const attemptCount = (db.prepare(
      'SELECT COUNT(*) as c FROM submissions WHERE milestone_id = ?'
    ).get(id) as any)?.c || 0;

    if (milestone.allow_resubmission === 0 && attemptCount > 0) {
      return NextResponse.json(
        { error: 'The creator has not allowed another submission for this milestone.' },
        { status: 429 }
      );
    }

    const submissionId = crypto.randomUUID();
    const now = Date.now();
    const attemptNumber = attemptCount + 1;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO submissions (
          id, milestone_id, contractor_id, artifact_type,
          repo_url, branch, commit_sha, pull_request_url,
          description, evidence_urls, status, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        submissionId,
        id,
        user.id,
        artifactType || 'GITHUB_PR',
        repoUrl || '',
        branch || 'main',
        commitSha || '',
        pullRequestUrl || '',
        description || '',
        evidenceUrls ? JSON.stringify(evidenceUrls) : null,
        'SUBMITTED',
        now
      );

      db.prepare('UPDATE milestones SET status = ?, updated_at = ? WHERE id = ?').run('IN_REVIEW', now, id);
      db.prepare('UPDATE contracts SET status = ?, updated_at = ? WHERE id = ?').run('VERIFICATION_PENDING', now, milestone.contract_id);

      db.prepare(`
        INSERT INTO audit_events (id, entity_type, entity_id, actor_id, action, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(), 'MILESTONE', id, user.id, 'SUBMIT_DELIVERABLE',
        JSON.stringify({ submissionId, repoUrl, commitSha, pullRequestUrl }), now
      );
    })();

    // AUTONOMOUS: the oracle agent evaluates immediately on submission.
    // No human click required - Agent A evaluates, Agent B enforces invariants and signs.
    let verification = null;
    try {
      const evaluationReport = await evaluateDeliverable({
        submissionId,
        milestoneId: id,
        contractId: milestone.contract_id,
        artifactType: artifactType || 'GITHUB_PR',
        repoUrl,
        branch,
        commitSha,
        pullRequestUrl,
        description,
        acceptanceCriteria: milestone.acceptance_criteria,
        verificationPolicy: milestone.verification_policy,
        userId: user.id,
      });

      const treasuryReview = await executeTreasuryReview({
        escrowId: milestone.onchain_escrow_id,
        milestoneId: milestone.order_index,
        contractId: milestone.contract_id,
        milestoneDbId: id,
        evaluationReport,
        agreedMilestoneAmount: milestone.amount,
        escrowContractAddress: milestone.escrow_contract_address,
      });

      const reportId = crypto.randomUUID();
      const reportTime = Date.now();
      const newMilestoneStatus = treasuryReview.approved ? 'VERIFIED' : 'REJECTED';

      db.transaction(() => {
        db.prepare(`
          INSERT INTO verification_reports (
            id, submission_id, milestone_id, commit_sha, spec_version_hash,
            checks_executed, test_results, failed_checks, error_logs, security_findings,
            confidence_score, decision, remediation_feedback, oracle_signature,
            attestation_nonce, attestation_payload, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          reportId, submissionId, id, evaluationReport.commitSha, evaluationReport.specVersionHash,
          JSON.stringify(evaluationReport.checksExecuted), JSON.stringify(evaluationReport.testResults),
          JSON.stringify(evaluationReport.checksExecuted.filter(function(c){ return c.status === 'FAILED'; })), null,
          JSON.stringify(evaluationReport.securityFindings), evaluationReport.confidenceScore,
          evaluationReport.decisionLabel, evaluationReport.remediationFeedback || null,
          treasuryReview.attestation ? treasuryReview.attestation.signature : null,
          treasuryReview.attestation ? treasuryReview.attestation.attestationPayload.nonce : null,
          treasuryReview.attestation ? JSON.stringify(treasuryReview.attestation.attestationPayload) : null,
          reportTime
        );
        db.prepare("UPDATE submissions SET status = 'EVALUATED' WHERE id = ?").run(submissionId);
        db.prepare('UPDATE milestones SET status = ?, updated_at = ? WHERE id = ?').run(newMilestoneStatus, reportTime, id);
        db.prepare(`
          INSERT INTO audit_events (id, entity_type, entity_id, actor_id, action, metadata, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(), 'VERIFICATION', reportId, user.id, 'AUTO_VERIFICATION_ON_SUBMIT',
          JSON.stringify({ confidenceScore: evaluationReport.confidenceScore, verdict: evaluationReport.decisionLabel, approved: treasuryReview.approved, llmPowered: evaluationReport.llmPowered }),
          reportTime
        );
      })();

      verification = {
        verdict: evaluationReport.decisionLabel,
        confidence: evaluationReport.confidenceScore,
        llmPowered: evaluationReport.llmPowered,
        treasuryApproved: treasuryReview.approved,
        attestationSigned: Boolean(treasuryReview.attestation),
        remediation: evaluationReport.remediationFeedback || null,
        milestoneStatus: newMilestoneStatus,
      };
    } catch (verifyErr: any) {
      console.error('Auto-verification error (submission still recorded):', verifyErr);
      verification = { error: verifyErr.message || 'verification failed', milestoneStatus: 'IN_REVIEW' };
    }

    return NextResponse.json({
      success: true,
      submissionId,
      attemptNumber,
      status: verification && verification.milestoneStatus ? verification.milestoneStatus : 'IN_REVIEW',
      autoVerification: verification,
    });
  } catch (error: any) {
    console.error('Submission error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

