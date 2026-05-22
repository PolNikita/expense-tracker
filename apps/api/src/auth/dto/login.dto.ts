import { LoginInput } from '@expense-tracker/types';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class LoginDto implements LoginInput {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
