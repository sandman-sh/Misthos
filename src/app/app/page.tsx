'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Coins,
  Lock,
  CheckCircle2,
  Cpu,
  FileText,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  TrendingUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { formatAddress, formatUSDC, getExplorerTxUrl } from '@/lib/arc-config';

export default function OverviewDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/app/overview')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load overview data');
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
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
        <p className="text-xs text-[var(--foreground-muted)] font-mono">Loading dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-sm">
        {error}
      </div>
    );
  }

  const { metrics, recentTransactions, recentReports, recentContracts } = data;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Treasury Overview</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Real-time milestone escrow balances and autonomous verification activity on Arc.
          </p>
        </div>

        <Link
          href="/app/contracts/new"
          className="btn-primary py-2 px-4 rounded-lg flex items-center space-x-2 text-xs font-semibold self-start sm:self-auto shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Escrow Contract</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="card-misthos p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-[var(--foreground-muted)]">
            <span>Total Escrow Funded</span>
            <Coins className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-black font-mono tracking-tight">
            ${metrics.totalFunded} <span className="text-xs font-normal text-[var(--foreground-muted)]">USDC</span>
          </div>
          <div className="text-[11px] text-[var(--foreground-muted)]">Cumulative deposits across all contracts</div>
        </div>

        {/* Metric 2 */}
        <div className="card-misthos p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-[var(--foreground-muted)]">
            <span>Funds Locked In Escrow</span>
            <Lock className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-amber-500">
            ${metrics.fundsLocked} <span className="text-xs font-normal text-[var(--foreground-muted)]">USDC</span>
          </div>
          <div className="text-[11px] text-[var(--foreground-muted)]">Awaiting milestone artifact verification</div>
        </div>

        {/* Metric 3 */}
        <div className="card-misthos p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-[var(--foreground-muted)]">
            <span>Payments Released</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-green-600 dark:text-green-400">
            ${metrics.paymentsReleased} <span className="text-xs font-normal text-[var(--foreground-muted)]">USDC</span>
          </div>
          <div className="text-[11px] text-[var(--foreground-muted)]">Settled on Arc upon verified delivery</div>
        </div>

        {/* Metric 4 */}
        <div className="card-misthos p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-[var(--foreground-muted)]">
            <span>Active Contracts</span>
            <FileText className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-black font-mono tracking-tight">
            {metrics.activeContracts} <span className="text-xs font-normal text-[var(--foreground-muted)]">/ {metrics.totalContracts}</span>
          </div>
          <div className="text-[11px] text-[var(--foreground-muted)]">Engagements in active development</div>
        </div>
      </div>

      {/* Main Grid: Contracts & Recent Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Contracts List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">Recent Contracts</h2>
            <Link
              href="/app/contracts"
              className="text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentContracts.length === 0 ? (
            <div className="card-misthos p-8 text-center space-y-3">
              <FileText className="w-10 h-10 text-[var(--foreground-muted)] mx-auto opacity-50" />
              <div className="text-sm font-semibold">No contracts created yet</div>
              <p className="text-xs text-[var(--foreground-muted)] max-w-sm mx-auto">
                Create your first milestone escrow agreement with verifiable deliverable criteria and USDC settlement.
              </p>
              <Link
                href="/app/contracts/new"
                className="btn-primary inline-flex items-center space-x-1.5 py-2 px-4 rounded-lg text-xs font-semibold mt-2"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Contract</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentContracts.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/app/contracts/${c.id}`}
                  className="card-misthos p-4 block hover:border-[var(--accent)] transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm group-hover:text-[var(--foreground)]">
                      {c.title}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                        c.status === 'ACTIVE'
                          ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                          : c.status === 'AWAITING_FUNDING'
                          ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : c.status === 'COMPLETED'
                          ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-[var(--surface-elevated)] text-[var(--foreground-muted)] border border-[var(--surface-border)]'
                      }`}
                    >
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--foreground-muted)] font-mono">
                    <div>
                      <span>Contractor: </span>
                      <span className="text-[var(--foreground)] font-semibold">
                        {formatAddress(c.contractor_address)}
                      </span>
                    </div>
                    <div className="font-bold text-[var(--foreground)]">
                      ${formatUSDC(c.total_amount)} USDC
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (1 col): Recent Verification Activity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">Oracle Verifications</h2>
            <Link
              href="/app/verification"
              className="text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <div className="card-misthos p-6 text-center space-y-2">
              <Cpu className="w-8 h-8 text-[var(--foreground-muted)] mx-auto opacity-50" />
              <div className="text-xs font-semibold">No verifications executed</div>
              <p className="text-[11px] text-[var(--foreground-muted)]">
                Deliverables submitted by contractors will be evaluated here by Agent A & B.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentReports.map((r: any) => (
                <div key={r.id} className="card-misthos p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate max-w-[150px]">{r.milestone_title}</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        r.decision === 'APPROVED'
                          ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {r.decision} ({r.confidence_score}%)
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--foreground-muted)] font-mono truncate">
                    Commit: {r.commit_sha.slice(0, 7)} · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Arc Testnet Notice */}
          <div className="card-elevated p-4 space-y-2 text-xs">
            <div className="font-semibold text-xs flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              <span>Arc Testnet Engine Active</span>
            </div>
            <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed">
              Every release is cryptographically validated via EIP-712 oracle attestations before fund transfer.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">Recent Blockchain Settlements</h2>
          <Link
            href="/app/transactions"
            className="text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] flex items-center space-x-1"
          >
            <span>Explorer History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="card-misthos p-6 text-center text-xs text-[var(--foreground-muted)]">
            No confirmed on-chain transactions yet. Funding or milestone releases will generate immutable receipts here.
          </div>
        ) : (
          <div className="card-misthos overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--surface-elevated)] border-b border-[var(--surface-border)] text-[var(--foreground-muted)] uppercase tracking-wider font-mono text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Contract</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Tx Hash</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {recentTransactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-[var(--surface-elevated)]/50">
                      <td className="py-3 px-4 font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            tx.tx_type === 'MILESTONE_PAYOUT'
                              ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                              : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {tx.tx_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold">{tx.contract_title || 'Escrow'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[var(--foreground)]">
                        ${formatUSDC(tx.amount)} USDC
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--foreground-muted)]">
                        {formatAddress(tx.tx_hash, 6)}
                      </td>
                      <td className="py-3 px-4 text-[var(--foreground-muted)]">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={getExplorerTxUrl(tx.tx_hash)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent)] hover:underline inline-flex items-center space-x-1"
                        >
                          <span>Arcscan</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
