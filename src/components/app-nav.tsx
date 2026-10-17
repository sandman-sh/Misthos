'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  FileText,
  CheckSquare,
  Cpu,
  Receipt,
  Activity,
  Settings,
  LogOut,
  Wallet,
  AlertTriangle,
  ChevronDown,
  User,
  PlusCircle,
  Menu,
  X,
} from 'lucide-react';
import { useWallet } from '@/components/wallet-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { ARC_TESTNET, formatAddress } from '@/lib/arc-config';

interface AppNavProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    wallet_address?: string | null;
  };
}

export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    address,
    isCorrectNetwork,
    isConnecting,
    usdcBalance,
    connectWallet,
    disconnectWallet,
    switchToArcTestnet,
  } = useWallet();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);

  const navItems = [
    { name: 'Overview', href: '/app', icon: LayoutDashboard },
    { name: 'MIZO Agent', href: '/app/mizo', icon: Bot },
    { name: 'Contracts', href: '/app/contracts', icon: FileText },
    { name: 'Verification', href: '/app/verification', icon: Cpu },
    { name: 'Transactions', href: '/app/transactions', icon: Receipt },
    { name: 'Activity', href: '/app/activity', icon: Activity },
    { name: 'Settings', href: '/app/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-[var(--surface-border)] bg-[var(--surface)] sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg border border-[var(--surface-border)]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/app" className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-[var(--accent)] flex items-center justify-center font-mono font-bold text-xs text-[var(--accent-foreground)]">
              M
            </div>
            <span className="font-mono font-bold text-sm tracking-tight">MISTHOS</span>
          </Link>
        </div>

        <div className="flex items-center space-x-2">
          <ThemeToggle />
          {address ? (
            <span className="text-xs font-mono px-2 py-1 rounded bg-[var(--surface-elevated)] border border-[var(--surface-border)]">
              {formatAddress(address)}
            </span>
          ) : (
            <button
              onClick={connectWallet}
              className="btn-primary text-xs px-2.5 py-1 rounded-md font-semibold"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Main Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[var(--surface)] border-r border-[var(--surface-border)] flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-6">
          {/* Logo and Brand */}
          <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
            <Link href="/app" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center font-mono font-black text-sm text-[var(--accent-foreground)] shadow-sm">
                M
              </div>
              <div>
                <div className="font-mono font-bold tracking-tight text-sm">MISTHOS</div>
                <div className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider">
                  Oracle & Escrow
                </div>
              </div>
            </Link>
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
          </div>

          {/* New Contract Quick Action */}
          <Link
            href="/app/contracts/new"
            onClick={() => setMobileOpen(false)}
            className="w-full btn-primary py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-xs font-bold shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Escrow Contract</span>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm'
                      : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Network Status, Wallet & User Profile */}
        <div className="p-4 border-t border-[var(--surface-border)] space-y-3 bg-[var(--background)]/50">
          {/* Network Indicator */}
          <div className="p-2.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] text-xs space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[var(--foreground-muted)]">
              <span>Network</span>
              {address && (
                isCorrectNetwork ? (
                  <span className="flex items-center space-x-1 text-green-500 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>Arc Testnet</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-[var(--danger)] font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Wrong Chain</span>
                  </span>
                )
              )}
              {!address && <span className="text-[var(--foreground-muted)]">Not Connected</span>}
            </div>

            {address && !isCorrectNetwork && (
              <button
                onClick={switchToArcTestnet}
                className="w-full mt-1.5 py-1 px-2 rounded bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-[10px] font-semibold hover:opacity-80 transition-opacity"
              >
                Switch to Arc (5042002)
              </button>
            )}

            {address && isCorrectNetwork && (
              <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
                <span className="text-[var(--foreground-muted)]">USDC Balance:</span>
                <span className="font-bold text-[var(--foreground)]">{usdcBalance}</span>
              </div>
            )}
          </div>

          {/* Wallet Connector Button */}
          {!address ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="w-full btn-secondary py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-xs font-semibold"
            >
              <Wallet className="w-4 h-4 text-[var(--accent)]" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Arc Wallet'}</span>
            </button>
          ) : (
            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-elevated)] text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                <span className="font-mono text-xs">{formatAddress(address)}</span>
              </div>
              <button
                onClick={disconnectWallet}
                title="Disconnect Wallet"
                className="text-[10px] text-[var(--foreground-muted)] hover:text-[var(--danger)]"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Current User Profile & Sign Out */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[var(--surface-elevated)] border border-[var(--surface-border)] flex items-center justify-center font-bold text-xs text-[var(--foreground)]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold truncate leading-tight">{user.name}</div>
                <div className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider">
                  {user.role}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-md hover:bg-[var(--surface-elevated)] text-[var(--foreground-muted)] hover:text-[var(--danger)] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-xs"
        />
      )}
    </>
  );
}
