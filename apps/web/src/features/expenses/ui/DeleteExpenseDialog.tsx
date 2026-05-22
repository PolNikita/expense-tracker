'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Expense } from '@expense-tracker/types';
import { expensesApi } from '@/features/expenses/api/expenses-api';
import { ApiError } from '@/shared/api/errors';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';

interface DeleteExpenseDialogProps {
  expense: Expense | null;
  onClose: () => void;
  onSuccess: (id: string) => void;
}

export function DeleteExpenseDialog({ expense, onClose, onSuccess }: DeleteExpenseDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!expense) return;
    setLoading(true);
    try {
      await expensesApi.delete(expense.id);
      toast.success('Расход удалён');
      onSuccess(expense.id);
      onClose();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Не удалось удалить';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={!!expense} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить расход?</AlertDialogTitle>
          <AlertDialogDescription>
            Это действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
