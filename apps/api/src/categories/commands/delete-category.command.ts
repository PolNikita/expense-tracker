export class DeleteCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
