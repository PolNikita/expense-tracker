import type { Expense as PrismaExpense } from '@prisma/client';
import type { Expense, PaginatedResponse } from '@expense-tracker/types';

export function toExpenseDto(row: PrismaExpense): Expense {
  return {
    id: row.id,
    amount: row.amount.toString(),
    currency: row.currency,
    categoryId: row.categoryId,
    note: row.note,
    spentAt: row.spentAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPaginatedExpenses(
  { items, total }: { items: PrismaExpense[]; total: number },
  { limit, offset }: { limit: number; offset: number },
): PaginatedResponse<Expense> {
  return {
    items: items.map(toExpenseDto),
    meta: {
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    },
  };
}
