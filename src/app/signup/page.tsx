'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, Lock, Mail, User, Wallet, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { WalletLoginButton } from '@/components/wallet-login-button';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'client' | 'contractor'>('client');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          walletAddress: walletAddress.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      router.push('/app');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error creating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--background)] px-4 py-8">
      {/* Top Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 text-xl font-bold tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-mono font-black text-sm">
            M
          </div>
          <span className="font-mono">MISTHOS</span>
        </Link>
        <div className="flex items-center space-x-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* Main Form */}
      <div className="w-full max-w-lg mx-auto my-auto">
        <div className="card-misthos p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Create your Misthos account</h1>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              Start funding or earning with verifiable milestone escrow on Arc.
            </p>
          </div>

          {/* 1-Click Web3 Direct Wallet Login / Profile Creation */}
          <div className="mb-6">
            <WalletLoginButton role={role} />
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--surface-border)]"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--surface)] px-2.5 text-[var(--foreground-muted)] font-mono text-[10px] tracking-wider">
                Or register with email
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-2">
                I want to use Misthos as a
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('client')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    role === 'client'
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] font-medium text-[var(--foreground)] ring-1 ring-[var(--accent)]'
                      : 'border-[var(--surface-border)] hover:bg-[var(--surface-elevated)] text-[var(--foreground-muted)]'
                  }`}
                >
                  <div className="font-semibold text-sm">Client / Employer</div>
                  <div className="text-xs opacity-75 mt-0.5">I want to fund milestones & verify deliverables</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('contractor')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    role === 'contractor'
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] font-medium text-[var(--foreground)] ring-1 ring-[var(--accent)]'
                      : 'border-[var(--surface-border)] hover:bg-[var(--surface-elevated)] text-[var(--foreground-muted)]'
                  }`}
                >
                  <div className="font-semibold text-sm">Contractor / Dev</div>
                  <div className="text-xs opacity-75 mt-0.5">I want to submit work & receive instant payouts</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Full Name / Organization
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-[var(--foreground-muted)]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Wright or Acme Studio"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--foreground)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-[var(--foreground-muted)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--foreground)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Password (min 8 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-[var(--foreground-muted)]" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--foreground)]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
                  EVM Wallet Address (Optional)
                </label>
                <span className="text-xs text-[var(--foreground-muted)]">Can connect later</span>
              </div>
              <div className="relative">
                <Wallet className="w-4 h-4 absolute left-3 top-3 text-[var(--foreground-muted)]" />
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x71C...3a92"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--foreground)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 text-sm font-semibold mt-4 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--surface-border)] text-center text-xs text-[var(--foreground-muted)]">
            <span>Already registered? </span>
            <Link href="/login" className="font-semibold text-[var(--foreground)] hover:underline">
              Sign in to your account
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-[var(--foreground-muted)]">
          <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
          <span>Non-custodial smart escrow with EIP-712 cryptographic oracle attestations</span>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto text-center text-xs text-[var(--foreground-muted)]">
        &copy; {new Date().getFullYear()} Misthos. Settled on Arc in USDC.
      </div>
    </div>
  );
}
