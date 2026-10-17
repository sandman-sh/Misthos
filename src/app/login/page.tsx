'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, Lock, Mail, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { WalletLoginButton } from '@/components/wallet-login-button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      router.push('/app');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
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
            href="/signup"
            className="text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Create account
          </Link>
        </div>
      </div>

      {/* Main Form */}
      <div className="w-full max-w-md mx-auto my-auto">
        <div className="card-misthos p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Sign in to Misthos</h1>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              Access your contracts, verifiable milestones, and Arc escrow treasury.
            </p>
          </div>

          {/* 1-Click Web3 Direct Wallet Login */}
          <div className="mb-6">
            <WalletLoginButton />
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--surface-border)]"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--surface)] px-2.5 text-[var(--foreground-muted)] font-mono text-[10px] tracking-wider">
                Or traditional credentials
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-[var(--foreground-muted)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--foreground)]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-[var(--foreground-muted)]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--foreground)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 text-sm font-semibold mt-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--surface-border)] text-center text-xs text-[var(--foreground-muted)]">
            <span>Don&apos;t have an account yet? </span>
            <Link href="/signup" className="font-semibold text-[var(--foreground)] hover:underline">
              Create one now
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-[var(--foreground-muted)]">
          <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
          <span>Secured with cryptographic session proofs and Arc settlement</span>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto text-center text-xs text-[var(--foreground-muted)]">
        &copy; {new Date().getFullYear()} Misthos. Settled on Arc in USDC.
      </div>
    </div>
  );
}
