'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Loader2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useWallet } from './wallet-provider';

interface WalletLoginButtonProps {
  role?: 'client' | 'contractor';
  className?: string;
  variant?: 'primary' | 'secondary' | 'compact';
  onSuccess?: () => void;
}

export function WalletLoginButton({
  role = 'client',
  className = '',
  variant = 'primary',
  onSuccess,
}: WalletLoginButtonProps) {
  const router = useRouter();
  const { loginWithWallet, isConnecting } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleWalletLogin = async () => {
    setError(null);
    try {
      const result = await loginWithWallet(role);
      if (result.success) {
        setSuccess(true);
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/app');
          router.refresh();
        }
      } else {
        setError(result.error || 'Authentication declined.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate wallet.');
    }
  };

  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          onClick={handleWalletLogin}
          disabled={isConnecting || success}
          className={`inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            success
              ? 'bg-[var(--accent)] text-black'
              : 'bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)] shadow-sm'
          } ${className}`}
        >
          {isConnecting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : success ? (
            <ShieldCheck className="w-3.5 h-3.5" />
          ) : (
            <Wallet className="w-3.5 h-3.5" />
          )}
          <span>{isConnecting ? 'Connecting...' : success ? 'Connected!' : 'Connect Wallet'}</span>
        </button>
        {error && <span className="text-[10px] text-red-500 max-w-[200px] truncate">{error}</span>}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <button
        onClick={handleWalletLogin}
        disabled={isConnecting || success}
        className={`w-full group relative flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 ${
          variant === 'primary'
            ? 'bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)] shadow-lg shadow-[#A3D928]/15 hover:shadow-[#A3D928]/25 hover:-translate-y-0.5'
            : 'bg-neutral-900 border border-neutral-700 text-white hover:bg-neutral-800 hover:border-[var(--accent)]/40'
        } ${className}`}
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin text-black" />
        ) : success ? (
          <ShieldCheck className="w-4 h-4 text-black" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5 text-black" />
          </div>
        )}
        <span>
          {isConnecting
            ? 'Connecting...'
            : success
            ? 'Connected!'
            : 'Connect Wallet'}
        </span>
        {!isConnecting && !success && (
          <ArrowRight className="w-4 h-4 text-black/60 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
