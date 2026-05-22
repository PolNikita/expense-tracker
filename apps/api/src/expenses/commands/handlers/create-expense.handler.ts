import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Expense, Prisma } from '@prisma/client';
import { ExpensesRepository } from '../../expenses.repository';
import { CreateExpenseCommand } from '../create-expense.command';

@CommandHandler(CreateExpenseCommand)
export class CreateExpenseHandler implements ICommandHandler<CreateExpenseCommand, Expense> {
  constructor(private readonly repo: ExpensesRepository) {}

  async execute(command: CreateExpenseCommand): Promise<Expense> {
    try {
      return await this.repo.createForUser(command.userId, {
        amount: command.amount,
        currency: command.currency,
        categoryId: command.categoryId,
        note: command.note,
        spentAt: command.spentAt,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new NotFoundException('Category not found');
      }
      throw e;
    }
  }
}
