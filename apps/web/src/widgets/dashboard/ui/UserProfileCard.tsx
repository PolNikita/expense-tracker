'use client';

import { useAuthStore } from '@/features/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

export function UserProfileCard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Привет, {user.name}!</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Вы вошли как{' '}
          <span className="font-medium text-foreground">{user.email}</span>
        </p>
      </CardContent>
    </Card>
  );
}
