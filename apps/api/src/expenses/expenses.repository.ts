import { Injectable, NotFoundException } from '@nestjs/common';
import { Expense } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertCategoryOwnedByUser(categoryId: string, userId: string): Promise<void> {
    const cat = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!cat) {
      throw new NotFoundException('Category not found');
    }
  }

  async createForUser(
    userId: string,
    data: {
      amount: string;
      currency?: string;
      categoryId: string;
      note?: string | null;
      spentAt: string;
    },
  ): Promise<Expense> {
    await this.assertCategoryOwnedByUser(data.categoryId, userId);
    return this.prisma.expense.create({
      data: {
        amount: data.amount,
        currency: data.currency ?? 'RUB',
        categoryId: data.categoryId,
        note: data.note ?? null,
        spentAt: new Date(data.spentAt),
      },
    });
  }

  findAllByUser(userId: string): Promise<Expense[]> {
    return this.prisma.expense.findMany({
      where: { category: { userId } },
      orderBy: { spentAt: 'desc' },
    });
  }

  findOneByUser(id: string, userId: string): Promise<Expense | null> {
    return this.prisma.expense.findFirst({
      where: { id, category: { userId } },
    });
  }

  async updateForUser(
    id: string,
    userId: string,
    data: {
      amount?: string;
      currency?: string;
      categoryId?: string;
      note?: string | null;
      spentAt?: string;
    },
  ): Promise<{ count: number }> {
    if (data.categoryId !== undefined) {
      await this.assertCategoryOwnedByUser(data.categoryId, userId);
    }
    const { count } = await this.prisma.expense.updateMany({
      where: { id, category: { userId } },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.note !== undefined && { note: data.note }),
        ...(data.spentAt !== undefined && { spentAt: new Date(data.spentAt) }),
      },
    });
    return { count };
  }

  async deleteForUser(id: string, userId: string): Promise<{ count: number }> {
    const { count } = await this.prisma.expense.deleteMany({
      where: { id, category: { userId } },
    });
    return { count };
  }
}
