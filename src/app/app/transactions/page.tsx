'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Receipt, ExternalLink, ArrowRight, Loader2, Coins } from 'lucide-react';
import { formatAddress, formatUSDC, getExplorerTxUrl } from '@/lib/arc-config';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/app/transactions')
      .then((res) => res.json())
      .then((d) => {
        setTransactions(d.transactions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blockchain Settlements</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Confirmed smart contract transactions on Arc Testnet, including deposits and milestone payouts.
          </p>
        </div>

        <a
          href="https://testnet.arcscan.app"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary py-2 px-3.5 rounded-lg flex items-center space-x-1.5 text-xs font-semibold self-start sm:self-auto"
        >
          <span>Open Arcscan Explorer</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
          <p className="text-xs text-[var(--foreground-muted)]">Loading on-chain transactions...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card-misthos p-12 text-center space-y-3">
          <Receipt className="w-10 h-10 text-[var(--foreground-muted)] mx-auto opacity-50" />
          <div className="text-sm font-semibold">No transactions recorded yet</div>
          <p className="text-xs text-[var(--foreground-muted)] max-w-sm mx-auto">
            Transactions executed via Arc Testnet will be automatically indexed and linked here.
          </p>
          <Link href="/app/contracts" className="btn-secondary inline-block py-1.5 px-4 rounded text-xs font-semibold">
            View Contracts
          </Link>
        </div>
      ) : (
        <div className="card-misthos overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--surface-elevated)] border-b border-[var(--surface-border)] text-[var(--foreground-muted)] uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Contract / Milestone</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Tx Hash</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Arcscan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] font-mono">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[var(--surface-elevated)]/50">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.tx_type === 'MILESTONE_PAYOUT'
                            ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                            : tx.tx_type === 'FUND'
                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                            : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {tx.tx_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold">
                      <div className="truncate max-w-[160px]">{tx.contract_title || 'Escrow'}</div>
                      {tx.milestone_title && (
                        <div className="text-[10px] text-[var(--foreground-muted)] truncate max-w-[160px]">
                          {tx.milestone_title}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-[var(--foreground)]">
                      ${formatUSDC(tx.amount)} USDC
                    </td>
                    <td className="py-3 px-4 text-[var(--foreground-muted)]">{formatAddress(tx.sender)}</td>
                    <td className="py-3 px-4 text-[var(--foreground-muted)]">{formatAddress(tx.recipient)}</td>
                    <td className="py-3 px-4 text-[var(--foreground-muted)]">{formatAddress(tx.tx_hash, 5)}</td>
                    <td className="py-3 px-4 text-[var(--foreground-muted)] font-sans">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <a
                        href={getExplorerTxUrl(tx.tx_hash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--accent)] hover:underline inline-flex items-center space-x-1"
                      >
                        <span>Receipt</span>
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
  );
}
