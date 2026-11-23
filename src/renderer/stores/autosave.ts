export class Autosave<T> {
  private timer: ReturnType<typeof setTimeout> | undefined
  private next: T | undefined
  private running: Promise<void> | undefined
  constructor(
    private save: (value: T) => Promise<void>,
    private delay = 500,
  ) {}
  schedule(value: T): void {
    this.next = value
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined)
    }, this.delay)
  }
  flush(): Promise<void> {
    clearTimeout(this.timer)
    if (this.running) return this.running.then(() => this.flush())
    const task = this.drain()
    this.running = task
    return task.finally(() => {
      this.running = undefined
    })
  }
  private async drain(): Promise<void> {
    while (this.next !== undefined) {
      const value = this.next
      this.next = undefined
      try {
        await this.save(value)
      } catch (error) {
        if (this.next === undefined) this.next = value
        throw error
      }
    }
  }
}
