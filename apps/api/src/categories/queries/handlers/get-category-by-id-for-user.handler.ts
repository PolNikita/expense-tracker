import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Category } from '@prisma/client';
import { CategoriesRepository } from '../../categories.repository';
import { GetCategoryByIdForUserQuery } from '../get-category-by-id-for-user.query';

@QueryHandler(GetCategoryByIdForUserQuery)
export class GetCategoryByIdForUserHandler
  implements IQueryHandler<GetCategoryByIdForUserQuery, Category | null>
{
  constructor(private readonly repo: CategoriesRepository) {}

  execute(query: GetCategoryByIdForUserQuery): Promise<Category | null> {
    return this.repo.findOneByUser(query.id, query.userId);
  }
}
