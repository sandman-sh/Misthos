'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Send,
  Loader2,
  User,
  Zap,
  ShieldCheck,
  FileSearch,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: { type: string; summary: string; data?: any }[];
  llmPowered?: boolean;
}

const SUGGESTIONS = [
  'Show my escrow portfolio',
  'Any deliverables waiting for verification?',
  'Run verification on the pending milestone',
  'Explain the latest oracle verdict',
  'Show recent settlement transactions',
];

export default function MizoPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "I'm MIZO — the autonomous agent inside Misthos. I watch your escrows, run the dual-agent oracle on contractor deliverables, and explain verdicts in plain terms. Ask me to check your portfolio or verify a pending deliverable.",
      llmPowered: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || thinking) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setThinking(true);

    try {
      const res = await fetch('/api/app/mizo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'MIZO request failed');

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, actions: data.actions || [], llmPowered: data.llmPowered },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Something went wrong: ${e.message}`, llmPowered: false },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-[#A8DE2E]/20">
            <Bot className="w-5 h-5 text-[var(--accent-foreground)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center space-x-2">
              <span>MIZO</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--foreground)] border border-[var(--accent-border)]">
                AUTONOMOUS AGENT
              </span>
            </h1>
            <p className="text-xs text-[var(--foreground-muted)]">
              Oracle operator for your escrow portfolio on Arc Testnet
            </p>
          </div>
        </div>
        <Link
          href="/app/settings"
          className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] font-mono"
        >
          Configure LLM &rarr;
        </Link>
      </div>

      {/* Chat area */}
      <div className="flex-1 card-misthos p-4 overflow-y-auto space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start space-x-2.5 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  m.role === 'user'
                    ? 'bg-[var(--surface-elevated)] border border-[var(--surface-border)]'
                    : 'bg-[var(--accent)]'
                }`}
              >
                {m.role === 'user' ? (
                  <User className="w-3.5 h-3.5 text-[var(--foreground)]" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-[var(--accent-foreground)]" />
                )}
              </div>
              <div className="space-y-2">
                <div
                  className={`px-3.5 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-[var(--accent)] text-[var(--accent-foreground)] font-medium'
                      : 'bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--foreground)]'
                  }`}
                >
                  {m.content}
                </div>

                {/* Action cards */}
                {m.actions && m.actions.length > 0 && (
                  <div className="space-y-1.5">
                    {m.actions.map((a, ai) => (
                      <div
                        key={ai}
                        className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--accent-border)] text-[11px] font-mono flex items-start space-x-2"
                      >
                        {a.type === 'verification' ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                        ) : a.type === 'pending' ? (
                          <FileSearch className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="text-[var(--foreground)] font-semibold">{a.summary}</span>
                          {a.data?.verdict && (
                            <span className="block text-[var(--foreground-muted)] mt-0.5">
                              Confidence {a.data.confidence}% · Treasury {a.data.treasuryApproved ? 'approved' : 'blocked'} · Attestation {a.data.attestationSigned ? 'signed' : 'not issued'}
                            </span>
                          )}
                          {a.data?.transactions?.slice(0, 3).map((t: any, ti: number) => (
                            <a key={ti} href={t.explorer} target="_blank" rel="noreferrer" className="block text-[var(--accent)] hover:underline mt-0.5">
                              {t.type} · ${t.amountUSDC} USDC <ExternalLink className="w-2.5 h-2.5 inline" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {m.role === 'assistant' && m.llmPowered === false && (
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono text-amber-500">
                    <AlertTriangle className="w-3 h-3" />
                    <span>LLM not connected — limited mode</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-[var(--accent-foreground)]" />
              </div>
              <div className="px-3.5 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-xs text-[var(--foreground-muted)] flex items-center space-x-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                <span>MIZO is reasoning &amp; executing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            disabled={thinking}
            className="text-[11px] px-3 py-1.5 rounded-full border border-[var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50 flex items-center space-x-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>{s}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center space-x-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask MIZO to verify a deliverable, inspect escrows, or explain a verdict..."
          className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={thinking || !input.trim()}
          className="btn-primary p-2.5 rounded-xl disabled:opacity-50"
        >
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
