import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Expense } from '@prisma/client';
import { ExpensesRepository } from '../../expenses.repository';
import { GetExpensesByUserQuery } from '../get-expenses-by-user.query';

@QueryHandler(GetExpensesByUserQuery)
export class GetExpensesByUserHandler
  implements IQueryHandler<GetExpensesByUserQuery, { items: Expense[]; total: number }>
{
  constructor(private readonly repo: ExpensesRepository) {}

  execute(query: GetExpensesByUserQuery): Promise<{ items: Expense[]; total: number }> {
    return this.repo.findAllByUser(query.userId, {
      limit: query.limit,
      offset: query.offset,
    });
  }
}
