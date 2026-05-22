export class UpdateCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      name?: string;
      color?: string | null;
      icon?: string | null;
    },
  ) {}
}
