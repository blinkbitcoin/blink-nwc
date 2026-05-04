/**
 * FibonacciBackoff generates a series based on the Fibonacci sequence up to a
 * limit. After the limit is reached it keeps returning the last value.
 */
export class FibonacciBackoff implements BaseBackOff {
  private readonly initial: number
  private readonly fibMaxIndex: number
  private index: number
  private current: number
  private previous: number

  constructor(initial: number, fibMaxIndex: number) {
    this.initial = initial
    this.fibMaxIndex = fibMaxIndex
    this.index = 0
    this.current = this.initial
    this.previous = 0
  }

  next(): number {
    if (this.index < this.fibMaxIndex) {
      const next = this.previous + this.current
      this.previous = this.current
      this.current = next
      this.index++
    }

    return this.current
  }

  reset() {
    this.index = 0
    this.current = this.initial
    this.previous = 0
  }
}
