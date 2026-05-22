import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Expense } from '@expense-tracker/types';
import { ExpensesRepository } from '../../expenses.repository';
import { toExpenseDto } from '../../expense.mapper';
import { GetExpensesByUserQuery } from '../get-expenses-by-user.query';

@QueryHandler(GetExpensesByUserQuery)
export class GetExpensesByUserHandler
  implements IQueryHandler<GetExpensesByUserQuery, { items: Expense[]; total: number }>
{
  constructor(private readonly repo: ExpensesRepository) {}

  async execute(query: GetExpensesByUserQuery): Promise<{ items: Expense[]; total: number }> {
    const { items, total } = await this.repo.findAllByUser(query.userId, {
      limit: query.limit,
      offset: query.offset,
    });
    return { items: items.map(toExpenseDto), total };
  }
}
