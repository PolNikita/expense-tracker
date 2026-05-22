import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UpdateExpenseInput } from '@expense-tracker/types';

export class UpdateExpenseDto implements UpdateExpenseInput {
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a positive decimal with up to 2 decimal places' })
  amount?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'currency must be exactly 3 characters' })
  currency?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  note?: string | null;

  @IsOptional()
  @IsISO8601()
  spentAt?: string;
}
