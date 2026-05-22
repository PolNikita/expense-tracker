import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateExpenseHandler } from './commands/handlers/create-expense.handler';
import { UpdateExpenseHandler } from './commands/handlers/update-expense.handler';
import { DeleteExpenseHandler } from './commands/handlers/delete-expense.handler';
import { GetExpensesByUserHandler } from './queries/handlers/get-expenses-by-user.handler';
import { GetExpenseByIdForUserHandler } from './queries/handlers/get-expense-by-id-for-user.handler';
import { ExpensesController } from './expenses.controller';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesService } from './expenses.service';

const CommandHandlers = [
  CreateExpenseHandler,
  UpdateExpenseHandler,
  DeleteExpenseHandler,
];

const QueryHandlers = [
  GetExpensesByUserHandler,
  GetExpenseByIdForUserHandler,
];

@Module({
  imports: [CqrsModule],
  controllers: [ExpensesController],
  providers: [
    ExpensesService,
    ExpensesRepository,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
export class ExpensesModule {}
