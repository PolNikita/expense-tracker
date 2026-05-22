export class GetExpensesByUserQuery {
  constructor(
    public readonly userId: string,
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}
