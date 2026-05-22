'use client';

import { useState } from 'react';
import type { Category, Expense } from '@expense-tracker/types';
import { Button } from '@/shared/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { EditExpenseDialog } from './EditExpenseDialog';
import { DeleteExpenseDialog } from './DeleteExpenseDialog';

interface ExpensesTableProps {
  expenses: Expense[];
  categories: Category[];
  onUpdate?: (expense: Expense) => void;
  onDelete?: (id: string) => void;
}

function formatAmount(amount: string, currency: string): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(Number(amount));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function ExpensesTable({ expenses, categories, onUpdate, onDelete }: ExpensesTableProps) {
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const hasActions = onUpdate !== undefined || onDelete !== undefined;

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  if (expenses.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Расходов пока нет. Нажмите «Добавить», чтобы создать первый.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Категория</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
            <TableHead>Заметка</TableHead>
            {hasActions && <TableHead className="w-[120px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDate(expense.spentAt)}
              </TableCell>
              <TableCell className="text-sm">
                {categoryMap.get(expense.categoryId) ?? '—'}
              </TableCell>
              <TableCell className="text-right font-medium whitespace-nowrap">
                {formatAmount(expense.amount, expense.currency)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                {expense.note ?? '—'}
              </TableCell>
              {hasActions && (
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    {onUpdate && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditTarget(expense)}
                      >
                        Изменить
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(expense)}
                      >
                        Удалить
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {onUpdate && (
        <EditExpenseDialog
          expense={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={(updated) => {
            setEditTarget(null);
            onUpdate(updated);
          }}
        />
      )}

      {onDelete && (
        <DeleteExpenseDialog
          expense={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(id) => {
            setDeleteTarget(null);
            onDelete(id);
          }}
        />
      )}
    </>
  );
}
