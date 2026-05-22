import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ExpensesRepository } from '../../expenses.repository';
import { DeleteExpenseCommand } from '../delete-expense.command';

@CommandHandler(DeleteExpenseCommand)
export class DeleteExpenseHandler implements ICommandHandler<DeleteExpenseCommand, void> {
  constructor(private readonly repo: ExpensesRepository) {}

  async execute(command: DeleteExpenseCommand): Promise<void> {
    const { count } = await this.repo.deleteForUser(command.id, command.userId);

    if (count === 0) {
      throw new NotFoundException('Expense not found');
    }
  }
}
