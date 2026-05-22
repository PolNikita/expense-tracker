'use client';

import { UserProfileCard } from './UserProfileCard';
import { DashboardMenu } from './DashboardMenu';
import { RecentExpensesSection } from './RecentExpensesSection';

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <UserProfileCard />
      <DashboardMenu />
      <RecentExpensesSection />
    </div>
  );
}
