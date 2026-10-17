'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lock,
  Cpu,
  Coins,
  FileCheck2,
  Code2,
  Terminal,
  ExternalLink,
  Zap,
  Layers,
  Scale,
  Sparkles,
  Fingerprint,
  Wallet,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { WalletLoginButton } from '@/components/wallet-login-button';
import { ARC_TESTNET } from '@/lib/arc-config';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'approved' | 'remediation'>('approved');

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--accent)] selection:text-[var(--accent-foreground)]">
      {/* 1. Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--background)]/85 border-b border-[var(--surface-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-mono font-black text-sm shadow-sm shadow-[#A8DE2E]/20">
                M
              </div>
              <span className="font-mono text-lg font-bold tracking-tight">MISTHOS</span>
              <span className="hidden sm:inline-flex text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--foreground-muted)] border border-[var(--surface-border)]">
                Arc Testnet
              </span>
            </Link>

            <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-[var(--foreground-muted)]">
              <a href="#product" className="hover:text-[var(--foreground)] transition-colors">
                Product
              </a>
              <a href="#how-it-works" className="hover:text-[var(--foreground)] transition-colors">
                How It Works
              </a>
              <a href="#demo" className="hover:text-[var(--foreground)] transition-colors">
                Oracle Simulator
              </a>
              <a href="#security" className="hover:text-[var(--foreground)] transition-colors">
                Security
              </a>
              <a href="#architecture" className="hover:text-[var(--foreground)] transition-colors">
                Architecture
              </a>
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            
            {/* Direct Wallet Login in Navbar */}
            <div className="hidden sm:block">
              <WalletLoginButton variant="compact" />
            </div>

            <Link
              href="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-32 border-b border-[var(--surface-border)]">
        {/* Subtle background glow effect */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#A8DE2E]/5 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-xs font-mono font-medium text-[var(--foreground)] animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
              <span>Settled natively on Arc in USDC · Sub-second Finality</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Work verified.{' '}
              <span className="text-[var(--accent)] underline decoration-[var(--accent)] decoration-wavy decoration-2">
                Payments earned.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-[var(--foreground-muted)] leading-relaxed max-w-2xl mx-auto">
              Milestone escrow that turns verifiable work into programmable USDC payments on Arc. Freelancers ship code, autonomous dual AI agents verify deliverables, and smart contracts settle instantly.
            </p>

            {/* Direct Web3 Authentication CTA */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <div className="w-full sm:w-auto flex-1">
                <WalletLoginButton variant="primary" />
              </div>
              <Link
                href="/signup"
                className="w-full sm:w-auto btn-secondary px-5 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center space-x-2"
              >
                <span>Email Register</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex items-center justify-center space-x-6 text-xs text-[var(--foreground-muted)] font-mono pt-2">
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>1-Click Wallet Auth</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>No Floating Point Error</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>EIP-712 Replay Safe</span>
              </span>
            </div>
          </div>

          {/* Animated Hero Visual: Escrow Pipeline */}
          <div className="mt-14 max-w-5xl mx-auto">
            <div className="relative group rounded-2xl overflow-hidden border border-[var(--surface-border)] bg-black/40 shadow-2xl shadow-[#A8DE2E]/5 transition-all duration-300 hover:border-[var(--accent)]/40">
              <div className="relative aspect-[16/9] w-full bg-neutral-950 overflow-hidden">
                {/* Animated grid backdrop */}
                <div
                  className="absolute inset-0 opacity-[0.13]"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(199,243,107,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(199,243,107,0.35) 1px, transparent 1px)',
                    backgroundSize: '44px 44px',
                    animation: 'misthos-grid-pan 14s linear infinite',
                  }}
                />
                {/* Glow pulse center */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-3xl opacity-20"
                  style={{
                    background: 'radial-gradient(circle, #A8DE2E 0%, transparent 70%)',
                    animation: 'misthos-glow 5s ease-in-out infinite',
                  }}
                />

                {/* Animated pipeline: three nodes with travelling pulse */}
                <div className="absolute inset-0 flex items-center justify-center px-6 sm:px-14">
                  <div className="relative w-full max-w-2xl">
                    {/* connector line */}
                    <div className="absolute top-1/2 left-[12%] right-[12%] h-px -translate-y-1/2 bg-gradient-to-r from-[#A8DE2E]/10 via-[#A8DE2E]/50 to-[#A8DE2E]/10" />
                    {/* travelling pulse along the line */}
                    <div
                      className="absolute top-1/2 left-[12%] h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#A8DE2E] shadow-[0_0_12px_2px_rgba(199,243,107,0.9)]"
                      style={{ animation: 'misthos-travel 4.5s ease-in-out infinite' }}
                    />

                    <div className="relative grid grid-cols-3 gap-2">
                      {/* Node 1: Symbolon */}
                      <div className="flex flex-col items-center space-y-2 text-center" style={{ animation: 'misthos-node 4.5s ease-in-out infinite' }}>
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-900 border border-[#A8DE2E]/40 flex items-center justify-center shadow-[0_0_20px_rgba(199,243,107,0.15)]">
                          <Lock className="w-6 h-6 text-[#A8DE2E]" />
                        </div>
                        <div className="text-[10px] font-mono text-[#A8DE2E] uppercase tracking-wider">Symbolon</div>
                        <div className="text-[10px] text-neutral-500 font-mono hidden sm:block">escrow locked</div>
                      </div>

                      {/* Node 2: Oracle */}
                      <div className="flex flex-col items-center space-y-2 text-center" style={{ animation: 'misthos-node 4.5s ease-in-out 1.5s infinite' }}>
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-900 border border-[#A8DE2E]/40 flex items-center justify-center shadow-[0_0_20px_rgba(199,243,107,0.15)]">
                          <Cpu className="w-6 h-6 text-[#A8DE2E]" />
                        </div>
                        <div className="text-[10px] font-mono text-[#A8DE2E] uppercase tracking-wider">Oracle</div>
                        <div className="text-[10px] text-neutral-500 font-mono hidden sm:block">dual-agent verify</div>
                      </div>

                      {/* Node 3: Settlement */}
                      <div className="flex flex-col items-center space-y-2 text-center" style={{ animation: 'misthos-node 4.5s ease-in-out 3s infinite' }}>
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-900 border border-[#A8DE2E]/40 flex items-center justify-center shadow-[0_0_20px_rgba(199,243,107,0.15)]">
                          <Coins className="w-6 h-6 text-[#A8DE2E]" />
                        </div>
                        <div className="text-[10px] font-mono text-[#A8DE2E] uppercase tracking-wider">Settlement</div>
                        <div className="text-[10px] text-neutral-500 font-mono hidden sm:block">USDC released</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Live Badge Overlay */}
                <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-[#A8DE2E]/30 text-xs font-mono text-[#A8DE2E]">
                  <span className="w-2 h-2 rounded-full bg-[#A8DE2E] animate-ping" />
                  <span>LIVE ESCROW: #TRX-81745</span>
                </div>

                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-neutral-700 text-xs font-mono text-white">
                  <span>CHAIN ID: 5042002</span>
                </div>

                {/* Keyframes (scoped to this visual) */}
                <style jsx>{`
                  @keyframes misthos-grid-pan {
                    0% { background-position: 0 0; }
                    100% { background-position: 44px 44px; }
                  }
                  @keyframes misthos-glow {
                    0%, 100% { opacity: 0.12; transform: translate(-50%, -50%) scale(0.9); }
                    50% { opacity: 0.28; transform: translate(-50%, -50%) scale(1.12); }
                  }
                  @keyframes misthos-travel {
                    0% { left: 12%; opacity: 0; }
                    8% { opacity: 1; }
                    88% { left: 88%; opacity: 1; }
                    100% { left: 88%; opacity: 0; }
                  }
                  @keyframes misthos-node {
                    0%, 22%, 100% { transform: translateY(0); opacity: 0.85; }
                    8%, 14% { transform: translateY(-6px); opacity: 1; }
                  }
                `}</style>
              </div>

              {/* Bottom Interactive Lifecycle Ribbon */}
              <div className="bg-[var(--surface)] border-t border-[var(--surface-border)] p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[var(--accent)] uppercase font-semibold">01 · Deposit</div>
                  <div className="text-xs font-bold">Client Funds Escrow</div>
                  <div className="text-[11px] text-[var(--foreground-muted)]">Native 6-decimal USDC locked</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[var(--accent)] uppercase font-semibold">02 · Deliverable</div>
                  <div className="text-xs font-bold">Contractor Pushes PR</div>
                  <div className="text-[11px] text-[var(--foreground-muted)]">Frozen commit SHA & tests</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[var(--accent)] uppercase font-semibold">03 · Oracle</div>
                  <div className="text-xs font-bold">Dual-Agent Evaluation</div>
                  <div className="text-[11px] text-[var(--foreground-muted)]">AST scan & EIP-712 proof</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-green-400 uppercase font-semibold">04 · Settlement</div>
                  <div className="text-xs font-bold">Contract Pays Out</div>
                  <div className="text-[11px] text-[var(--foreground-muted)]">Sub-second Arc settlement</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Value Propositions */}
      <section id="product" className="py-20 border-b border-[var(--surface-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--accent)] font-semibold">
              Fintech Precision
            </h2>
            <h3 className="text-3xl font-bold tracking-tight">
              Designed for serious engineering teams & autonomous treasuries
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card-misthos p-6 space-y-3 group hover:border-[var(--accent)]/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[var(--surface-elevated)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-black transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold">Funded Milestone Escrow</h4>
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                Funds are committed upfront in smart contracts on Arc. Neither party can arbitrarily seize or alter the escrow conditions once locked.
              </p>
            </div>

            <div className="card-misthos p-6 space-y-3 group hover:border-[var(--accent)]/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[var(--surface-elevated)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-black transition-colors">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold">Evidence-Based Oracle</h4>
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                Evaluates pull requests, test logs, Cypress reports, and security scans against frozen milestone acceptance criteria with dual-agent isolation.
              </p>
            </div>

            <div className="card-misthos p-6 space-y-3 group hover:border-[var(--accent)]/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[var(--surface-elevated)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-black transition-colors">
                <Scale className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold">Actionable Remediation</h4>
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                Failed checks do not simply reject work—they generate reproducible diagnostic logs and itemized instructions for the contractor to fix and resubmit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Interactive Live Simulator: Dual-Agent Decision Engine */}
      <section id="demo" className="py-20 border-b border-[var(--surface-border)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--accent)] font-semibold">
              Live Oracle Interactive Simulator
            </h2>
            <h3 className="text-3xl font-bold tracking-tight">
              Test Agent A & Agent B Evaluation Logic
            </h3>
            <p className="text-sm text-[var(--foreground-muted)]">
              Toggle between a compliant deliverable and a failing deliverable to observe how the Dual-Agent engine produces verifiable EIP-712 attestations or itemized remediation feedback.
            </p>
          </div>

          <div className="max-w-4xl mx-auto card-misthos p-6 sm:p-8 bg-[var(--background)]">
            {/* Interactive Tab Switcher */}
            <div className="flex items-center justify-center space-x-3 mb-8">
              <button
                onClick={() => setActiveTab('approved')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center space-x-2 transition-all ${
                  activeTab === 'approved'
                    ? 'bg-[#A8DE2E] text-black shadow-md shadow-[#A8DE2E]/20'
                    : 'bg-[var(--surface-elevated)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulate Compliant PR (Passed)</span>
              </button>

              <button
                onClick={() => setActiveTab('remediation')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center space-x-2 transition-all ${
                  activeTab === 'remediation'
                    ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                    : 'bg-[var(--surface-elevated)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Simulate Failing PR (Remediation)</span>
              </button>
            </div>

            {activeTab === 'approved' ? (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-emerald-300">Deliverable Approved · Confidence: 100%</div>
                      <div className="text-[11px] text-emerald-400/80">Unit tests (14/14 passed) · Zero AST security vulnerabilities found.</div>
                    </div>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    READY FOR SETTLEMENT
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--surface-border)] space-y-2">
                    <div className="text-[var(--foreground-muted)] uppercase text-[10px] font-bold">Agent A (Artifact Evaluator)</div>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>AST Scanner:</span><span className="text-emerald-400 font-bold">PASSED (0 alerts)</span></div>
                      <div className="flex justify-between"><span>Criteria Match:</span><span className="text-emerald-400 font-bold">100% matched</span></div>
                      <div className="flex justify-between"><span>Commit SHA:</span><span>7f3c9a1bc40...</span></div>
                      <div className="flex justify-between"><span>Policy Hash:</span><span>0x8a92eec4b2f...</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--surface-border)] space-y-2">
                    <div className="text-[var(--foreground-muted)] uppercase text-[10px] font-bold">Agent B (Treasury Signer)</div>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>Policy Check:</span><span className="text-emerald-400 font-bold">VERIFIED</span></div>
                      <div className="flex justify-between"><span>Cap Check:</span><span>500.00 USDC &lt;= 500.00</span></div>
                      <div className="flex justify-between"><span>EIP-712 Sig:</span><span className="text-[var(--accent)] font-bold">0x9acdd55cd5...</span></div>
                      <div className="flex justify-between"><span>Arc Finality:</span><span>400ms confirmation</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-red-300">Deliverable Verification Failed · Confidence: 95%</div>
                      <div className="text-[11px] text-red-400/80">Funds remain locked in escrow. Actionable remediation generated.</div>
                    </div>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded bg-red-500/20 text-red-300 font-bold">
                    REMEDIATION REQUIRED
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--surface-border)] space-y-3 font-mono text-xs">
                  <div className="text-red-400 font-bold text-xs">Actionable Remediation Report:</div>
                  <ul className="space-y-2 text-[var(--foreground-muted)] text-[11px]">
                    <li className="flex items-start space-x-2">
                      <span className="text-red-400 font-bold">1.</span>
                      <span><strong>High-Risk Security Alert:</strong> Potential hardcoded EVM private key or secret found in deliverable payload. Remove all raw 64-character hex keys and use environment variables.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-red-400 font-bold">2.</span>
                      <span><strong>Unsatisfied Acceptance Criterion:</strong> Missing mandatory test suite execution proof for milestone requirements.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-yellow-400 font-bold">3.</span>
                      <span><strong>Next Action:</strong> Revise your pull request branch, push a clean commit, and click "Resubmit Verification".</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Architectural Deep-Dive & Dual-Agent Engine */}
      <section id="architecture" className="py-20 border-b border-[var(--surface-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-[var(--accent)] font-semibold">
                <Fingerprint className="w-4 h-4" />
                <span>Dual AI Agent Engine</span>
              </div>
              <h3 className="text-3xl font-bold tracking-tight">
                Cryptographic trust, not arbitrary administrative authority
              </h3>
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                Misthos splits responsibilities across two autonomous agents. Agent A analyzes source code artifacts, type checks, and AST vulnerabilities. Agent B verifies corporate treasury invariants and issues an EIP-712 structured data stamp that unlocks smart contract settlement on Arc.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                  <p className="text-xs text-[var(--foreground)]">
                    <strong className="font-semibold">EIP-712 Typed Attestations:</strong> Verifies domain separator, signer authorization, expiry, and replay-protected nonces before release.
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                  <p className="text-xs text-[var(--foreground)]">
                    <strong className="font-semibold">Pull Payment Pattern:</strong> Escrow cannot be drained in duplicate; milestones are locked to their agreed payment caps.
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                  <p className="text-xs text-[var(--foreground)]">
                    <strong className="font-semibold">Sub-Second Arc Settlement:</strong> Settle milestone releases directly on Circle's Arc L1 network using native USDC.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <WalletLoginButton className="max-w-xs" />
              </div>
            </div>

            {/* Animated Architecture Visual: Dual-Agent Oracle Flow */}
            <div className="relative rounded-2xl overflow-hidden border border-[var(--surface-border)] bg-black shadow-xl shadow-[#A8DE2E]/5">
              <div className="relative aspect-[16/9] w-full bg-neutral-950 overflow-hidden">
                {/* subtle grid */}
                <div
                  className="absolute inset-0 opacity-[0.1]"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(199,243,107,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(199,243,107,0.3) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                    animation: 'misthos-grid-pan2 18s linear infinite',
                  }}
                />

                <div className="absolute inset-0 flex flex-col items-center justify-center px-5 sm:px-10 py-6">
                  {/* Agent A card */}
                  <div
                    className="w-full max-w-md rounded-xl border border-[#A8DE2E]/40 bg-neutral-900/90 backdrop-blur px-4 py-3 flex items-center space-x-3 shadow-[0_0_24px_rgba(199,243,107,0.12)]"
                    style={{ animation: 'misthos-agent 6s ease-in-out infinite' }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#A8DE2E]/15 border border-[#A8DE2E]/30 flex items-center justify-center shrink-0">
                      <Code2 className="w-4 h-4 text-[#A8DE2E]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono font-bold text-[#A8DE2E]">AGENT A · ARTIFACT EVALUATION</div>
                      <div className="text-[10px] font-mono text-neutral-400 truncate">
                        AST scan · test suite · criteria match
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-[#A8DE2E] animate-pulse shrink-0" />
                  </div>

                  {/* connector beam A -> B */}
                  <div className="relative h-10 w-px my-1">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#A8DE2E]/10 via-[#A8DE2E]/60 to-[#A8DE2E]/10" />
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#A8DE2E] shadow-[0_0_10px_2px_rgba(199,243,107,0.9)]"
                      style={{ animation: 'misthos-drop 6s ease-in-out infinite' }}
                    />
                  </div>

                  {/* Agent B card */}
                  <div
                    className="w-full max-w-md rounded-xl border border-[#A8DE2E]/40 bg-neutral-900/90 backdrop-blur px-4 py-3 flex items-center space-x-3 shadow-[0_0_24px_rgba(199,243,107,0.12)]"
                    style={{ animation: 'misthos-agent 6s ease-in-out 3s infinite' }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#A8DE2E]/15 border border-[#A8DE2E]/30 flex items-center justify-center shrink-0">
                      <Fingerprint className="w-4 h-4 text-[#A8DE2E]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono font-bold text-[#A8DE2E]">AGENT B · TREASURY SIGNER</div>
                      <div className="text-[10px] font-mono text-neutral-400 truncate">
                        invariant checks · EIP-712 attestation
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  </div>

                  {/* connector beam B -> signature */}
                  <div className="relative h-10 w-px my-1">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#A8DE2E]/10 via-emerald-400/60 to-emerald-400/10" />
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.9)]"
                      style={{ animation: 'misthos-drop 6s ease-in-out 3s infinite' }}
                    />
                  </div>

                  {/* signature output chip */}
                  <div
                    className="rounded-lg border border-emerald-400/40 bg-emerald-950/40 px-4 py-2 font-mono text-[11px] text-emerald-300 flex items-center space-x-2"
                    style={{ animation: 'misthos-sig 6s ease-in-out infinite' }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>0xEIP712…ATTESTATION_SIGNED</span>
                  </div>
                </div>

                <style jsx>{`
                  @keyframes misthos-grid-pan2 {
                    0% { background-position: 0 0; }
                    100% { background-position: 36px 36px; }
                  }
                  @keyframes misthos-agent {
                    0%, 30%, 100% { box-shadow: 0 0 12px rgba(199,243,107,0.08); border-color: rgba(199,243,107,0.35); }
                    12%, 20% { box-shadow: 0 0 28px rgba(199,243,107,0.3); border-color: rgba(199,243,107,0.8); }
                  }
                  @keyframes misthos-drop {
                    0% { top: 0; opacity: 0; }
                    10% { opacity: 1; }
                    45% { top: calc(100% - 6px); opacity: 1; }
                    55%, 100% { top: calc(100% - 6px); opacity: 0; }
                  }
                  @keyframes misthos-sig {
                    0%, 55%, 100% { opacity: 0.55; transform: scale(0.98); }
                    62%, 90% { opacity: 1; transform: scale(1); }
                  }
                `}</style>
              </div>
              <div className="p-4 bg-[var(--surface)] border-t border-[var(--surface-border)] flex items-center justify-between font-mono text-xs">
                <span className="text-[var(--accent)] font-semibold">● DUAL AGENT ORACLE ACTIVE</span>
                <span className="text-[var(--foreground-muted)]">EIP-712 STAMPED</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="py-12 bg-[var(--surface)] text-[var(--foreground-muted)] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 rounded bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-mono font-black text-xs">
              M
            </div>
            <span className="font-mono font-bold text-sm text-[var(--foreground)]">MISTHOS</span>
            <span>— Verifiable Deliverable Oracle & Continuous Milestone Escrow</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link href="/login" className="hover:text-[var(--foreground)] transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-[var(--foreground)] transition-colors">
              Register
            </Link>
            <a
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--foreground)] transition-colors inline-flex items-center space-x-1"
            >
              <span>Arc Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            &copy; {new Date().getFullYear()} Misthos. Deployed on Arc Testnet.
          </div>
        </div>
      </footer>
    </div>
  );
}

