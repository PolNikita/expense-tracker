import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '@prisma/client';
import { UsersRepository } from '../../users.repository';
import { GetUserByEmailQuery } from '../get-user-by-email.query';

@QueryHandler(GetUserByEmailQuery)
export class GetUserByEmailHandler implements IQueryHandler<GetUserByEmailQuery, User | null> {
  constructor(private readonly users: UsersRepository) {}

  execute(query: GetUserByEmailQuery): Promise<User | null> {
    return this.users.findByEmail(query.email);
  }
}
