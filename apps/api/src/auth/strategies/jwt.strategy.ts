import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryBus } from '@nestjs/cqrs';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@expense-tracker/types';
import { User as PrismaUser } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { GetUserByIdQuery } from '../../users';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    cfg: ConfigService,
    private readonly queryBus: QueryBus,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const row = await this.queryBus.execute<GetUserByIdQuery, PrismaUser | null>(
      new GetUserByIdQuery(payload.sub),
    );
    if (!row) throw new UnauthorizedException();
    const { passwordHash: _omit, ...user } = row;
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
