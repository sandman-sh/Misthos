import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
import { evaluateDeliverable } from '@/lib/agents/evaluator-agent';
import { executeTreasuryReview } from '@/lib/agents/treasury-agent';

export const dynamic = 'force-dynamic';

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

    const milestone = db.prepare(`
      SELECT m.*, c.title as contract_title, c.client_id, c.contractor_id,
        c.client_address, c.contractor_address, c.onchain_escrow_id,
        c.escrow_contract_address
      FROM milestones m
      JOIN contracts c ON m.contract_id = c.id
      WHERE m.id = ?
    `).get(id) as any;

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Only the client (payer) may trigger the oracle verification that gates payout.
    const isClient =
      milestone.client_id === user.id ||
      (user.wallet_address &&
        milestone.client_address &&
        milestone.client_address.toLowerCase() === user.wallet_address.toLowerCase());

    if (!isClient) {
      return NextResponse.json(
        { error: 'Only the client can run oracle verification for this milestone.' },
        { status: 403 }
      );
    }

    // Get latest submission
    const latestSubmission = db.prepare(`
      SELECT * FROM submissions
      WHERE milestone_id = ?
      ORDER BY submitted_at DESC
      LIMIT 1
    `).get(id) as any;

    if (!latestSubmission) {
      return NextResponse.json(
        { error: 'No deliverable submission found for this milestone to verify.' },
        { status: 400 }
      );
    }

    // 1. Run Agent A: Artifact Evaluation Agent
    const evaluationReport = await evaluateDeliverable({
      submissionId: latestSubmission.id,
      milestoneId: id,
      contractId: milestone.contract_id,
      artifactType: latestSubmission.artifact_type,
      repoUrl: latestSubmission.repo_url,
      branch: latestSubmission.branch,
      commitSha: latestSubmission.commit_sha,
      pullRequestUrl: latestSubmission.pull_request_url,
      description: latestSubmission.description,
      acceptanceCriteria: milestone.acceptance_criteria,
      verificationPolicy: milestone.verification_policy,
      userId: user.id,
    });

    // 2. Run Agent B: Client Treasury Agent
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
    const now = Date.now();
    const newMilestoneStatus = treasuryReview.approved ? 'VERIFIED' : 'REJECTED';

    const saveReportTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO verification_reports (
          id, submission_id, milestone_id, commit_sha,
          spec_version_hash, checks_executed, test_results,
          failed_checks, error_logs, security_findings,
          confidence_score, decision, remediation_feedback,
          oracle_signature, attestation_nonce, attestation_payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reportId,
        latestSubmission.id,
        id,
        evaluationReport.commitSha,
        evaluationReport.specVersionHash,
        JSON.stringify(evaluationReport.checksExecuted),
        JSON.stringify(evaluationReport.testResults),
        JSON.stringify(evaluationReport.checksExecuted.filter((c) => c.status === 'FAILED')),
        null,
        JSON.stringify(evaluationReport.securityFindings),
        evaluationReport.confidenceScore,
        evaluationReport.decisionLabel,
        evaluationReport.remediationFeedback || null,
        treasuryReview.attestation ? treasuryReview.attestation.signature : null,
        treasuryReview.attestation ? treasuryReview.attestation.attestationPayload.nonce : null,
        treasuryReview.attestation ? JSON.stringify(treasuryReview.attestation.attestationPayload) : null,
        now
      );

      // Update submission status
      db.prepare(`
        UPDATE submissions
        SET status = 'EVALUATED'
        WHERE id = ?
      `).run(latestSubmission.id);

      // Update milestone status
      db.prepare(`
        UPDATE milestones
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).run(newMilestoneStatus, now, id);

      // Audit log
      db.prepare(`
        INSERT INTO audit_events (
          id, entity_type, entity_id, actor_id, action, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        'VERIFICATION',
        reportId,
        user.id,
        'EXECUTE_VERIFICATION',
        JSON.stringify({
          confidenceScore: evaluationReport.confidenceScore,
          verdict: evaluationReport.decisionLabel,
          approved: treasuryReview.approved,
        }),
        now
      );
    });

    saveReportTx();

    return NextResponse.json({
      success: true,
      reportId,
      evaluationReport,
      treasuryReview,
      milestoneStatus: newMilestoneStatus,
    });
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
