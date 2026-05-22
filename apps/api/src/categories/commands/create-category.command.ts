export class CreateCategoryCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly color: string | null = null,
    public readonly icon: string | null = null,
  ) {}
}
