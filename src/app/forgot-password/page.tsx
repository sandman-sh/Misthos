'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate real reset link dispatch
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--background)] px-4 py-8">
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 text-xl font-bold tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-mono font-black text-sm">
            M
          </div>
          <span className="font-mono">MISTHOS</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md mx-auto my-auto">
        <div className="card-misthos p-8">
          <Link
            href="/login"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to sign in</span>
          </Link>

          {submitted ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-[var(--success)] mx-auto" />
              <h2 className="text-xl font-bold">Password Reset Dispatched</h2>
              <p className="text-sm text-[var(--foreground-muted)]">
                If an account exists for <span className="font-semibold text-[var(--foreground)]">{email}</span>, you will receive instructions to reset your password.
              </p>
              <Link
                href="/login"
                className="btn-primary inline-block py-2 px-4 rounded-lg text-sm font-semibold mt-4"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Reset Password</h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-6">
                Enter your verified email address and we will issue an authenticated recovery link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5">
                    Account Email
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending instructions...</span>
                    </>
                  ) : (
                    <span>Send Reset Instructions</span>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto text-center text-xs text-[var(--foreground-muted)]">
        &copy; {new Date().getFullYear()} Misthos. Settled on Arc in USDC.
      </div>
    </div>
  );
}
