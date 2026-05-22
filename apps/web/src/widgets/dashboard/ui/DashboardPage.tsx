'use client';

import { useAuthStore } from '@/features/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          Привет, {user?.name ?? 'Пользователь'} 👋
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Вы вошли как{' '}
          <span className="text-foreground font-medium">{user?.email}</span>.
        </p>
      </CardContent>
    </Card>
  );
}
