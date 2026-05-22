import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Expense } from '@prisma/client';
import { ExpensesRepository } from '../../expenses.repository';
import { GetExpenseByIdForUserQuery } from '../get-expense-by-id-for-user.query';

@QueryHandler(GetExpenseByIdForUserQuery)
export class GetExpenseByIdForUserHandler
  implements IQueryHandler<GetExpenseByIdForUserQuery, Expense | null>
{
  constructor(private readonly repo: ExpensesRepository) {}

  execute(query: GetExpenseByIdForUserQuery): Promise<Expense | null> {
    return this.repo.findOneByUser(query.id, query.userId);
  }
}
