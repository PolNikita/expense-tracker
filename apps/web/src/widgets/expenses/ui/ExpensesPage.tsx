'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Category, Expense } from '@expense-tracker/types';
import { expensesApi } from '@/features/expenses/api/expenses-api';
import { categoriesApi } from '@/features/expenses/api/categories-api';
import { CreateExpenseDialog, ExpensesTable } from '@/features/expenses';
import { ApiError } from '@/shared/api/errors';

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [exp, cats] = await Promise.all([expensesApi.list(), categoriesApi.list()]);
      setExpenses(exp);
      setCategories(cats);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Ошибка загрузки';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function handleCreate(expense: Expense) {
    setExpenses((prev) => [expense, ...prev]);
  }

  function handleUpdate(updated: Expense) {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  function handleDelete(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
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
        <ExpensesTable
          expenses={expenses}
          categories={categories}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
