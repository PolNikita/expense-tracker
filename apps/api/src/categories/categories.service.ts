import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Category } from '@expense-tracker/types';
import { Category as PrismaCategory } from '@prisma/client';
import { toCategoryDto } from './category.mapper';
import { CreateCategoryCommand } from './commands/create-category.command';
import { DeleteCategoryCommand } from './commands/delete-category.command';
import { UpdateCategoryCommand } from './commands/update-category.command';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { GetCategoriesByUserQuery } from './queries/get-categories-by-user.query';
import { GetCategoryByIdForUserQuery } from './queries/get-category-by-id-for-user.query';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const row = await this.commandBus.execute<CreateCategoryCommand, PrismaCategory>(
      new CreateCategoryCommand(userId, dto.name, dto.color ?? null, dto.icon ?? null),
    );
    return toCategoryDto(row);
  }

  async findAll(userId: string): Promise<Category[]> {
    const rows = await this.queryBus.execute<GetCategoriesByUserQuery, PrismaCategory[]>(
      new GetCategoriesByUserQuery(userId),
    );
    return rows.map(toCategoryDto);
  }

  async findOne(id: string, userId: string): Promise<Category> {
    const row = await this.queryBus.execute<
      GetCategoryByIdForUserQuery,
      PrismaCategory | null
    >(new GetCategoryByIdForUserQuery(id, userId));

    if (!row) {
      throw new NotFoundException('Category not found');
    }
    return toCategoryDto(row);
  }

  async update(id: string, userId: string, dto: UpdateCategoryDto): Promise<Category> {
    const row = await this.commandBus.execute<UpdateCategoryCommand, PrismaCategory>(
      new UpdateCategoryCommand(id, userId, {
        name: dto.name,
        color: dto.color,
        icon: dto.icon,
      }),
    );
    return toCategoryDto(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.commandBus.execute<DeleteCategoryCommand, void>(
      new DeleteCategoryCommand(id, userId),
    );
  }
}
