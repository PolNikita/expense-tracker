'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Category, PaginatedResponse, Expense } from '@expense-tracker/types';
import { expensesApi, categoriesApi } from '@/features/expenses';
import { CreateExpenseDialog, ExpensesTable, ExpensesPagination } from '@/features/expenses';
import { ApiError } from '@/shared/api/errors';

const PAGE_SIZE = 10;

export function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
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
        const message = error instanceof ApiError ? error.message : 'Ошибка загрузки';
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [page, tick]);

  function refetch() {
    setTick((t) => t + 1);
  }

  function handleCreate() {
    if (page === 1) refetch();
    else setPage(1);
  }

  function handleDelete() {
    const itemsOnPage = data?.items.length ?? 0;
    if (itemsOnPage === 1 && page > 1) setPage((p) => p - 1);
    else refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Расходы</h1>
        <CreateExpenseDialog onSuccess={handleCreate} />
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Загрузка...</p>
      ) : (
        <>
          <ExpensesTable
            expenses={data?.items ?? []}
            categories={categories}
            onUpdate={refetch}
            onDelete={handleDelete}
          />
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
