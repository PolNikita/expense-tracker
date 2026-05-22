import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Category, Prisma } from '@prisma/client';
import { CategoriesRepository } from '../../categories.repository';
import { UpdateCategoryCommand } from '../update-category.command';

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler
  implements ICommandHandler<UpdateCategoryCommand, Category>
{
  constructor(private readonly repo: CategoriesRepository) {}

  async execute(command: UpdateCategoryCommand): Promise<Category> {
    const { id, userId, data } = command;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    try {
      const { count } = await this.repo.updateForUser(id, userId, data);

      if (count === 0) {
        throw new NotFoundException('Category not found');
      }

      const updated = await this.repo.findOneByUser(id, userId);
      if (!updated) {
        throw new NotFoundException('Category not found');
      }
      return updated;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Category with this name already exists');
      }
      throw e;
    }
  }
}
