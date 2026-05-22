export class CreateExpenseCommand {
  constructor(
    public readonly userId: string,
    public readonly amount: string,
    public readonly categoryId: string,
    public readonly spentAt: string,
    public readonly currency: string = 'RUB',
    public readonly note: string | null = null,
  ) {}
}
