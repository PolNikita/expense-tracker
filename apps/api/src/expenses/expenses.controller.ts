import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Expense, PaginatedResponse, User } from '@expense-tracker/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() dto: CreateExpenseDto): Promise<Expense> {
    return this.expenses.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Expense>> {
    return this.expenses.findAll(user.id, pagination);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string): Promise<Expense> {
    return this.expenses.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<Expense> {
    return this.expenses.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.expenses.remove(id, user.id);
  }
}
