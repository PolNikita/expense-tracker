import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateCategoryHandler } from './commands/handlers/create-category.handler';
import { DeleteCategoryHandler } from './commands/handlers/delete-category.handler';
import { UpdateCategoryHandler } from './commands/handlers/update-category.handler';
import { GetCategoriesByUserHandler } from './queries/handlers/get-categories-by-user.handler';
import { GetCategoryByIdForUserHandler } from './queries/handlers/get-category-by-id-for-user.handler';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

const CommandHandlers = [
  CreateCategoryHandler,
  UpdateCategoryHandler,
  DeleteCategoryHandler,
];

const QueryHandlers = [
  GetCategoriesByUserHandler,
  GetCategoryByIdForUserHandler,
];

@Module({
  imports: [CqrsModule],
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    CategoriesRepository,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
export class CategoriesModule {}
