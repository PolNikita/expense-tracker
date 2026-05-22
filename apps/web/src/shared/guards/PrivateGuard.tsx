'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/model/auth-store';

interface PrivateGuardProps {
  children: React.ReactNode;
}

/**
 * Клиентский guard для защищённых роутов ((app) layout group).
 * hasHydrated вызывается только в useEffect (client-side), чтобы
 * избежать ошибки "Cannot read properties of undefined" при SSR.
 */
export function PrivateGuard({ children }: PrivateGuardProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Уже гидрировался до монтирования компонента
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    // Подписываемся на завершение гидрации
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace('/login');
    }
  }, [accessToken, hydrated, router]);

  if (!hydrated) return null;
  if (!accessToken) return null;

  return <>{children}</>;
}
