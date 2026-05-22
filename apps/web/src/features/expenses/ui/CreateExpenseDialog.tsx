'use client';

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Expense } from '@expense-tracker/types';
import { expensesApi } from '@/features/expenses/api/expenses-api';
import { ExpenseFormSchema, type ExpenseFormValues } from '../model/schema';
import { ExpenseFormFields } from './ExpenseFormFields';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { ApiError } from '@/shared/api/errors';

interface CreateExpenseDialogProps {
  onSuccess: (expense: Expense) => void;
}

export function CreateExpenseDialog({ onSuccess }: CreateExpenseDialogProps) {
  const [open, setOpen] = useState(false);

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

  const { isSubmitting } = form.formState;

  async function onSubmit(values: ExpenseFormValues) {
    try {
      const expense = await expensesApi.create({
        amount: values.amount,
        currency: values.currency,
        categoryId: values.categoryId,
        note: values.note || null,
        spentAt: new Date(values.spentAt).toISOString(),
      });
      toast.success('Расход добавлен');
      form.reset();
      setOpen(false);
      onSuccess(expense);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Что-то пошло не так';
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый расход</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ExpenseFormFields />
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
