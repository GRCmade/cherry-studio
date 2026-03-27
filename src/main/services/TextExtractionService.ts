import { loggerService } from '@logger'
import { isLinux, isWin } from '@main/constant'
import { screenshotService } from '@main/services/ScreenshotService'
import { OcrAccuracy, recognize } from '@napi-rs/system-ocr'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'

const logger = loggerService.withContext('TextExtractionService')

export interface ExtractTextOptions {
  x?: number
  y?: number
  width?: number
  height?: number
  provider?: 'system' | 'tesseract'
}

export interface ExtractTextResult {
  success: boolean
  text: string
  region?: {
    x: number
    y: number
    width: number
    height: number
  }
  provider: string
  timestamp: string
}

class TextExtractionService {
  /**
   * Extract text from a screen region using OCR
   */
  async extractText(options: ExtractTextOptions): Promise<ExtractTextResult> {
    const { x, y, width, height, provider = 'system' } = options

    try {
      // Take screenshot
      const screenshot = await screenshotService.captureScreen()

      // Crop to region if specified
      let imageBuffer: Buffer
      let region: { x: number; y: number; width: number; height: number } | undefined

      if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
        // Validate region
        if (x < 0 || y < 0 || width <= 0 || height <= 0) {
          throw new Error('Invalid region: coordinates must be non-negative and dimensions must be positive')
        }

        // Crop image
        imageBuffer = await sharp(screenshot.buffer).extract({ left: x, top: y, width, height }).toBuffer()

        region = { x, y, width, height }
      } else {
        // Use full screenshot
        imageBuffer = screenshot.buffer
      }

      // Perform OCR based on provider
      let text: string

      if (provider === 'system') {
        if (isLinux) {
          throw new Error('System OCR is not supported on Linux')
        }
        const result = await recognize(imageBuffer, OcrAccuracy.Accurate, isWin ? undefined : undefined)
        text = result.text
      } else if (provider === 'tesseract') {
        const worker = await createWorker('eng')
        const result = await worker.recognize(imageBuffer)
        text = result.data.text
        await worker.terminate()
      } else {
        throw new Error(`Unknown OCR provider: ${provider}`)
      }

      logger.info('Text extraction completed', {
        provider,
        textLength: text.length,
        region
      })

      return {
        success: true,
        text,
        region,
        provider,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error('Text extraction failed', {
        error: error instanceof Error ? error.message : String(error),
        options
      })
      throw error
    }
  }
}

export const textExtractionService = new TextExtractionService()
