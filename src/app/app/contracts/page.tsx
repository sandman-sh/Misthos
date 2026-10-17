'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  PlusCircle,
  Search,
  ExternalLink,
  ChevronRight,
  Filter,
  Loader2,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { formatAddress, formatUSDC } from '@/lib/arc-config';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/app/contracts')
      .then((res) => res.json())
      .then((d) => {
        setContracts(d.contracts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredContracts = contracts.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.contractor_address.toLowerCase().includes(search.toLowerCase()) ||
      c.client_address.toLowerCase().includes(search.toLowerCase());

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && c.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Escrow Contracts</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Manage your agreements, track funded reserves, and oversee deliverable milestones on Arc.
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

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--foreground-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contracts by title or EVM wallet address..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--foreground)]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'ACTIVE', 'AWAITING_FUNDING', 'COMPLETED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Contracts Table/List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-[var(--accent)]" />
          <p className="text-xs text-[var(--foreground-muted)]">Loading contracts...</p>
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="card-misthos p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-[var(--foreground-muted)] mx-auto opacity-50" />
          <div className="text-sm font-semibold">No contracts found</div>
          <p className="text-xs text-[var(--foreground-muted)] max-w-sm mx-auto">
            {search || statusFilter !== 'ALL'
              ? 'Try modifying your search or filter criteria.'
              : 'Create your first milestone escrow agreement to start managing payments on Arc.'}
          </p>
          {!search && statusFilter === 'ALL' && (
            <Link
              href="/app/contracts/new"
              className="btn-primary inline-flex items-center space-x-1.5 py-2 px-4 rounded-lg text-xs font-semibold mt-2"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Contract</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredContracts.map((c) => {
            const totalBase = BigInt(c.total_amount || '0');
            const fundedBase = BigInt(c.funded_amount || '0');
            const progress = totalBase > BigInt(0) ? Number((fundedBase * BigInt(100)) / totalBase) : 0;

            return (
              <Link
                key={c.id}
                href={`/app/contracts/${c.id}`}
                className="card-misthos p-5 block hover:border-[var(--accent)] transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-sm tracking-tight group-hover:text-[var(--foreground)] truncate">
                        {c.title}
                      </h3>
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

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--foreground-muted)] font-mono">
                      <span>Contractor: {formatAddress(c.contractor_address)}</span>
                      <span>Client: {formatAddress(c.client_address)}</span>
                      <span>
                        Milestones: {c.completed_milestone_count || 0}/{c.milestone_count || 0}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end space-x-6 border-t md:border-t-0 pt-3 md:pt-0 border-[var(--surface-border)]">
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-[var(--foreground)]">
                        ${formatUSDC(totalBase)} USDC
                      </div>
                      <div className="text-[10px] text-[var(--foreground-muted)] font-mono">
                        Funded: ${formatUSDC(fundedBase)} ({progress}%)
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-[var(--foreground-muted)] group-hover:text-[var(--accent)] transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
