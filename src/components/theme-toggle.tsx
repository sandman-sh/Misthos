'use client';

import React from 'react';
import { useTheme } from './theme-provider';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors border border-[var(--surface-border)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${className}`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 text-[var(--foreground-muted)]" />
      ) : (
        <Sun className="w-4 h-4 text-[var(--accent)]" />
      )}
    </button>
  );
}
