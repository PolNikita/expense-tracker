export class GetExpenseByIdForUserQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
