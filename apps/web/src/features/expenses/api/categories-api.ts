import type { Category } from '@expense-tracker/types';
import { http } from '@/shared/api/http-client';
import { ENDPOINTS } from '@/shared/api/endpoints';

export const categoriesApi = {
  list: () => http.get<Category[]>(ENDPOINTS.categories),
};
