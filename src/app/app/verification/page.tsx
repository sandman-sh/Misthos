'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cpu, ArrowRight, CheckCircle2, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { formatAddress } from '@/lib/arc-config';

export default function VerificationPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/app/overview')
      .then((res) => res.json())
      .then((d) => {
        setReports(d.recentReports || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Artifact Oracle Verifications</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Historical records of all automated deliverable evaluations, security scans, and signed EIP-712 attestations.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
          <p className="text-xs text-[var(--foreground-muted)]">Loading verification records...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="card-misthos p-12 text-center space-y-3">
          <Cpu className="w-10 h-10 text-[var(--foreground-muted)] mx-auto opacity-50" />
          <div className="text-sm font-semibold">No verification jobs executed yet</div>
          <p className="text-xs text-[var(--foreground-muted)] max-w-sm mx-auto">
            When a contractor submits deliverables for a funded milestone, the evaluation agent will produce detailed audit logs here.
          </p>
          <Link href="/app/contracts" className="btn-secondary inline-block py-1.5 px-4 rounded text-xs font-semibold">
            View Active Contracts
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="card-misthos p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-sm text-[var(--foreground)]">{r.milestone_title}</h3>
                  <span className="text-xs text-[var(--foreground-muted)] font-mono">
                    ({r.contract_title})
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                      r.decision === 'APPROVED'
                        ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {r.decision} (Confidence: {r.confidence_score}%)
                  </span>
                  <Link
                    href={`/app/milestones/${r.milestone_id}`}
                    className="btn-secondary py-1 px-2.5 rounded text-xs flex items-center space-x-1"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-[var(--foreground-muted)] border-t border-[var(--surface-border)] pt-3">
                <div>
                  <span className="text-[10px] uppercase block">Evaluated Commit:</span>
                  <span className="text-[var(--foreground)]">{r.commit_sha.slice(0, 7)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase block">Timestamp:</span>
                  <span className="text-[var(--foreground)]">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase block">Signed Attestation:</span>
                  <span className="text-green-500 font-bold">
                    {r.oracle_signature ? 'EIP-712 Active' : 'None'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
