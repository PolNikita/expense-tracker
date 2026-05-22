import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Expense, PaginatedResponse } from '@expense-tracker/types';
import { Expense as PrismaExpense } from '@prisma/client';
import { toExpenseDto, toPaginatedExpenses } from './expense.mapper';
import { CreateExpenseCommand } from './commands/create-expense.command';
import { DeleteExpenseCommand } from './commands/delete-expense.command';
import { UpdateExpenseCommand } from './commands/update-expense.command';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { GetExpensesByUserQuery } from './queries/get-expenses-by-user.query';
import { GetExpenseByIdForUserQuery } from './queries/get-expense-by-id-for-user.query';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async create(userId: string, dto: CreateExpenseDto): Promise<Expense> {
    const row = await this.commandBus.execute<CreateExpenseCommand, PrismaExpense>(
      new CreateExpenseCommand(
        userId,
        dto.amount,
        dto.categoryId,
        dto.spentAt,
        dto.currency ?? 'RUB',
        dto.note ?? null,
      ),
    );
    return toExpenseDto(row);
  }

  async findAll(userId: string, pagination: PaginationQueryDto): Promise<PaginatedResponse<Expense>> {
    const result = await this.queryBus.execute<
      GetExpensesByUserQuery,
      { items: PrismaExpense[]; total: number }
    >(new GetExpensesByUserQuery(userId, pagination.limit, pagination.offset));
    return toPaginatedExpenses(result, pagination);
  }

  async findOne(id: string, userId: string): Promise<Expense> {
    const row = await this.queryBus.execute<GetExpenseByIdForUserQuery, PrismaExpense | null>(
      new GetExpenseByIdForUserQuery(id, userId),
    );
    if (!row) {
      throw new NotFoundException('Expense not found');
    }
    return toExpenseDto(row);
  }

  async update(id: string, userId: string, dto: UpdateExpenseDto): Promise<Expense> {
    const row = await this.commandBus.execute<UpdateExpenseCommand, PrismaExpense>(
      new UpdateExpenseCommand(id, userId, {
        amount: dto.amount,
        currency: dto.currency,
        categoryId: dto.categoryId,
        note: dto.note,
        spentAt: dto.spentAt,
      }),
    );
    return toExpenseDto(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.commandBus.execute<DeleteExpenseCommand, void>(
      new DeleteExpenseCommand(id, userId),
    );
  }
}
