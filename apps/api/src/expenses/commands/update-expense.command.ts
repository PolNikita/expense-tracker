export class UpdateExpenseCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      amount?: string;
      currency?: string;
      categoryId?: string;
      note?: string | null;
      spentAt?: string;
    },
  ) {}
}
