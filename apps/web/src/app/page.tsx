import { redirect } from 'next/navigation';

/** Root `/` — перенаправляет на /dashboard.
 *  PrivateGuard в (app)/layout.tsx при отсутствии токена редиректит на /login. */
export default function HomePage() {
  redirect('/dashboard');
}
