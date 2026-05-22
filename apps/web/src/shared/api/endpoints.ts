export const ENDPOINTS = {
  authLogin: '/auth/login',
  authRegister: '/auth/register',
  categories: '/categories',
  category: (id: string) => `/categories/${id}`,
  expenses: '/expenses',
  expense: (id: string) => `/expenses/${id}`,
} as const;
