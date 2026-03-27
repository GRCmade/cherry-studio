import { mouse, Point } from '@nut-tree-fork/nut-js'

export interface ScrollOptions {
  direction: 'up' | 'down' | 'left' | 'right'
  amount?: number
  x?: number
  y?: number
}

export interface ScrollResult {
  success: boolean
  direction: string
  amount: number
  scrolledAt?: [number, number]
  timestamp: string
}

type NutJSMouse = typeof mouse & {
  scrollDown: (amount: number) => Promise<void>
  scrollUp: (amount: number) => Promise<void>
  scrollLeft: (amount: number) => Promise<void>
  scrollRight: (amount: number) => Promise<void>
  getPosition: () => Promise<Point>
}

class ScrollService {
  private mouse?: NutJSMouse
  private Point?: typeof Point
  private initialized = false
  private scrollLock = false

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      this.mouse = mouse as NutJSMouse
      this.Point = Point
      this.initialized = true
    } catch (error) {
      throw new Error(
        `Failed to initialize scroll service: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Scroll in the specified direction
   */
  async scroll(options: ScrollOptions): Promise<ScrollResult> {
    await this.initialize()

    if (this.scrollLock) {
      throw new Error('Another scroll operation is in progress')
    }

    this.scrollLock = true

    try {
      const { direction, amount = 3, x, y } = options

      // Validate amount
      if (amount < 1 || amount > 100) {
        throw new Error('Scroll amount must be between 1 and 100')
      }

      // Move to position if specified
      let scrollPosition: [number, number] | undefined
      if (x !== undefined && y !== undefined) {
        if (x < 0 || y < 0) {
          throw new Error('Scroll position coordinates must be non-negative')
        }
        await this.mouse!.setPosition(new this.Point!(x, y))
        scrollPosition = [x, y]
      } else {
        const currentPos = await this.mouse!.getPosition()
        scrollPosition = [currentPos.x, currentPos.y]
      }

      // Perform scroll
      switch (direction) {
        case 'up':
          await this.mouse!.scrollUp(amount)
          break
        case 'down':
          await this.mouse!.scrollDown(amount)
          break
        case 'left':
          await this.mouse!.scrollLeft(amount)
          break
        case 'right':
          await this.mouse!.scrollRight(amount)
          break
        default:
          throw new Error(`Invalid scroll direction: ${direction}`)
      }

      return {
        success: true,
        direction,
        amount,
        scrolledAt: scrollPosition,
        timestamp: new Date().toISOString()
      }
    } finally {
      this.scrollLock = false
    }
  }
}

export const scrollService = new ScrollService()
