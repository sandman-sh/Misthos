'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Cpu,
  Coins,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  ExternalLink,
  Code2,
  ShieldCheck,
  Send,
  Loader2,
  Terminal,
  FileText,
} from 'lucide-react';
import { ethers } from 'ethers';
import { useWallet } from '@/components/wallet-provider';
import {
  formatAddress,
  formatUSDC,
  getExplorerTxUrl,
  ARC_TESTNET,
} from '@/lib/arc-config';

export default function MilestoneWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const { address, isCorrectNetwork, getSigner, connectWallet, switchToArcTestnet } = useWallet();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deliverable Submission Form State
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [commitSha, setCommitSha] = useState('');
  const [pullRequestUrl, setPullRequestUrl] = useState('');
  const [submissionDesc, setSubmissionDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Verification & Settlement Action States
  const [verifying, setVerifying] = useState(false);
  const [settling, setSettling] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchMilestone = () => {
    fetch(`/api/app/milestones/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load milestone data');
        return res.json();
      })
      .then((d) => {
        setData(d);
        if (d.submissions && d.submissions.length > 0) {
          const latest = d.submissions[0];
          setRepoUrl(latest.repo_url || '');
          setBranch(latest.branch || 'main');
          setCommitSha(latest.commit_sha || '');
          setPullRequestUrl(latest.pull_request_url || '');
          setSubmissionDesc(latest.description || '');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMilestone();
  }, [id]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-2">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
        <p className="text-xs text-[var(--foreground-muted)]">Loading milestone workspace...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card-misthos p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-[var(--danger)] mx-auto" />
        <div className="text-sm font-semibold">{error || 'Milestone not found'}</div>
        <Link href="/app/contracts" className="btn-secondary inline-block py-1.5 px-4 rounded text-xs">
          Return to Contracts
        </Link>
      </div>
    );
  }

  const { milestone, submissions, reports, userRole, resubmissionsAllowed } = data;
  const latestReport = reports && reports.length > 0 ? reports[0] : null;
  const latestSubmission = submissions && submissions.length > 0 ? submissions[0] : null;

  // Handle Contractor Submitting Deliverable
  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/app/milestones/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          branch,
          commitSha: commitSha || ethers.id(Date.now().toString()).slice(0, 42),
          pullRequestUrl,
          description: submissionDesc,
          artifactType: 'GITHUB_PR',
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to submit deliverable');
      }

      // The oracle now runs automatically on submission - show the verdict immediately.
      const av = resData.autoVerification;
      if (av && !av.error) {
        if (av.treasuryApproved) {
          setActionSuccess(
            `Deliverable verified autonomously: APPROVED (${av.confidence}% confidence${av.llmPowered ? ', LLM audit' : ', heuristic audit'}). Signed EIP-712 attestation issued — ready to settle.`
          );
        } else if (av.verdict) {
          setActionSuccess(
            `Oracle verdict: ${av.verdict} (${av.confidence}% confidence). ${av.attestationSigned ? '' : 'No attestation issued. '}Check the report for remediation feedback.`
          );
        } else {
          setActionSuccess('Deliverable submitted. Oracle verification completed.');
        }
      } else if (av && av.error) {
        setActionSuccess('Deliverable submitted. Auto-verification could not complete — run it manually below.');
      } else {
        setActionSuccess('Deliverable submitted and queued for oracle verification.');
      }
      fetchMilestone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Triggering Dual-Agent Verification (Agent A & Agent B)
  const handleRunVerification = async () => {
    setVerifying(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/app/milestones/${id}/verify`, {
        method: 'POST',
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Verification pipeline encountered an error');
      }

      if (resData.treasuryReview?.approved) {
        setActionSuccess(
          `Verification Complete: Deliverable Approved (Confidence: ${resData.evaluationReport.confidenceScore}%). Signed EIP-712 attestation generated!`
        );
      } else {
        setActionSuccess(
          `Verification Complete: Deliverable Rejected (Confidence: ${resData.evaluationReport.confidenceScore}%). Remediation feedback generated.`
        );
      }
      fetchMilestone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  // Handle Executing Settlement On-Chain (Contract Release)
  const handleExecuteSettlement = async () => {
    setSettling(true);
    setError(null);
    setActionSuccess(null);

    try {
      if (!address) {
        throw new Error('Please connect your EVM wallet before releasing funds.');
      }
      if (!isCorrectNetwork) {
        await switchToArcTestnet();
      }

      const signer = await getSigner();
      if (!signer) {
        throw new Error('No active wallet signer found.');
      }

      if (!latestReport || !latestReport.oracle_signature) {
        throw new Error('No valid signed oracle attestation found for this milestone.');
      }

      if (!milestone.escrow_contract_address) {
        throw new Error(
          'This contract has no escrow deployed on Arc Testnet yet. Deploy MisthosEscrow (npm run deploy:arc) and set NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS, then re-create the escrow on-chain.'
        );
      }

      let txHash = '';

      // If escrow contract address exists, execute on-chain releaseMilestone
      if (milestone.escrow_contract_address) {
        // Replay the EXACT EIP-712 attestation payload the oracle signed.
        // Re-deriving any field (hash, nonce, expiry) breaks signature verification on-chain.
        let signedPayload: any;
        try {
          signedPayload = latestReport.attestation_payload
            ? JSON.parse(latestReport.attestation_payload)
            : null;
        } catch {
          signedPayload = null;
        }
        if (!signedPayload) {
          throw new Error('Signed attestation payload is missing from the verification report. Re-run verification.');
        }

        const escrowAbi = [
          'function releaseMilestone((bytes32,uint256,bytes32,bytes32,uint8,uint256,uint256,uint256),bytes) external returns (bool)',
        ];
        const escrowContract = new ethers.Contract(milestone.escrow_contract_address, escrowAbi, signer);

        const attPayload = {
          escrowId: signedPayload.escrowId,
          milestoneId: BigInt(signedPayload.milestoneId),
          deliverableHash: signedPayload.deliverableHash,
          policyHash: signedPayload.policyHash,
          decision: signedPayload.decision,
          authorizedAmount: BigInt(signedPayload.authorizedAmount),
          nonce: BigInt(signedPayload.nonce),
          expiry: BigInt(signedPayload.expiry),
        };

        const tx = await escrowContract.releaseMilestone(attPayload, latestReport.oracle_signature);
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
          throw new Error('On-chain releaseMilestone transaction reverted on Arc.');
        }
        txHash = receipt.hash;
      }

      // Record settlement in database
      const res = await fetch(`/api/app/milestones/${id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          senderAddress: address,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to update settlement records');
      }

      setActionSuccess(`Payment Settled! ${formatUSDC(milestone.amount)} USDC released on Arc. Tx: ${txHash.slice(0, 10)}...`);
      fetchMilestone();
    } catch (err: any) {
      setError(err.message || 'Settlement execution failed');
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Header */}
      <div>
        <Link
          href={`/app/contracts/${milestone.contract_id}`}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Contract: {milestone.contract_title}</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-[var(--accent)]">
                Milestone #{milestone.order_index + 1}
              </span>
              <h1 className="text-2xl font-bold tracking-tight">{milestone.title}</h1>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                  milestone.status === 'PAID'
                    ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : milestone.status === 'VERIFIED'
                    ? 'bg-[var(--accent-subtle)] text-[var(--foreground)] border border-[var(--accent-border)]'
                    : milestone.status === 'IN_REVIEW'
                    ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'bg-[var(--surface-elevated)] text-[var(--foreground-muted)]'
                }`}
              >
                {milestone.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Agreed Payout: <strong className="text-[var(--foreground)] font-mono">${formatUSDC(milestone.amount)} USDC</strong> · Settled on Arc Testnet
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center space-x-3">
            {userRole === 'client' && latestSubmission && milestone.status !== 'PAID' && (
              <button
                type="button"
                onClick={handleRunVerification}
                disabled={verifying}
                className="btn-secondary py-2 px-3.5 rounded-lg flex items-center space-x-2 text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Run Oracle Verification</span>
                  </>
                )}
              </button>
            )}

            {userRole === 'client' && milestone.status === 'VERIFIED' && latestReport?.oracle_signature && (
              <button
                type="button"
                onClick={handleExecuteSettlement}
                disabled={settling}
                className="btn-primary py-2 px-4 rounded-lg flex items-center space-x-2 text-xs font-bold shadow-sm disabled:opacity-50"
              >
                {settling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Settling on Arc...</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-3.5 h-3.5" />
                    <span>Execute Settlement (${formatUSDC(milestone.amount)} USDC)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] text-xs text-[var(--success)] flex items-center space-x-2 font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-xs text-[var(--danger)] flex items-center space-x-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Acceptance Criteria Box */}
      <div className="card-misthos p-5 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)] flex items-center space-x-1.5">
          <FileCheck2 className="w-4 h-4 text-[var(--accent)]" />
          <span>Frozen Acceptance Criteria (The Symbolon)</span>
        </h3>
        <div className="p-3.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)] font-mono text-xs whitespace-pre-line text-[var(--foreground)]">
          {milestone.acceptance_criteria}
        </div>
      </div>

      {/* 2-Column Section: Deliverable Submission & Verification Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Deliverable Submission Form */}
        <div className="card-misthos p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
            <h3 className="font-bold text-sm flex items-center space-x-2">
              <Code2 className="w-4 h-4 text-[var(--accent)]" />
              <span>Deliverable Artifact Submission</span>
            </h3>
            <span className="text-[10px] font-mono text-[var(--foreground-muted)]">
              {latestSubmission ? 'Submitted' : 'Awaiting Artifact'}
            </span>
          </div>

          {userRole === 'contractor' ? (
          <form onSubmit={handleSubmitDeliverable} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                GitHub Pull Request URL *
              </label>
              <input
                type="url"
                required
                value={pullRequestUrl}
                onChange={(e) => setPullRequestUrl(e.target.value)}
                placeholder="https://github.com/org/repo/pull/42"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                  Target Branch
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                  Commit SHA (Frozen Fingerprint)
                </label>
                <input
                  type="text"
                  value={commitSha}
                  onChange={(e) => setCommitSha(e.target.value)}
                  placeholder="7f3c9a1..."
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                Repository Source URL
              </label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                Implementation Notes & Deliverable Summary
              </label>
              <textarea
                rows={3}
                value={submissionDesc}
                onChange={(e) => setSubmissionDesc(e.target.value)}
                placeholder="Itemized summary of changes, test commands executed, architecture highlights..."
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {milestone.status !== 'PAID' && milestone.status !== 'VERIFIED' && resubmissionsAllowed && (
              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary py-2 px-4 rounded-lg flex items-center justify-center space-x-2 text-xs font-bold disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Deliverable...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {milestone.status === 'REJECTED'
                        ? 'Resubmit Improved Deliverable'
                        : latestSubmission
                          ? 'Update Deliverable Submission'
                          : 'Submit Deliverable'}
                    </span>
                  </>
                )}
              </button>
            )}
            {milestone.status === 'REJECTED' && !resubmissionsAllowed && (
              <div className="p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[11px] text-[var(--danger)] font-mono text-center">
                Resubmissions are disabled by the creator for this milestone.
              </div>
            )}
          </form>
          ) : (
            /* Client / viewer: read-only submission status */
            <div className="space-y-4">
              {latestSubmission ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)] space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-[var(--foreground-muted)]">Deliverable Submitted</span>
                      <span className="text-green-500 font-bold">RECEIVED</span>
                    </div>
                    <div className="space-y-1.5 text-[var(--foreground)]">
                      {latestSubmission.pull_request_url && (
                        <div className="break-all">
                          <span className="text-[10px] text-[var(--foreground-muted)] block">Pull Request</span>
                          <a href={latestSubmission.pull_request_url} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline inline-flex items-center space-x-1">
                            <span>{latestSubmission.pull_request_url}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      {latestSubmission.branch && (
                        <div><span className="text-[10px] text-[var(--foreground-muted)]">Branch: </span>{latestSubmission.branch}</div>
                      )}
                      {latestSubmission.commit_sha && (
                        <div className="break-all"><span className="text-[10px] text-[var(--foreground-muted)]">Commit: </span>{latestSubmission.commit_sha}</div>
                      )}
                      {latestSubmission.description && (
                        <div className="pt-1 border-t border-[var(--surface-border)]">
                          <span className="text-[10px] text-[var(--foreground-muted)] block">Contractor Notes</span>
                          <p className="text-[11px] whitespace-pre-line">{latestSubmission.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--foreground-muted)]">
                    The contractor has submitted this deliverable. {userRole === 'client'
                      ? 'Use "Run Oracle Verification" above to audit it, then execute settlement once approved.'
                      : 'Awaiting oracle verification.'}
                  </p>
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <Code2 className="w-10 h-10 text-[var(--foreground-muted)] mx-auto opacity-40" />
                  <div className="text-xs font-semibold">Awaiting Contractor Deliverable</div>
                  <p className="text-[11px] text-[var(--foreground-muted)] max-w-xs mx-auto">
                    The assigned contractor has not submitted a deliverable for this milestone yet. Once they do, it will appear here for oracle verification.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Oracle Verification Report */}
        <div className="card-misthos p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
            <h3 className="font-bold text-sm flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-[var(--accent)]" />
              <span>Artifact Oracle Report (Agent A & B)</span>
            </h3>
            {latestReport && (
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                  latestReport.decision === 'APPROVED'
                    ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                }`}
              >
                {latestReport.decision} ({latestReport.confidence_score}%)
              </span>
            )}
          </div>

          {!latestReport ? (
            <div className="py-12 text-center space-y-3">
              <Cpu className="w-10 h-10 text-[var(--foreground-muted)] mx-auto opacity-40" />
              <div className="text-xs font-semibold">No Verification Executed Yet</div>
              <p className="text-[11px] text-[var(--foreground-muted)] max-w-xs mx-auto">
                Submit your pull request artifact and click &ldquo;Run Oracle Verification&rdquo; to execute the evaluation engine.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Checks Executed List */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono font-bold text-[var(--foreground-muted)]">
                  Executed Verification Checks
                </span>
                <div className="space-y-2">
                  {latestReport.checks_executed.map((c: any, cIdx: number) => (
                    <div
                      key={cIdx}
                      className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--foreground)]">{c.name}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            c.status === 'PASSED'
                              ? 'text-green-600 bg-green-500/10'
                              : 'text-red-500 bg-red-500/10'
                          }`}
                        >
                          {c.status} ({c.durationMs}ms)
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--foreground-muted)] font-mono">{c.output}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remediation Feedback (If failed or escalated) */}
              {latestReport.remediation_feedback && (
                <div className="p-4 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-xs space-y-2">
                  <div className="font-bold text-[var(--danger)] flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Actionable Remediation Feedback</span>
                  </div>
                  <div className="whitespace-pre-line text-[11px] text-[var(--foreground)]">
                    {latestReport.remediation_feedback}
                  </div>
                </div>
              )}

              {/* Signed Attestation Proof (If approved) */}
              {latestReport.oracle_signature && (
                <div className="p-4 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)] space-y-2 font-mono text-[11px]">
                  <div className="font-bold text-xs text-green-500 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span>EIP-712 Attestation Proof Signed</span>
                  </div>
                  <div className="text-[var(--foreground-muted)] break-all space-y-1">
                    <div>
                      <span className="text-[10px] uppercase block">Signature:</span>
                      <span className="text-[var(--foreground)]">{latestReport.oracle_signature}</span>
                    </div>
                    <div className="flex justify-between pt-1 text-[10px]">
                      <span>Nonce: {latestReport.attestation_nonce}</span>
                      <span>Target: Arc L1 (5042002)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* On-Chain Settlement Receipt (If settled) */}
      {milestone.status === 'PAID' && milestone.onchain_tx_hash && (
        <div className="card-misthos p-6 space-y-3 font-mono text-xs">
          <div className="flex items-center space-x-2 text-green-500 font-bold">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm">Settlement Confirmed on Arc Testnet</span>
          </div>
          <div className="flex items-center justify-between text-[var(--foreground-muted)]">
            <span>Transaction Hash:</span>
            <a
              href={getExplorerTxUrl(milestone.onchain_tx_hash)}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)] hover:underline inline-flex items-center space-x-1"
            >
              <span>{milestone.onchain_tx_hash}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
