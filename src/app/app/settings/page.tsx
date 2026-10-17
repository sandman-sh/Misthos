'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Cpu,
  User,
} from 'lucide-react';
import { useWallet } from '@/components/wallet-provider';
import { ARC_TESTNET, formatAddress } from '@/lib/arc-config';
import { AiAgentSettings } from '@/components/ai-agent-settings';

export default function SettingsPage() {
  const { address, isCorrectNetwork, usdcBalance, connectWallet, switchToArcTestnet } = useWallet();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((d) => {
        if (d.user) setProfile(d.user);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System & Account Settings</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Connected wallet identity, Arc Testnet parameters, and Oracle cryptographic keys.
        </p>
      </div>

      {/* User Profile Card */}
      <div className="card-misthos p-6 space-y-4">
        <h2 className="text-base font-bold flex items-center space-x-2">
          <User className="w-4 h-4 text-[var(--accent)]" />
          <span>User Profile</span>
        </h2>

        {profile ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)]">
              <span className="text-[10px] text-[var(--foreground-muted)] uppercase block">Name</span>
              <span className="font-bold text-[var(--foreground)]">{profile.name}</span>
            </div>
            <div className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)]">
              <span className="text-[10px] text-[var(--foreground-muted)] uppercase block">Email</span>
              <span className="font-bold text-[var(--foreground)]">{profile.email}</span>
            </div>
            <div className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)]">
              <span className="text-[10px] text-[var(--foreground-muted)] uppercase block">Role</span>
              <span className="font-bold text-[var(--foreground)] uppercase">{profile.role}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--foreground-muted)]">Loading profile...</div>
        )}
      </div>

      {/* Connected EVM Wallet Card */}
      <div className="card-misthos p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
          <h2 className="text-base font-bold flex items-center space-x-2">
            <Wallet className="w-4 h-4 text-[var(--accent)]" />
            <span>Connected EVM Wallet</span>
          </h2>
          {address ? (
            <span className="text-xs font-mono font-bold text-green-500 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Active</span>
            </span>
          ) : (
            <button
              onClick={connectWallet}
              className="btn-primary py-1 px-3 rounded text-xs font-semibold"
            >
              Connect Wallet
            </button>
          )}
        </div>

        {address ? (
          <div className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)]">
                <span className="text-[10px] text-[var(--foreground-muted)] uppercase block">Address</span>
                <span className="font-bold text-[var(--foreground)] break-all">{address}</span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)]">
                <span className="text-[10px] text-[var(--foreground-muted)] uppercase block">USDC Balance (Arc)</span>
                <span className="font-bold text-[var(--foreground)] text-sm">{usdcBalance} USDC</span>
              </div>
            </div>

            {!isCorrectNetwork && (
              <div className="p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-xs text-[var(--danger)] flex items-center justify-between">
                <span>Wallet is on the wrong network. Arc Testnet required.</span>
                <button
                  onClick={switchToArcTestnet}
                  className="btn-primary py-1 px-3 rounded text-xs font-semibold"
                >
                  Switch to Arc
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--foreground-muted)]">
            No wallet connected. Connect MetaMask or any EVM wallet to execute on-chain escrow deposits and settlements on Arc.
          </p>
        )}
      </div>

      {/* Arc Network & Oracle Configuration */}
      <div className="card-misthos p-6 space-y-4">
        <h2 className="text-base font-bold flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-[var(--accent)]" />
          <span>Arc Testnet & Oracle Specifications</span>
        </h2>

        <div className="space-y-2 text-xs font-mono text-[var(--foreground-muted)]">
          <div className="flex justify-between py-2 border-b border-[var(--surface-border)]">
            <span>Network Name:</span>
            <span className="text-[var(--foreground)] font-bold">{ARC_TESTNET.chainName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--surface-border)]">
            <span>Chain ID:</span>
            <span className="text-[var(--foreground)] font-bold">
              {ARC_TESTNET.chainId} ({ARC_TESTNET.chainIdHex})
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--surface-border)]">
            <span>Native Gas & Currency:</span>
            <span className="text-[var(--foreground)] font-bold">USDC (6 Decimals)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--surface-border)]">
            <span>USDC System Contract:</span>
            <span className="text-[var(--foreground)] font-bold break-all">
              {ARC_TESTNET.contracts.usdc}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--surface-border)]">
            <span>EIP-712 Domain:</span>
            <span className="text-[var(--foreground)] font-bold">
              {ARC_TESTNET.eip712Domain.name} (v{ARC_TESTNET.eip712Domain.version})
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--surface-border)]">
            <span>Arcscan Explorer:</span>
            <a
              href={ARC_TESTNET.blockExplorerUrls[0]}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)] hover:underline inline-flex items-center space-x-1"
            >
              <span>{ARC_TESTNET.blockExplorerUrls[0]}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* AI Agent Engine Configuration */}
      <AiAgentSettings />
    </div>
  );
}
