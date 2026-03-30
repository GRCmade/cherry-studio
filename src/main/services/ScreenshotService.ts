import { loggerService } from '@logger'
import { desktopCapturer, screen } from 'electron'

const logger = loggerService.withContext('ScreenshotService')

export interface ScreenshotOptions {
  /** Display ID to capture (0 for primary display) */
  displayId?: number
  /** Image format */
  format?: 'png' | 'jpeg'
  /** JPEG quality (0-100) */
  quality?: number
  /** Window ID to capture (if specified, captures only this window) */
  windowId?: string
}

export interface WindowInfo {
  /** Window ID (source ID from desktopCapturer) */
  id: string
  /** Window title/name */
  name: string
  /** Application name */
  appName: string
  /** Window thumbnail (base64 encoded) */
  thumbnail?: string
}

export interface ScreenshotResult {
  /** Image buffer */
  buffer: Buffer
  /** Image format */
  format: 'png' | 'jpeg'
  /** Display bounds */
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Service for capturing screenshots using Electron's desktopCapturer API
 */
class ScreenshotService {
  /**
   * Capture a screenshot of the specified display or window
   */
  async captureScreen(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const { displayId = 0, format = 'png', quality = 80, windowId } = options

    try {
      // If windowId is specified, capture that window
      if (windowId) {
        return await this.captureWindow(windowId, format, quality)
      }

      // Otherwise, capture the display
      // Get all displays
      const displays = screen.getAllDisplays()
      const targetDisplay = displays[displayId]

      if (!targetDisplay) {
        throw new Error(`Display ${displayId} not found. Available displays: ${displays.length}`)
      }

      logger.info('Capturing screenshot', {
        displayId,
        format,
        bounds: targetDisplay.bounds
      })

      // Capture screen using desktopCapturer
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: targetDisplay.size
      })

      const source = sources[displayId]
      if (!source) {
        throw new Error(`Failed to capture display ${displayId}`)
      }

      // Convert thumbnail to buffer
      const thumbnail = source.thumbnail
      const buffer = format === 'jpeg' ? thumbnail.toJPEG(quality) : thumbnail.toPNG()

      logger.info('Screenshot captured successfully', {
        displayId,
        format,
        size: buffer.length
      })

      return {
        buffer,
        format,
        bounds: targetDisplay.bounds
      }
    } catch (error) {
      logger.error('Failed to capture screenshot', {
        error: error instanceof Error ? error.message : String(error),
        displayId,
        format
      })
      throw error
    }
  }

  /**
   * Capture a screenshot of a specific window
   */
  private async captureWindow(windowId: string, format: 'png' | 'jpeg', quality: number): Promise<ScreenshotResult> {
    logger.info('Capturing window screenshot', { windowId, format })

    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 3840, height: 2160 } // 4K max size
    })

    const source = sources.find((s) => s.id === windowId)
    if (!source) {
      throw new Error(`Window ${windowId} not found`)
    }

    const thumbnail = source.thumbnail
    const buffer = format === 'jpeg' ? thumbnail.toJPEG(quality) : thumbnail.toPNG()

    logger.info('Window screenshot captured successfully', {
      windowId,
      name: source.name,
      format,
      size: buffer.length
    })

    return {
      buffer,
      format,
      bounds: {
        x: 0,
        y: 0,
        width: thumbnail.getSize().width,
        height: thumbnail.getSize().height
      }
    }
  }

  /**
   * Get list of all windows with their information
   */
  async getWindows(includeThumbnails = false): Promise<WindowInfo[]> {
    try {
      logger.info('Getting window list', { includeThumbnails })

      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: includeThumbnails ? { width: 320, height: 180 } : { width: 1, height: 1 }
      })

      const windows = sources
        .filter((source) => {
          // Filter out empty windows and system windows
          return source.name && source.name.trim().length > 0 && !source.name.startsWith('Window')
        })
        .map((source) => ({
          id: source.id,
          name: source.name,
          appName: source.appIcon ? source.name.split(' - ').pop() || source.name : source.name,
          thumbnail: includeThumbnails ? source.thumbnail.toDataURL() : undefined
        }))

      logger.info(`Found ${windows.length} windows`)

      return windows
    } catch (error) {
      logger.error('Failed to get window list', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Get information about all available displays
   */
  getDisplays() {
    return screen.getAllDisplays().map((display, index) => ({
      id: index,
      bounds: display.bounds,
      size: display.size,
      scaleFactor: display.scaleFactor,
      isPrimary: display.id === screen.getPrimaryDisplay().id
    }))
  }
}

export const screenshotService = new ScreenshotService()
