import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

const menuItems = [
  {
    href: '/expenses',
    title: 'Транзакции',
    description: 'Учёт расходов',
  },
  {
    href: '/categories',
    title: 'Категории',
    description: 'Управление категориями',
  },
];

export function DashboardMenu() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {menuItems.map((item) => (
        <Link key={item.href} href={item.href}>
          <Card className="cursor-pointer transition-colors hover:bg-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
