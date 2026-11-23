export class OperationQueue {
  private tail: Promise<unknown> = Promise.resolve()
  run<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.tail.then(operation)
    this.tail = task.catch(() => undefined)
    return task
  }
  async idle(): Promise<void> {
    await this.tail
  }
}
