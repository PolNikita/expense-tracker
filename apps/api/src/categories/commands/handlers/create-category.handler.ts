import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Category, Prisma } from '@prisma/client';
import { CategoriesRepository } from '../../categories.repository';
import { CreateCategoryCommand } from '../create-category.command';

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler
  implements ICommandHandler<CreateCategoryCommand, Category>
{
  constructor(private readonly repo: CategoriesRepository) {}

  async execute(command: CreateCategoryCommand): Promise<Category> {
    try {
      return await this.repo.createForUser(command.userId, {
        name: command.name,
        color: command.color,
        icon: command.icon,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException('Category with this name already exists');
        }
        if (e.code === 'P2003') {
          throw new NotFoundException('User not found');
        }
      }
      throw e;
    }
  }
}
