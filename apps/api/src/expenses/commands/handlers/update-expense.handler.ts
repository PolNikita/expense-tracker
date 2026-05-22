import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Expense } from '@prisma/client';
import { ExpensesRepository } from '../../expenses.repository';
import { UpdateExpenseCommand } from '../update-expense.command';

@CommandHandler(UpdateExpenseCommand)
export class UpdateExpenseHandler implements ICommandHandler<UpdateExpenseCommand, Expense> {
  constructor(private readonly repo: ExpensesRepository) {}

  async execute(command: UpdateExpenseCommand): Promise<Expense> {
    const { id, userId, data } = command;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const { count } = await this.repo.updateForUser(id, userId, data);

    if (count === 0) {
      throw new NotFoundException('Expense not found');
    }

    const updated = await this.repo.findOneByUser(id, userId);
    if (!updated) {
      throw new NotFoundException('Expense not found');
    }
    return updated;
  }
}
