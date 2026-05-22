import type { Expense, CreateExpenseInput, UpdateExpenseInput } from '@expense-tracker/types';
import { http } from '@/shared/api/http-client';
import { ENDPOINTS } from '@/shared/api/endpoints';

export const expensesApi = {
  list: () => http.get<Expense[]>(ENDPOINTS.expenses),
  create: (body: CreateExpenseInput) => http.post<Expense>(ENDPOINTS.expenses, body),
  update: (id: string, body: UpdateExpenseInput) =>
    http.patch<Expense>(ENDPOINTS.expense(id), body),
  delete: (id: string) => http.delete<void>(ENDPOINTS.expense(id)),
};
