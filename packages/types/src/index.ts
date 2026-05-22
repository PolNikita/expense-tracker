export type ISODateString = string;

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface Category {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  userId: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type CreateCategoryInput = Pick<Category, 'name'> &
  Partial<Pick<Category, 'color' | 'icon'>>;
export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export interface Expense {
  id: string;
  amount: string;
  currency: string;
  categoryId: string;
  note: string | null;
  spentAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateExpenseInput {
  amount: string;
  currency?: string;
  categoryId: string;
  note?: string | null;
  spentAt: ISODateString;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
