import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import { CategoriesRepository } from '../../categories.repository';
import { DeleteCategoryCommand } from '../delete-category.command';

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler implements ICommandHandler<DeleteCategoryCommand, void> {
  constructor(private readonly repo: CategoriesRepository) {}

  async execute(command: DeleteCategoryCommand): Promise<void> {
    try {
      const { count } = await this.repo.deleteForUser(command.id, command.userId);

      if (count === 0) {
        throw new NotFoundException('Category not found');
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException('Cannot delete category with existing expenses');
      }
      throw e;
    }
  }
}
