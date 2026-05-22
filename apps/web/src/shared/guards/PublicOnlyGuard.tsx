'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/model/auth-store';

interface PublicOnlyGuardProps {
  children: React.ReactNode;
}

/**
 * Клиентский guard для публичных auth-роутов ((auth) layout group).
 * Если пользователь уже залогинен — редиректит на /dashboard.
 * hasHydrated вызывается только в useEffect (client-side).
 */
export function PublicOnlyGuard({ children }: PublicOnlyGuardProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace('/dashboard');
    }
  }, [accessToken, hydrated, router]);

  if (!hydrated) return null;
  if (accessToken) return null;

  return <>{children}</>;
}
