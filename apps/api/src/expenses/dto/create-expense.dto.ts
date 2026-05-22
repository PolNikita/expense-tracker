import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { CreateExpenseInput } from '@expense-tracker/types';

export class CreateExpenseDto implements CreateExpenseInput {
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a positive decimal with up to 2 decimal places' })
  amount!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'currency must be exactly 3 characters' })
  currency?: string;

  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  note?: string | null;

  @IsISO8601()
  spentAt!: string;
}
