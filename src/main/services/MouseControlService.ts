import { loggerService } from '@logger'
import { screen } from 'electron'

const logger = loggerService.withContext('MouseControlService')

export interface MouseClickOptions {
  /** X coordinate */
  x: number
  /** Y coordinate */
  y: number
  /** Mouse button */
  button?: 'left' | 'right' | 'middle'
  /** Number of clicks */
  clickCount?: number
  /** Delay before click in milliseconds */
  delayMs?: number
}

export interface MouseClickResult {
  success: boolean
  clickedAt: [number, number]
  button: string
  timestamp: string
}

export interface MouseDragResult {
  success: boolean
  draggedFrom: [number, number]
  draggedTo: [number, number]
  button: string
  timestamp: string
}

// Type definitions for @nut-tree-fork/nut-js (to avoid 'any' types)
type NutJSMouse = {
  setPosition: (point: any) => Promise<any>
  getPosition: () => Promise<any>
  click: (button: any) => Promise<any>
  pressButton: (button: any) => Promise<any>
  releaseButton: (button: any) => Promise<any>
}

type NutJSPoint = new (x: number, y: number) => any

type NutJSButton = {
  LEFT: any
  RIGHT: any
  MIDDLE: any
}

/**
 * Service for controlling mouse actions
 *
 * NOTE: This requires @nut-tree-fork/nut-js to be installed
 * Run: pnpm add @nut-tree-fork/nut-js
 */
class MouseControlService {
  private mouse?: NutJSMouse
  private Point?: NutJSPoint
  private Button?: NutJSButton
  private lastClickTime = 0
  private readonly RATE_LIMIT_MS = 100 // Minimum 100ms between clicks
  private clickLock = false // Prevent concurrent clicks

  /**
   * Initialize the mouse control library
   */
  async initialize() {
    try {
      // Dynamically import @nut-tree-fork/nut-js
      const nutjs = await import('@nut-tree-fork/nut-js')
      this.mouse = nutjs.mouse
      this.Point = nutjs.Point
      this.Button = nutjs.Button

      logger.info('MouseControlService initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize MouseControlService', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error('@nut-tree-fork/nut-js not installed. Please run: pnpm add @nut-tree-fork/nut-js')
    }
  }

  /**
   * Validate coordinates are within screen bounds
   */
  private validateCoordinates(x: number, y: number): void {
    const displays = screen.getAllDisplays()
    let isValid = false

    for (const display of displays) {
      const { x: dx, y: dy, width, height } = display.bounds
      if (x >= dx && x <= dx + width && y >= dy && y <= dy + height) {
        isValid = true
        break
      }
    }

    if (!isValid) {
      throw new Error(`Invalid coordinates: (${x}, ${y}). Coordinates must be within screen bounds.`)
    }
  }

  /**
   * Check rate limit to prevent malicious rapid clicking
   */
  private checkRateLimit(): void {
    const now = Date.now()
    const timeSinceLastClick = now - this.lastClickTime

    if (timeSinceLastClick < this.RATE_LIMIT_MS) {
      throw new Error(`Rate limit exceeded. Please wait ${this.RATE_LIMIT_MS}ms between clicks.`)
    }

    this.lastClickTime = now
  }

  /**
   * Perform a mouse click at the specified coordinates
   */
  async click(options: MouseClickOptions): Promise<MouseClickResult> {
    // Prevent concurrent clicks
    if (this.clickLock) {
      throw new Error('Another click operation is in progress. Please wait.')
    }

    this.clickLock = true

    try {
      if (!this.mouse) {
        await this.initialize()
      }

      const { x, y, button = 'left', clickCount = 1, delayMs = 100 } = options

      // Validate coordinates
      this.validateCoordinates(x, y)

      // Check rate limit
      this.checkRateLimit()

      logger.info('Performing mouse click', { x, y, button, clickCount })

      // Move mouse to position
      await this.mouse!.setPosition(new this.Point!(x, y))

      // Wait for delay
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }

      // Perform clicks
      const mouseButton = this.getMouseButton(button)
      for (let i = 0; i < clickCount; i++) {
        await this.mouse!.click(mouseButton)
        if (i < clickCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }

      const result: MouseClickResult = {
        success: true,
        clickedAt: [x, y],
        button,
        timestamp: new Date().toISOString()
      }

      logger.info('Mouse click executed successfully', result)
      return result
    } catch (error) {
      logger.error('Failed to execute mouse click', {
        error: error instanceof Error ? error.message : String(error),
        x: options.x,
        y: options.y,
        button: options.button
      })
      throw error
    } finally {
      this.clickLock = false
    }
  }

  /**
   * Get the nut-js Button enum value
   */
  private getMouseButton(button: string) {
    if (!this.Button) {
      throw new Error('MouseControlService not initialized')
    }
    switch (button) {
      case 'left':
        return this.Button.LEFT
      case 'right':
        return this.Button.RIGHT
      case 'middle':
        return this.Button.MIDDLE
      default:
        return this.Button.LEFT
    }
  }

  /**
   * Move mouse to specified coordinates without clicking
   */
  async moveTo(x: number, y: number): Promise<void> {
    if (!this.mouse) {
      await this.initialize()
    }

    this.validateCoordinates(x, y)

    await this.mouse!.setPosition(new this.Point!(x, y))
    logger.info('Mouse moved to position', { x, y })
  }

  /**
   * Move mouse smoothly to specified coordinates with animation
   */
  async moveSmooth(x: number, y: number, durationMs: number = 500): Promise<void> {
    if (!this.mouse) {
      await this.initialize()
    }

    this.validateCoordinates(x, y)

    // Get current position
    const currentPos = await this.mouse!.getPosition()
    const startX = currentPos.x
    const startY = currentPos.y

    // Calculate steps for smooth movement (~60fps)
    const steps = Math.max(10, Math.floor(durationMs / 16))
    const deltaX = (x - startX) / steps
    const deltaY = (y - startY) / steps
    const stepDelay = durationMs / steps

    // Animate movement
    for (let i = 0; i <= steps; i++) {
      const newX = Math.round(startX + deltaX * i)
      const newY = Math.round(startY + deltaY * i)
      await this.mouse!.setPosition(new this.Point!(newX, newY))
      if (i < steps) {
        await new Promise((resolve) => setTimeout(resolve, stepDelay))
      }
    }

    logger.info('Mouse moved smoothly', { from: [startX, startY], to: [x, y], duration: durationMs })
  }

  /**
   * Perform a drag operation from start to end coordinates
   */
  async drag(options: {
    startX: number
    startY: number
    endX: number
    endY: number
    button?: 'left' | 'right' | 'middle'
    durationMs?: number
  }): Promise<MouseDragResult> {
    if (this.clickLock) {
      throw new Error('Another mouse operation is in progress')
    }

    this.clickLock = true

    try {
      if (!this.mouse) {
        await this.initialize()
      }

      const { startX, startY, endX, endY, button = 'left', durationMs = 500 } = options

      // Validate coordinates
      this.validateCoordinates(startX, startY)
      this.validateCoordinates(endX, endY)

      logger.info('Performing drag operation', { startX, startY, endX, endY, button })

      // Move to start position
      await this.mouse!.setPosition(new this.Point!(startX, startY))
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Press mouse button
      const mouseButton = this.getMouseButton(button)
      await this.mouse!.pressButton(mouseButton)
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Drag to end position with smooth movement
      const steps = Math.max(10, Math.floor(durationMs / 16))
      const deltaX = (endX - startX) / steps
      const deltaY = (endY - startY) / steps
      const stepDelay = durationMs / steps

      for (let i = 1; i <= steps; i++) {
        const newX = Math.round(startX + deltaX * i)
        const newY = Math.round(startY + deltaY * i)
        await this.mouse!.setPosition(new this.Point!(newX, newY))
        await new Promise((resolve) => setTimeout(resolve, stepDelay))
      }

      // Release mouse button
      await this.mouse!.releaseButton(mouseButton)

      const result: MouseDragResult = {
        success: true,
        draggedFrom: [startX, startY],
        draggedTo: [endX, endY],
        button,
        timestamp: new Date().toISOString()
      }

      logger.info('Drag operation completed', result)
      return result
    } catch (error) {
      logger.error('Failed to perform drag', { error })
      throw error
    } finally {
      this.clickLock = false
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.mouse = undefined
    this.Point = undefined
    this.Button = undefined
    this.lastClickTime = 0
    this.clickLock = false
    logger.info('MouseControlService cleaned up')
  }
}

export const mouseControlService = new MouseControlService()
