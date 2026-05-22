import type { ReactNode } from 'react';
import { PublicOnlyGuard } from '@/shared/guards/PublicOnlyGuard';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <PublicOnlyGuard>
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        {children}
      </div>
    </PublicOnlyGuard>
  );
}
