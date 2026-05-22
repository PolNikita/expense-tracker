'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Expense, PaginatedResponse } from '@/entities/expense';
import type { Category } from '@/entities/category';
import { expensesApi, CreateExpenseDialog, ExpensesTable, ExpensesPagination } from '@/features/expenses';
import { categoriesApi } from '@/features/categories';
import { ApiError } from '@/shared/api/errors';

const PAGE_SIZE = 10;

export function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
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
        const message = error instanceof ApiError ? error.message : 'Ошибка загрузки';
        toast.error(message);
        setLoading(false);
      });
    return () => abort.abort();
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
        <CreateExpenseDialog categories={categories} onSuccess={handleCreate} />
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
