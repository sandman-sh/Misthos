'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { ethers } from 'ethers';
import { useWallet } from '@/components/wallet-provider';
import { ARC_TESTNET, parseUSDC, formatUSDC, formatAddress } from '@/lib/arc-config';

interface MilestoneDraft {
  title: string;
  description: string;
  amount: string;
  dueDate: string;
  deliverableType: string;
  acceptanceCriteria: string;
  allowResubmission: boolean;
}

export default function NewContractWizardPage() {
  const router = useRouter();
  const { address, isCorrectNetwork, getSigner, connectWallet, switchToArcTestnet } = useWallet();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectBrief, setProjectBrief] = useState('');
  const [contractorAddress, setContractorAddress] = useState('');

  // Milestones State
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    {
      title: 'Milestone 1: Core Architecture & Test Suite',
      description: 'Initial repository setup, domain models, and passing unit test suite.',
      amount: '500.00',
      dueDate: '',
      deliverableType: 'GITHUB_PR',
      acceptanceCriteria: '- Repository created with clean modular structure\n- Passing unit tests with >80% coverage\n- Zero high-severity security vulnerabilities\n- Comprehensive README with setup instructions',
      allowResubmission: true,
    },
  ]);

  // Verification Config State
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [verificationPolicy, setVerificationPolicy] = useState(
    'Dual-agent evaluation with automated test suite and EIP-712 cryptographic oracle attestation.'
  );

  // Compute Total
  const totalBaseUnits = milestones.reduce((acc, m) => acc + parseUSDC(m.amount || '0'), BigInt(0));

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      {
        title: `Milestone ${milestones.length + 1}`,
        description: '',
        amount: '250.00',
        dueDate: '',
        deliverableType: 'GITHUB_PR',
        acceptanceCriteria: '- Deliverable satisfies agreed specifications and passing test assertions.',
        allowResubmission: true,
      },
    ]);
  };

  const removeMilestone = (idx: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, field: keyof MilestoneDraft, value: string | number | boolean) => {
    const updated = [...milestones];
    updated[idx] = { ...updated[idx], [field]: value } as MilestoneDraft;
    setMilestones(updated);
  };

  const validateStep1 = () => {
    if (!title.trim()) return 'Contract title is required.';
    if (!contractorAddress.trim()) return 'Contractor EVM wallet address is required.';
    if (!ethers.isAddress(contractorAddress.trim())) return 'Invalid contractor EVM address format.';
    return null;
  };

  const validateStep2 = () => {
    if (milestones.length === 0) return 'At least one milestone is required.';
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.title.trim()) return `Milestone ${i + 1} requires a title.`;
      if (!m.amount || parseUSDC(m.amount) <= BigInt(0)) return `Milestone ${i + 1} must have an amount > 0.`;
      if (!m.acceptanceCriteria.trim()) return `Milestone ${i + 1} requires acceptance criteria.`;
    }
    return null;
  };

  const nextStep = () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) return setError(err);
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) return setError(err);
    }
    setStep(step + 1);
  };

  const prevStep = () => {
    setError(null);
    setStep(step - 1);
  };

  // Final Submission & On-chain Creation
  const handleCreateContract = async () => {
    setError(null);
    setLoading(true);

    try {
      if (!address) {
        throw new Error('Please connect your EVM wallet before creating the escrow contract on Arc.');
      }

      if (!isCorrectNetwork) {
        await switchToArcTestnet();
      }

      // Generate a unique onchain escrow ID (bytes32)
      const onchainEscrowId = ethers.id(`${title}-${address}-${contractorAddress}-${Date.now()}`);

      let txHash = '';
      const signer = await getSigner();

      // If escrow contract is configured or deployed on Arc, execute on-chain escrow creation
      if (signer && ARC_TESTNET.contracts.escrow) {
        try {
          const amountsBase = milestones.map((m) => parseUSDC(m.amount));
          const hashes = milestones.map((m) => ethers.id(m.acceptanceCriteria));

          const escrowContract = new ethers.Contract(
            ARC_TESTNET.contracts.escrow,
            [
              'function createEscrow(bytes32,address,address,uint256[],bytes32[]) external returns (bool)',
            ],
            signer
          );

          const tx = await escrowContract.createEscrow(
            onchainEscrowId,
            contractorAddress.trim(),
            ethers.ZeroAddress, // uses default oracle
            amountsBase,
            hashes
          );

          const receipt = await tx.wait();
          txHash = receipt.hash;
        } catch (onchainErr: any) {
            // Do not silently persist a DB-only escrow: the agreement must exist on-chain
            // so that funding and oracle settlement are real, verifiable Arc transactions.
            throw new Error(
              'On-chain escrow creation failed on Arc Testnet: ' +
                (onchainErr?.shortMessage || onchainErr?.message || 'unknown error') +
                '. Check that the escrow contract is deployed and your wallet has USDC gas, then retry.'
            );
        }
      }

      // Persist to server database
      const res = await fetch('/api/app/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          projectBrief,
          contractorAddress: contractorAddress.trim(),
          clientAddress: address,
          milestones,
          verificationPolicy,
          onchainEscrowId,
          escrowContractAddress: ARC_TESTNET.contracts.escrow,
          txHash: txHash || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save contract');
      }

      router.push(`/app/contracts/${data.contractId}`);
    } catch (err: any) {
      console.error('Creation error:', err);
      setError(err.message || 'An error occurred while creating the contract.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back button & Title */}
      <div>
        <Link
          href="/app/contracts"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Contracts</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Create Milestone Escrow Contract</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Define the Symbolon agreement: milestones, acceptance criteria, and USDC settlement on Arc.
        </p>
      </div>

      {/* Stepper Header */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { num: 1, label: 'Parties' },
          { num: 2, label: 'Milestones' },
          { num: 3, label: 'Oracle Policy' },
          { num: 4, label: 'Review & Deploy' },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-3 rounded-lg border text-left transition-all ${
              step === s.num
                ? 'border-[var(--accent)] bg-[var(--accent-subtle)] font-bold text-[var(--foreground)]'
                : step > s.num
                ? 'border-green-500/50 bg-green-50/10 text-green-600 dark:text-green-400'
                : 'border-[var(--surface-border)] bg-[var(--surface)] text-[var(--foreground-muted)]'
            }`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider">Step {s.num}</div>
            <div className="text-xs font-semibold truncate">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Basic Information */}
      {step === 1 && (
        <div className="card-misthos p-6 space-y-5">
          <h2 className="text-base font-bold">Step 1: Agreement Parties & Scope</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Contract Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Arc Fintech Integration & Smart Escrow Module"
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Contractor EVM Wallet Address *
              </label>
              <input
                type="text"
                required
                value={contractorAddress}
                onChange={(e) => setContractorAddress(e.target.value)}
                placeholder="0x94A...4b21 (recipient of milestone USDC releases on Arc)"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                Must be an EVM-compatible address. Payouts will settle directly to this wallet.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Short Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="High-level project scope summary"
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Detailed Project Brief / Requirements
              </label>
              <textarea
                rows={4}
                value={projectBrief}
                onChange={(e) => setProjectBrief(e.target.value)}
                placeholder="Architecture specifications, technology stack requirements, deliverables expected..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--surface-border)]">
            <button
              type="button"
              onClick={nextStep}
              className="btn-primary py-2 px-5 rounded-lg flex items-center space-x-2 text-xs font-semibold"
            >
              <span>Continue to Milestones</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Milestones Breakdown */}
      {step === 2 && (
        <div className="card-misthos p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Step 2: Milestone Breakdown & Acceptance Criteria</h2>
              <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
                Define the measurable criteria evaluated by the Oracle before funds release.
              </p>
            </div>

            <button
              type="button"
              onClick={addMilestone}
              className="btn-secondary py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Milestone</span>
            </button>
          </div>

          <div className="space-y-4">
            {milestones.map((m, idx) => (
              <div key={idx} className="card-elevated p-4 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase text-[var(--accent)]">
                    Milestone #{idx + 1}
                  </span>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(idx)}
                      className="text-xs text-[var(--danger)] hover:opacity-80 p-1"
                      title="Remove Milestone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                      Milestone Name *
                    </label>
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => updateMilestone(idx, 'title', e.target.value)}
                      placeholder="e.g., Core Smart Contract Deployment"
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                      Amount (USDC) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={m.amount}
                      onChange={(e) => updateMilestone(idx, 'amount', e.target.value)}
                      placeholder="500.00"
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                    Acceptance Criteria & Verifiable Evidence *
                  </label>
                  <textarea
                    rows={3}
                    value={m.acceptanceCriteria}
                    onChange={(e) => updateMilestone(idx, 'acceptanceCriteria', e.target.value)}
                    placeholder="- List itemized criteria required for the Oracle to verify and approve payment..."
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>

                {/* Creator-controlled resubmission policy */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1.5">
                    Allow Resubmissions
                  </label>
                  <button
                    type="button"
                    onClick={() => updateMilestone(idx, 'allowResubmission', !m.allowResubmission)}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                      m.allowResubmission
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--foreground)]'
                        : 'border-[var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--foreground-muted)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    {m.allowResubmission ? 'Resubmissions allowed' : 'One submission only'}
                  </button>
                  <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                    When enabled, the contractor can submit again and again after a rejected delivery.
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-[var(--foreground-muted)]">Total Agreement Value:</span>
            <span className="font-bold text-sm text-[var(--foreground)]">
              ${formatUSDC(totalBaseUnits)} USDC
            </span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--surface-border)]">
            <button
              type="button"
              onClick={prevStep}
              className="btn-secondary py-2 px-4 rounded-lg text-xs font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="btn-primary py-2 px-5 rounded-lg flex items-center space-x-2 text-xs font-semibold"
            >
              <span>Continue to Oracle Policy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Oracle Verification Configuration */}
      {step === 3 && (
        <div className="card-misthos p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold">Step 3: Artifact Oracle Configuration</h2>
            <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
              Set repository sources and automated testing rules executed by Agent A.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Target GitHub Repository URL (Optional)
              </label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Target Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Verification Policy Description
              </label>
              <textarea
                rows={3}
                value={verificationPolicy}
                onChange={(e) => setVerificationPolicy(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--surface-border)]">
            <button
              type="button"
              onClick={prevStep}
              className="btn-secondary py-2 px-4 rounded-lg text-xs font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="btn-primary py-2 px-5 rounded-lg flex items-center space-x-2 text-xs font-semibold"
            >
              <span>Review The Symbolon Agreement</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: The Symbolon Review & Confirmation */}
      {step === 4 && (
        <div className="card-misthos p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-4">
            <div>
              <h2 className="text-base font-bold">Step 4: The Symbolon Agreement Review</h2>
              <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
                Confirm your contract terms before recording to Arc Testnet.
              </p>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-[var(--accent-subtle)] font-bold text-[var(--foreground)]">
              Chain: Arc (5042002)
            </span>
          </div>

          {/* Summary Box */}
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)]">
              <div>
                <span className="text-[var(--foreground-muted)] block text-[10px] uppercase">Client / Funder</span>
                <span className="font-bold text-[var(--foreground)]">{address ? formatAddress(address) : 'Not Connected'}</span>
              </div>
              <div>
                <span className="text-[var(--foreground-muted)] block text-[10px] uppercase">Contractor / Payee</span>
                <span className="font-bold text-[var(--foreground)]">{formatAddress(contractorAddress)}</span>
              </div>
              <div>
                <span className="text-[var(--foreground-muted)] block text-[10px] uppercase">Total Value</span>
                <span className="font-bold text-sm text-[var(--foreground)]">${formatUSDC(totalBaseUnits)} USDC</span>
              </div>
              <div>
                <span className="text-[var(--foreground-muted)] block text-[10px] uppercase">Settlement Speed</span>
                <span className="font-bold text-green-500">&lt;500ms on Arc</span>
              </div>
            </div>

            {/* Milestones Summary */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-[var(--foreground-muted)] font-bold">
                Agreed Milestones ({milestones.length})
              </span>
              <div className="divide-y divide-[var(--surface-border)] border border-[var(--surface-border)] rounded-lg overflow-hidden">
                {milestones.map((m, idx) => (
                  <div key={idx} className="p-3 bg-[var(--surface)] flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs text-[var(--foreground)]">{m.title}</div>
                      <div className="text-[10px] text-[var(--foreground-muted)] truncate max-w-md">
                        {m.acceptanceCriteria.split('\n')[0]}
                      </div>
                    </div>
                    <div className="font-bold text-xs text-[var(--foreground)]">
                      ${formatUSDC(parseUSDC(m.amount))} USDC
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Wallet check before deploying */}
          {!address ? (
            <div className="p-4 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning-border)] text-xs text-[var(--warning)] flex items-center justify-between">
              <span>Please connect your EVM wallet to establish and deploy the escrow agreement.</span>
              <button
                type="button"
                onClick={connectWallet}
                className="btn-primary py-1.5 px-3 rounded text-xs font-semibold"
              >
                Connect Wallet
              </button>
            </div>
          ) : !isCorrectNetwork ? (
            <div className="p-4 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-xs text-[var(--danger)] flex items-center justify-between">
              <span>Your wallet is not connected to Arc Testnet (Chain ID: 5042002).</span>
              <button
                type="button"
                onClick={switchToArcTestnet}
                className="btn-primary py-1.5 px-3 rounded text-xs font-semibold"
              >
                Switch Network
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-4 border-t border-[var(--surface-border)]">
            <button
              type="button"
              disabled={loading}
              onClick={prevStep}
              className="btn-secondary py-2 px-4 rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleCreateContract}
              className="btn-primary py-2.5 px-6 rounded-lg flex items-center space-x-2 text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deploying Escrow Agreement...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Establish Escrow Agreement</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
