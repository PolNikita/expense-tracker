import type {
  Expense,
  CreateExpenseInput,
  UpdateExpenseInput,
  PaginatedResponse,
} from '@expense-tracker/types';
import { http } from '@/shared/api/http-client';
import { ENDPOINTS } from '@/shared/api/endpoints';

export const expensesApi = {
  list: (params: { limit: number; offset: number }, signal?: AbortSignal) => {
    const query = new URLSearchParams({
      limit: String(params.limit),
      offset: String(params.offset),
    });
    return http.get<PaginatedResponse<Expense>>(`${ENDPOINTS.expenses}?${query}`, signal);
  },
  create: (body: CreateExpenseInput) => http.post<Expense>(ENDPOINTS.expenses, body),
  update: (id: string, body: UpdateExpenseInput) =>
    http.patch<Expense>(ENDPOINTS.expense(id), body),
  delete: (id: string) => http.delete<void>(ENDPOINTS.expense(id)),
};
