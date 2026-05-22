import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { AuthResponse } from '@expense-tracker/types';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserCommand, GetUserByEmailQuery } from '../users';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const row = await this.commandBus.execute<CreateUserCommand, User>(
      new CreateUserCommand(dto.name, dto.email, passwordHash),
    );
    return this.sign(row);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const row = await this.queryBus.execute<GetUserByEmailQuery, User | null>(
      new GetUserByEmailQuery(dto.email),
    );
    if (!row || !(await bcrypt.compare(dto.password, row.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.sign(row);
  }

  private sign(row: User): AuthResponse {
    const accessToken = this.jwt.sign({ sub: row.id, email: row.email });
    const { passwordHash: _omit, ...user } = row;
    return {
      accessToken,
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }
}
