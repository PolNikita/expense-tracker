'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PrivateGuard } from '@/shared/guards/PrivateGuard';
import { useLogout } from '@/features/auth';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Главная' },
  { href: '/expenses', label: 'Расходы' },
  { href: '/categories', label: 'Категории' },
];

function AppTopbar() {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(pathname === item.href && 'bg-muted font-medium')}
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
        <Button variant="outline" size="sm" onClick={logout}>
          Выйти
        </Button>
      </div>
    </header>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateGuard>
      <div className="min-h-screen bg-muted/40">
        <AppTopbar />
        <main className="mx-auto max-w-5xl p-6">{children}</main>
      </div>
    </PrivateGuard>
  );
}
