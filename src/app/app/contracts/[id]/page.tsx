'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Coins,
  Lock,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
  Loader2,
  Wallet,
  Clock,
} from 'lucide-react';
import { ethers } from 'ethers';
import { useWallet } from '@/components/wallet-provider';
import {
  formatAddress,
  formatUSDC,
  parseUSDC,
  getExplorerTxUrl,
  ARC_TESTNET,
} from '@/lib/arc-config';

export default function ContractDetailPage({
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

  // Funding Modal State
  const [fundingAmount, setFundingAmount] = useState('');
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState<string | null>(null);
  const [showFundModal, setShowFundModal] = useState(false);

  const fetchContract = () => {
    fetch(`/api/app/contracts/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Contract not found or access denied.');
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchContract();
  }, [id]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-2">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
        <p className="text-xs text-[var(--foreground-muted)]">Loading contract details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card-misthos p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-[var(--danger)] mx-auto" />
        <div className="text-sm font-semibold">{error || 'Contract not found'}</div>
        <Link href="/app/contracts" className="btn-secondary inline-block py-1.5 px-4 rounded text-xs">
          Return to Contracts
        </Link>
      </div>
    );
  }

  const { contract, milestones, transactions, userRole } = data;
  const totalBase = BigInt(contract.total_amount || '0');
  const fundedBase = BigInt(contract.funded_amount || '0');
  const lockedBase = fundedBase > BigInt(0) ? fundedBase : BigInt(0);

  // Handle on-chain funding
  const handleFundEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundingAmount || parseUSDC(fundingAmount) <= BigInt(0)) return;

    setFundingLoading(true);
    setError(null);
    setFundingSuccess(null);

    try {
      if (!address) {
        throw new Error('Please connect your EVM wallet first.');
      }
      if (!isCorrectNetwork) {
        await switchToArcTestnet();
      }

      const signer = await getSigner();
      if (!signer) {
        throw new Error('No active wallet signer found.');
      }

      const amountBase = parseUSDC(fundingAmount);
      let txHash = '';

      // If on-chain escrow address is configured, interact directly
      if (contract.escrow_contract_address) {
          const escrowAbi = [
            'function fundEscrow(bytes32,uint256) external payable returns (bool)'
          ];
          const escrowContract = new ethers.Contract(contract.escrow_contract_address, escrowAbi, signer);

          // Ensure allowance on USDC (ERC-20 interface on Arc)
          const erc20Abi = [
            'function approve(address,uint256) external returns (bool)',
            'function allowance(address,address) view returns (uint256)'
          ];
          const usdc = new ethers.Contract(ARC_TESTNET.contracts.usdc, erc20Abi, signer);
          const allowance = await usdc.allowance(address, contract.escrow_contract_address);
          if (allowance < amountBase) {
            const appTx = await usdc.approve(contract.escrow_contract_address, amountBase);
            await appTx.wait();
          }

          const tx = await escrowContract.fundEscrow(contract.onchain_escrow_id, amountBase);
          const receipt = await tx.wait();
          if (!receipt || receipt.status !== 1) {
            throw new Error('On-chain fundEscrow transaction reverted on Arc.');
          }
          txHash = receipt.hash;
      } else {
          throw new Error(
            'No escrow contract is deployed for this agreement on Arc Testnet. Deploy MisthosEscrow (npm run deploy:arc), set NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS, and re-create the escrow on-chain before funding.'
          );
      }

      // Record on server database
      const res = await fetch(`/api/app/contracts/${id}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: fundingAmount,
          txHash,
          senderAddress: address,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to update funding records');
      }

      setFundingSuccess(`Successfully locked ${fundingAmount} USDC into escrow! Tx: ${txHash.slice(0, 10)}...`);
      setShowFundModal(false);
      fetchContract();
    } catch (err: any) {
      setError(err.message || 'Funding transaction failed');
    } finally {
      setFundingLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Back button & Action Header */}
      <div>
        <Link
          href="/app/contracts"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Contracts</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold tracking-tight">{contract.title}</h1>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                  contract.status === 'ACTIVE'
                    ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : contract.status === 'AWAITING_FUNDING'
                    ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    : contract.status === 'COMPLETED'
                    ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'bg-[var(--surface-elevated)] text-[var(--foreground-muted)] border border-[var(--surface-border)]'
                }`}
              >
                {contract.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-1 max-w-2xl">
              {contract.description || 'Milestone escrow agreement settled natively on Arc.'}
            </p>
          </div>

          {userRole === 'client' && contract.status !== 'COMPLETED' && (
            <button
              onClick={() => setShowFundModal(true)}
              className="btn-primary py-2 px-4 rounded-lg flex items-center space-x-2 text-xs font-semibold self-start sm:self-auto shadow-sm"
            >
              <Coins className="w-4 h-4" />
              <span>Deposit USDC Escrow</span>
            </button>
          )}
        </div>
      </div>

      {fundingSuccess && (
        <div className="p-4 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] text-xs text-[var(--success)] flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{fundingSuccess}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-misthos p-4 space-y-1">
          <div className="text-[10px] font-mono uppercase text-[var(--foreground-muted)]">
            Total Agreement Value
          </div>
          <div className="text-xl font-bold font-mono">${formatUSDC(totalBase)} USDC</div>
        </div>

        <div className="card-misthos p-4 space-y-1">
          <div className="text-[10px] font-mono uppercase text-[var(--foreground-muted)]">
            Funded Escrow Reserve
          </div>
          <div className="text-xl font-bold font-mono text-amber-500">
            ${formatUSDC(fundedBase)} USDC
          </div>
        </div>

        <div className="card-misthos p-4 space-y-1">
          <div className="text-[10px] font-mono uppercase text-[var(--foreground-muted)]">
            Milestones Progress
          </div>
          <div className="text-xl font-bold font-mono">
            {milestones.filter((m: any) => m.status === 'PAID').length} / {milestones.length} Paid
          </div>
        </div>
      </div>

      {/* Contract Metadata Box */}
      <div className="card-misthos p-5 space-y-3 font-mono text-xs">
        <div className="font-bold text-sm text-[var(--foreground)] border-b border-[var(--surface-border)] pb-2 flex items-center justify-between">
          <span>The Symbolon On-Chain Parameters</span>
          <span className="text-[10px] text-[var(--accent)] font-semibold">● Arc Testnet (5042002)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[var(--foreground-muted)]">
          <div>
            <span className="block text-[10px] uppercase">Client Address:</span>
            <span className="text-[var(--foreground)] font-semibold">{contract.client_address}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase">Contractor Address:</span>
            <span className="text-[var(--foreground)] font-semibold">{contract.contractor_address}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase">On-chain Escrow ID:</span>
            <span className="text-[var(--foreground)] font-semibold truncate block">
              {contract.onchain_escrow_id}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase">Settlement Rail:</span>
            <span className="text-[var(--foreground)] font-semibold">Arc L1 Native USDC Gas</span>
          </div>
        </div>
      </div>

      {/* Milestones Section */}
      <div className="space-y-4">
        <h2 className="text-base font-bold tracking-tight">Milestones & Verifiable Deliverables</h2>

        <div className="space-y-3">
          {milestones.map((m: any, idx: number) => {
            const mAmount = BigInt(m.amount);
            return (
              <div
                key={m.id}
                className="card-misthos p-5 space-y-4 hover:border-[var(--accent)] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-[var(--accent)]">
                        #{idx + 1}
                      </span>
                      <h3 className="font-bold text-sm text-[var(--foreground)]">{m.title}</h3>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                          m.status === 'PAID'
                            ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                            : m.status === 'VERIFIED'
                            ? 'bg-[var(--accent-subtle)] text-[var(--foreground)] border border-[var(--accent-border)]'
                            : m.status === 'IN_REVIEW'
                            ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                            : m.status === 'FUNDED'
                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                            : 'bg-[var(--surface-elevated)] text-[var(--foreground-muted)]'
                        }`}
                      >
                        {m.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--foreground-muted)]">
                      {m.description || 'Milestone deliverables required for settlement.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--surface-border)]">
                    <div className="text-right font-mono">
                      <div className="text-sm font-bold text-[var(--foreground)]">
                        ${formatUSDC(mAmount)} USDC
                      </div>
                      <div className="text-[10px] text-[var(--foreground-muted)]">
                        {m.deliverable_type}
                      </div>
                    </div>

                    <Link
                      href={`/app/milestones/${m.id}`}
                      className="btn-secondary py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center space-x-1 hover:border-[var(--accent)]"
                    >
                      <span>Workspace</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Acceptance Criteria Box */}
                <div className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-xs space-y-1 font-mono">
                  <span className="text-[10px] uppercase font-bold text-[var(--foreground-muted)]">
                    Verifiable Acceptance Criteria:
                  </span>
                  <div className="whitespace-pre-line text-[var(--foreground-muted)] text-[11px]">
                    {m.acceptance_criteria}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Funding Modal */}
      {showFundModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card-misthos p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-bold">Deposit USDC to Arc Escrow</h3>
            <p className="text-xs text-[var(--foreground-muted)]">
              Lock funds in the smart contract. Funds are released only upon cryptographically verified deliverable completion.
            </p>

            <form onSubmit={handleFundEscrow} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-[var(--foreground-muted)] mb-1">
                  Deposit Amount (USDC)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={fundingAmount}
                  onChange={(e) => setFundingAmount(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFundModal(false)}
                  className="btn-secondary py-2 px-3 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fundingLoading}
                  className="btn-primary py-2 px-4 rounded-lg text-xs font-semibold flex items-center space-x-2 disabled:opacity-50"
                >
                  {fundingLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Transacting on Arc...</span>
                    </>
                  ) : (
                    <span>Confirm Deposit</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
