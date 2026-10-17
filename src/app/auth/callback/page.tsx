'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Check session and redirect to /app or /login
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) {
          router.replace('/app');
        } else {
          router.replace('/login');
        }
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)] mx-auto" />
        <p className="text-sm text-[var(--foreground-muted)]">Verifying session...</p>
      </div>
    </div>
  );
}
