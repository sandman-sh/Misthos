'use client';

import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, CheckCircle2, Clock, Loader2, ArrowRight } from 'lucide-react';

export default function ActivityPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/app/activity')
      .then((res) => res.json())
      .then((d) => {
        setEvents(d.events || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail & Activity Log</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Chronological record of all treasury operations, oracle evaluations, and state changes.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
          <p className="text-xs text-[var(--foreground-muted)]">Loading audit trail...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="card-misthos p-12 text-center space-y-3">
          <Activity className="w-10 h-10 text-[var(--foreground-muted)] mx-auto opacity-50" />
          <div className="text-sm font-semibold">No audit events recorded yet</div>
          <p className="text-xs text-[var(--foreground-muted)] max-w-sm mx-auto">
            All system actions, agent verdicts, and smart contract state changes are permanently logged here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="card-misthos p-4 flex items-start space-x-3 text-xs">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)] flex items-center justify-center text-[var(--accent)] shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[var(--foreground)] uppercase text-[10px]">
                    {e.action} · {e.entity_type}
                  </span>
                  <span className="text-[10px] text-[var(--foreground-muted)] font-mono">
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-[var(--foreground-muted)] font-mono text-[11px] truncate">
                  Actor: {e.actor_name || 'System / Oracle'} (ID: {e.actor_id ? e.actor_id.slice(0, 8) : 'ORACLE'})
                </div>
                {e.metadata && (
                  <pre className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[10px] font-mono text-[var(--foreground-muted)] overflow-x-auto">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
