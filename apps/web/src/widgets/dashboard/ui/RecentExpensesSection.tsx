'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@expense-tracker/types';
import type { Expense } from '@/entities/expense';
import type { Category } from '@/entities/category';
import { expensesApi, ExpensesTable, ExpensesPagination } from '@/features/expenses';
import { categoriesApi } from '@/features/categories';
import { ApiError } from '@/shared/api/errors';

const PAGE_SIZE = 10;

export function RecentExpensesSection() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<Expense> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const abort = new AbortController();
    categoriesApi
      .list(abort.signal)
      .then(setCategories)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Ошибка загрузки категорий:', error);
        toast.error('Ошибка загрузки категорий');
      });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    expensesApi
      .list({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }, abort.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const message = error instanceof ApiError ? error.message : 'Ошибка загрузки транзакций';
        toast.error(message);
        setLoading(false);
      });
    return () => abort.abort();
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
