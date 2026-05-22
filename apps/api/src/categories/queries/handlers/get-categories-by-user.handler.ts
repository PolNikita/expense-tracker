import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Category } from '@prisma/client';
import { CategoriesRepository } from '../../categories.repository';
import { GetCategoriesByUserQuery } from '../get-categories-by-user.query';

@QueryHandler(GetCategoriesByUserQuery)
export class GetCategoriesByUserHandler
  implements IQueryHandler<GetCategoriesByUserQuery, Category[]>
{
  constructor(private readonly repo: CategoriesRepository) {}

  execute(query: GetCategoriesByUserQuery): Promise<Category[]> {
    return this.repo.findAllByUser(query.userId);
  }
}
