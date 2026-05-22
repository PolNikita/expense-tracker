'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Category, PaginatedResponse, Expense } from '@expense-tracker/types';
import { expensesApi, categoriesApi, ExpensesTable, ExpensesPagination } from '@/features/expenses';
import { ApiError } from '@/shared/api/errors';

const PAGE_SIZE = 10;

export function RecentExpensesSection() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<Expense> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => null);
  }, []);

  useEffect(() => {
    setLoading(true);
    expensesApi
      .list({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then(setData)
      .catch((error) => {
        const message = error instanceof ApiError ? error.message : 'Ошибка загрузки транзакций';
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Последние транзакции</h2>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Загрузка...</p>
      ) : (
        <>
          <ExpensesTable expenses={data?.items ?? []} categories={categories} />
          {data && (
            <ExpensesPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.meta.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
