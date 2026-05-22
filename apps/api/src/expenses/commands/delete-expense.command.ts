export class DeleteExpenseCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
