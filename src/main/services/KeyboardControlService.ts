import { loggerService } from '@logger'
import type { Key, keyboard } from '@nut-tree-fork/nut-js'

const logger = loggerService.withContext('KeyboardControlService')

export interface KeyboardTypeOptions {
  text: string
  delayMs?: number
  clearBefore?: boolean
}

export interface KeyboardTypeResult {
  success: boolean
  textTyped: string
  characterCount: number
  timestamp: string
}

class KeyboardControlService {
  private keyboard?: typeof keyboard
  private Key?: typeof Key
  private initialized = false
  private typeLock = false

  async initialize() {
    if (this.initialized) return

    try {
      const nutjs = await import('@nut-tree-fork/nut-js')
      this.keyboard = nutjs.keyboard
      this.Key = nutjs.Key
      this.initialized = true
      logger.info('KeyboardControlService initialized')
    } catch (error) {
      logger.error('Failed to initialize KeyboardControlService', { error })
      throw new Error('@nut-tree-fork/nut-js not installed')
    }
  }

  async type(options: KeyboardTypeOptions): Promise<KeyboardTypeResult> {
    if (this.typeLock) {
      throw new Error('Another typing operation is in progress')
    }

    this.typeLock = true

    try {
      if (!this.initialized) {
        await this.initialize()
      }

      const { text, delayMs = 50, clearBefore = false } = options

      // Validate input
      if (!text || text.length === 0) {
        throw new Error('Text cannot be empty')
      }

      if (text.length > 10000) {
        throw new Error('Text too long (max 10000 characters)')
      }

      if (delayMs < 0 || delayMs > 1000) {
        throw new Error('Invalid delay_ms: must be between 0 and 1000')
      }

      logger.info('Typing text', { length: text.length, clearBefore })

      // Clear existing text if requested
      if (clearBefore) {
        await this.keyboard!.pressKey(this.Key!.LeftControl, this.Key!.A)
        await this.keyboard!.releaseKey(this.Key!.LeftControl, this.Key!.A)
        await new Promise((resolve) => setTimeout(resolve, 50))
        await this.keyboard!.pressKey(this.Key!.Delete)
        await this.keyboard!.releaseKey(this.Key!.Delete)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Type text with delay
      for (const char of text) {
        await this.keyboard!.type(char)
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }

      const result: KeyboardTypeResult = {
        success: true,
        textTyped: text,
        characterCount: text.length,
        timestamp: new Date().toISOString()
      }

      logger.info('Text typed successfully', result)
      return result
    } catch (error) {
      logger.error('Failed to type text', { error })
      throw error
    } finally {
      this.typeLock = false
    }
  }

  cleanup(): void {
    this.keyboard = undefined
    this.Key = undefined
    this.initialized = false
    this.typeLock = false
    logger.info('KeyboardControlService cleaned up')
  }
}

export const keyboardControlService = new KeyboardControlService()
