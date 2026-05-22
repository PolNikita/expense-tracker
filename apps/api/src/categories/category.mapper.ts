import type { Category as PrismaCategory } from '@prisma/client';
import type { Category } from '@expense-tracker/types';

export function toCategoryDto(row: PrismaCategory): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
