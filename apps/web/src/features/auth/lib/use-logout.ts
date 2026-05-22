'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/model/auth-store';

export function useLogout() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  return () => {
    clear();
    router.replace('/login');
  };
}
