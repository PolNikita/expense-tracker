import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '@prisma/client';
import { UsersRepository } from '../../users.repository';
import { GetUserByIdQuery } from '../get-user-by-id.query';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, User | null> {
  constructor(private readonly users: UsersRepository) {}

  execute(query: GetUserByIdQuery): Promise<User | null> {
    return this.users.findById(query.id);
  }
}
