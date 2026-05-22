'use client';

import { useFormContext } from 'react-hook-form';
import type { Category } from '@/entities/category';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import type { ExpenseFormValues } from '../model/schema';

interface ExpenseFormFieldsProps {
  categories: Category[];
}

export function ExpenseFormFields({ categories }: ExpenseFormFieldsProps) {
  const form = useFormContext<ExpenseFormValues>();

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Сумма</FormLabel>
            <FormControl>
              <Input placeholder="100.00" inputMode="decimal" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="currency"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Валюта</FormLabel>
            <FormControl>
              <Input placeholder="RUB" maxLength={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Категория</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {categories.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    Сначала создайте категорию через API
                  </div>
                ) : (
                  categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="spentAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Дата и время</FormLabel>
            <FormControl>
              <Input type="datetime-local" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Заметка</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Необязательно..."
                className="resize-none"
                rows={2}
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
