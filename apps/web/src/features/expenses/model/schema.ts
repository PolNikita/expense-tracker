import { z } from 'zod';

export const ExpenseFormSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Неверный формат суммы (например: 100 или 100.50)')
    .refine((v) => Number(v) > 0, 'Сумма должна быть больше нуля'),
  currency: z.string().length(3, '3 буквы (например, RUB)'),
  categoryId: z.string().min(1, 'Выберите категорию'),
  note: z.string().max(500, 'Максимум 500 символов').optional(),
  spentAt: z.string().min(1, 'Укажите дату и время'),
});

export type ExpenseFormValues = z.infer<typeof ExpenseFormSchema>;
