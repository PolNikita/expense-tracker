import { Injectable } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  createForUser(
    userId: string,
    data: { name: string; color?: string | null; icon?: string | null },
  ): Promise<Category> {
    return this.prisma.category.create({ data: { ...data, userId } });
  }

  findAllByUser(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findOneByUser(id: string, userId: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, userId } });
  }

  async updateForUser(
    id: string,
    userId: string,
    data: { name?: string; color?: string | null; icon?: string | null },
  ): Promise<{ count: number }> {
    const { count } = await this.prisma.category.updateMany({
      where: { id, userId },
      data,
    });
    return { count };
  }

  async deleteForUser(id: string, userId: string): Promise<{ count: number }> {
    const { count } = await this.prisma.category.deleteMany({
      where: { id, userId },
    });
    return { count };
  }
}
