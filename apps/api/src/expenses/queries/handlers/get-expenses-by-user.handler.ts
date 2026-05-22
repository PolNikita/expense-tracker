import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Expense } from '@prisma/client';
import { ExpensesRepository } from '../../expenses.repository';
import { GetExpensesByUserQuery } from '../get-expenses-by-user.query';

@QueryHandler(GetExpensesByUserQuery)
export class GetExpensesByUserHandler
  implements IQueryHandler<GetExpensesByUserQuery, Expense[]>
{
  constructor(private readonly repo: ExpensesRepository) {}

  execute(query: GetExpensesByUserQuery): Promise<Expense[]> {
    return this.repo.findAllByUser(query.userId);
  }
}
