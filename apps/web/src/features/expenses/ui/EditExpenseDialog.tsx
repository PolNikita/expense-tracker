'use client';

import { useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Expense } from '@expense-tracker/types';
import type { Category } from '@/entities/category';
import { expensesApi } from '@/features/expenses/api/expenses-api';
import { ExpenseFormSchema, type ExpenseFormValues } from '../model/schema';
import { ExpenseFormFields } from './ExpenseFormFields';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { ApiError } from '@/shared/api/errors';

interface EditExpenseDialogProps {
  expense: Expense | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: (expense: Expense) => void;
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditExpenseDialog({ expense, categories, onClose, onSuccess }: EditExpenseDialogProps) {
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(ExpenseFormSchema),
    defaultValues: {
      amount: '',
      currency: 'RUB',
      categoryId: '',
      note: '',
      spentAt: '',
    },
  });

  useEffect(() => {
    if (expense) {
      form.reset({
        amount: expense.amount,
        currency: expense.currency,
        categoryId: expense.categoryId,
        note: expense.note ?? '',
        spentAt: toLocalDatetime(expense.spentAt),
      });
    }
  }, [expense, form]);

  const { isSubmitting } = form.formState;

  async function onSubmit(values: ExpenseFormValues) {
    if (!expense) return;
    try {
      const updated = await expensesApi.update(expense.id, {
        amount: values.amount,
        currency: values.currency,
        categoryId: values.categoryId,
        note: values.note || null,
        spentAt: new Date(values.spentAt).toISOString(),
      });
      toast.success('Расход обновлён');
      onClose();
      onSuccess(updated);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Что-то пошло не так';
      toast.error(message);
    }
  }

  return (
    <Dialog open={!!expense} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать расход</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ExpenseFormFields categories={categories} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
