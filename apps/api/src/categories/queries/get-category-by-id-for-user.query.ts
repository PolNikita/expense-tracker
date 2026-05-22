export class GetCategoryByIdForUserQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
