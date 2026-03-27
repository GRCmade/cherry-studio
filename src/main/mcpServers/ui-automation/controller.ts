import { loggerService } from '@logger'
import { keyboardControlService } from '@main/services/KeyboardControlService'
import { mouseControlService } from '@main/services/MouseControlService'
import { screenshotService } from '@main/services/ScreenshotService'
import { scrollService } from '@main/services/ScrollService'
import { textExtractionService } from '@main/services/TextExtractionService'
import { windowManagementService } from '@main/services/WindowManagementService'
import { shell, systemPreferences } from 'electron'

import { createUIAutomationPlatform } from './platforms'
import type { UIElement } from './platforms/base'
import type {
  CaptureWindowToolInput,
  ExtractTextToolInput,
  FindElementToolInput,
  FocusWindowToolInput,
  KeyboardTypeToolInput,
  ListWindowsToolInput,
  MouseClickToolInput,
  MouseDragToolInput,
  MouseMoveToolInput,
  ScreenshotToolInput,
  ScrollToolInput,
  WaitForElementToolInput,
  WindowActionToolInput
} from './tools'

const logger = loggerService.withContext('UIAutomationController')

export interface PermissionsStatus {
  screenRecording: boolean
  accessibility: boolean
}

/**
 * Controller for UI Automation operations
 * Coordinates screenshot capture, UI element identification, and mouse control
 */
export class UIAutomationController {
  private platform = createUIAutomationPlatform()
  private initialized = false

  /**
   * Initialize the controller and platform-specific automation
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      await this.platform.initialize()
      this.initialized = true
      logger.info('UIAutomationController initialized', {
        platform: this.platform.getPlatformName()
      })
    } catch (error) {
      logger.warn('Platform-specific UI automation not available, will use fallback', {
        platform: this.platform.getPlatformName(),
        error: error instanceof Error ? error.message : String(error)
      })
      // Don't throw - we can still do screenshots and mouse control
    }
  }

  /**
   * Capture screenshot and identify UI elements
   */
  async captureAndIdentify(input: ScreenshotToolInput) {
    const { display_id = 0, filter_type = 'clickable' } = input

    // Validate input
    if (display_id < 0 || !Number.isInteger(display_id)) {
      throw new Error(`Invalid display_id: ${display_id}. Must be a non-negative integer.`)
    }

    const validFilterTypes = ['all', 'clickable', 'buttons', 'inputs']
    if (filter_type && !validFilterTypes.includes(filter_type)) {
      throw new Error(`Invalid filter_type: ${filter_type}. Must be one of: ${validFilterTypes.join(', ')}`)
    }

    try {
      // Capture screenshot
      const screenshot = await screenshotService.captureScreen({
        displayId: display_id,
        format: 'jpeg',
        quality: 80
      })

      // Try to get UI elements from platform-specific API
      let elements: UIElement[] = []
      try {
        if (!this.initialized) {
          await this.initialize()
        }

        elements = await this.platform.getUIElements(screenshot.buffer, {
          filterType: filter_type
        })

        logger.info('UI elements identified', {
          count: elements.length,
          platform: this.platform.getPlatformName()
        })
      } catch (error) {
        logger.warn('Failed to identify UI elements, returning screenshot only', {
          error: error instanceof Error ? error.message : String(error)
        })
        // Return screenshot without elements
      }

      return {
        content: [
          {
            type: 'image',
            data: screenshot.buffer.toString('base64'),
            mimeType: `image/${screenshot.format}`
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                screenshot_captured: true,
                elements,
                total_elements: elements.length,
                platform: this.platform.getPlatformName(),
                display_bounds: screenshot.bounds
              },
              null,
              2
            )
          }
        ],
        isError: false
      }
    } catch (error) {
      logger.error('Failed to capture and identify UI elements', {
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Perform mouse click at specified coordinates
   */
  async click(input: MouseClickToolInput) {
    const { x, y, button = 'left', click_count = 1, delay_ms = 100 } = input

    // Validate input
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Invalid coordinates: (${x}, ${y}). Must be finite numbers.`)
    }

    if (click_count < 1 || click_count > 3 || !Number.isInteger(click_count)) {
      throw new Error(`Invalid click_count: ${click_count}. Must be an integer between 1 and 3.`)
    }

    if (delay_ms < 0 || delay_ms > 5000) {
      throw new Error(`Invalid delay_ms: ${delay_ms}. Must be between 0 and 5000.`)
    }

    try {
      // Check permissions first
      const perms = await this.checkPermissions()
      if (process.platform === 'darwin' && !perms.accessibility) {
        throw new Error(
          'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility'
        )
      }

      // Perform click
      const result = await mouseControlService.click({
        x,
        y,
        button,
        clickCount: click_count,
        delayMs: delay_ms
      })

      logger.info('Mouse click executed', result)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      logger.error('Failed to execute mouse click', {
        error: error instanceof Error ? error.message : String(error),
        x,
        y,
        button
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Check system permissions for UI automation
   */
  async checkPermissions(): Promise<PermissionsStatus> {
    if (process.platform === 'darwin') {
      return {
        screenRecording: systemPreferences.getMediaAccessStatus('screen') === 'granted',
        accessibility: systemPreferences.isTrustedAccessibilityClient(false)
      }
    }

    // Windows and Linux don't require explicit permissions
    return {
      screenRecording: true,
      accessibility: true
    }
  }

  /**
   * Request system permissions for UI automation
   */
  async requestPermissions(): Promise<void> {
    if (process.platform === 'darwin') {
      // Request screen recording permission
      // Note: Screen recording permission is requested automatically when using desktopCapturer
      // We just need to inform the user to grant it in System Preferences
      if (systemPreferences.getMediaAccessStatus('screen') !== 'granted') {
        logger.warn('Screen recording permission not granted. User needs to enable it in System Preferences.')
        // Open System Preferences to Screen Recording pane
        await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
      }

      // Request accessibility permission
      if (!systemPreferences.isTrustedAccessibilityClient(true)) {
        // Open System Preferences to Accessibility pane
        await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
      }
    }
  }

  /**
   * List all open windows
   */
  async listWindows(input: ListWindowsToolInput) {
    const { include_thumbnails = false } = input

    try {
      const windows = await screenshotService.getWindows(include_thumbnails)

      logger.info('Windows listed', { count: windows.length })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                windows,
                total_count: windows.length
              },
              null,
              2
            )
          }
        ],
        isError: false
      }
    } catch (error) {
      logger.error('Failed to list windows', {
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Capture screenshot of a specific window and identify UI elements
   */
  async captureWindow(input: CaptureWindowToolInput) {
    const { window_id, filter_type = 'clickable' } = input

    // Validate input
    if (!window_id || typeof window_id !== 'string') {
      throw new Error('Invalid window_id: Must be a non-empty string.')
    }

    const validFilterTypes = ['all', 'clickable', 'buttons', 'inputs']
    if (filter_type && !validFilterTypes.includes(filter_type)) {
      throw new Error(`Invalid filter_type: ${filter_type}. Must be one of: ${validFilterTypes.join(', ')}`)
    }

    try {
      // Capture window screenshot
      const screenshot = await screenshotService.captureScreen({
        windowId: window_id,
        format: 'jpeg',
        quality: 80
      })

      // Try to get UI elements from platform-specific API
      let elements: UIElement[] = []
      try {
        if (!this.initialized) {
          await this.initialize()
        }

        elements = await this.platform.getUIElements(screenshot.buffer, {
          filterType: filter_type
        })

        logger.info('UI elements identified from window', {
          count: elements.length,
          windowId: window_id,
          platform: this.platform.getPlatformName()
        })
      } catch (error) {
        logger.warn('Failed to identify UI elements, returning screenshot only', {
          error: error instanceof Error ? error.message : String(error)
        })
      }

      return {
        content: [
          {
            type: 'image',
            data: screenshot.buffer.toString('base64'),
            mimeType: `image/${screenshot.format}`
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                screenshot_captured: true,
                window_id,
                elements,
                total_elements: elements.length,
                platform: this.platform.getPlatformName(),
                window_bounds: screenshot.bounds
              },
              null,
              2
            )
          }
        ],
        isError: false
      }
    } catch (error) {
      logger.error('Failed to capture window', {
        error: error instanceof Error ? error.message : String(error),
        windowId: window_id
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Type text using keyboard
   */
  async keyboardType(input: KeyboardTypeToolInput) {
    const { text, delay_ms = 50, clear_before = false } = input

    // Validate input
    if (!text || text.length === 0) {
      throw new Error('Text cannot be empty')
    }

    try {
      // Check permissions
      const perms = await this.checkPermissions()
      if (process.platform === 'darwin' && !perms.accessibility) {
        throw new Error(
          'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility'
        )
      }

      // Perform typing
      const result = await keyboardControlService.type({
        text,
        delayMs: delay_ms,
        clearBefore: clear_before
      })

      logger.info('Text typed successfully', result)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      logger.error('Failed to type text', {
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Move mouse to specified coordinates
   */
  async mouseMove(input: MouseMoveToolInput) {
    const { x, y, smooth = false, duration_ms = 500 } = input

    // Validate input
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Invalid coordinates: (${x}, ${y}). Must be finite numbers.`)
    }

    if (duration_ms < 0 || duration_ms > 5000) {
      throw new Error(`Invalid duration_ms: ${duration_ms}. Must be between 0 and 5000.`)
    }

    try {
      // Check permissions
      const perms = await this.checkPermissions()
      if (process.platform === 'darwin' && !perms.accessibility) {
        throw new Error(
          'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility'
        )
      }

      // Perform move
      if (smooth) {
        await mouseControlService.moveSmooth(x, y, duration_ms)
      } else {
        await mouseControlService.moveTo(x, y)
      }

      const result = {
        success: true,
        movedTo: [x, y],
        smooth,
        timestamp: new Date().toISOString()
      }

      logger.info('Mouse moved', result)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      logger.error('Failed to move mouse', {
        error: error instanceof Error ? error.message : String(error),
        x,
        y
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Perform mouse drag operation
   */
  async mouseDrag(input: MouseDragToolInput) {
    const { start_x, start_y, end_x, end_y, button = 'left', duration_ms = 500 } = input

    // Validate input
    if (!Number.isFinite(start_x) || !Number.isFinite(start_y)) {
      throw new Error(`Invalid start coordinates: (${start_x}, ${start_y}). Must be finite numbers.`)
    }

    if (!Number.isFinite(end_x) || !Number.isFinite(end_y)) {
      throw new Error(`Invalid end coordinates: (${end_x}, ${end_y}). Must be finite numbers.`)
    }

    if (duration_ms < 100 || duration_ms > 5000) {
      throw new Error(`Invalid duration_ms: ${duration_ms}. Must be between 100 and 5000.`)
    }

    try {
      // Check permissions
      const perms = await this.checkPermissions()
      if (process.platform === 'darwin' && !perms.accessibility) {
        throw new Error(
          'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility'
        )
      }

      // Perform drag
      const result = await mouseControlService.drag({
        startX: start_x,
        startY: start_y,
        endX: end_x,
        endY: end_y,
        button,
        durationMs: duration_ms
      })

      logger.info('Mouse drag executed', result)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      logger.error('Failed to execute mouse drag', {
        error: error instanceof Error ? error.message : String(error),
        start_x,
        start_y,
        end_x,
        end_y,
        button
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Focus a window by ID or name
   */
  async focusWindow(input: FocusWindowToolInput) {
    const { window_id, window_name } = input

    // Validate input
    if (!window_id && !window_name) {
      throw new Error('Either window_id or window_name must be provided')
    }

    try {
      // Check permissions
      const perms = await this.checkPermissions()
      if (process.platform === 'darwin' && !perms.accessibility) {
        throw new Error(
          'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility'
        )
      }

      // Focus window
      const result = await windowManagementService.focusWindow({
        windowId: window_id,
        windowName: window_name
      })

      logger.info('Window focused', result)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.success
      }
    } catch (error) {
      logger.error('Failed to focus window', {
        error: error instanceof Error ? error.message : String(error),
        window_id,
        window_name
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Perform window action (minimize, maximize, close, restore)
   */
  async windowAction(input: WindowActionToolInput) {
    const { action, window_id, window_name } = input

    // Validate input
    if (!window_id && !window_name) {
      throw new Error('Either window_id or window_name must be provided')
    }

    if (!['minimize', 'maximize', 'close', 'restore'].includes(action)) {
      throw new Error(`Invalid action: ${action}. Must be one of: minimize, maximize, close, restore`)
    }

    try {
      // Check permissions
      const perms = await this.checkPermissions()
      if (process.platform === 'darwin' && !perms.accessibility) {
        throw new Error(
          'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility'
        )
      }

      // Perform action
      const result = await windowManagementService.windowAction({
        action,
        windowId: window_id,
        windowName: window_name
      })

      logger.info('Window action executed', result)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.success
      }
    } catch (error) {
      logger.error('Failed to execute window action', {
        error: error instanceof Error ? error.message : String(error),
        action,
        window_id,
        window_name
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Scroll in the specified direction
   */
  async scroll(input: ScrollToolInput) {
    const { direction, amount = 3, x, y } = input

    // Validate direction
    if (!['up', 'down', 'left', 'right'].includes(direction)) {
      throw new Error(`Invalid direction: ${direction}. Must be one of: up, down, left, right`)
    }

    try {
      // Check permissions
      const perms = await this.checkPermissions()
      if (process.platform === 'darwin' && !perms.accessibility) {
        throw new Error(
          'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility'
        )
      }

      // Perform scroll
      const result = await scrollService.scroll({
        direction,
        amount,
        x,
        y
      })

      logger.info('Scroll executed', result)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.success
      }
    } catch (error) {
      logger.error('Failed to execute scroll', {
        error: error instanceof Error ? error.message : String(error),
        direction,
        amount,
        x,
        y
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Extract text from screen region using OCR
   */
  async extractText(input: ExtractTextToolInput) {
    const { x, y, width, height, provider = 'system' } = input

    try {
      // Check permissions
      const perms = await this.checkPermissions()
      if (!perms.screenRecording) {
        throw new Error(
          'Screen recording permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Screen Recording'
        )
      }

      // Perform text extraction
      const result = await textExtractionService.extractText({
        x,
        y,
        width,
        height,
        provider
      })

      logger.info('Text extraction completed', result)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.success
      }
    } catch (error) {
      logger.error('Failed to extract text', {
        error: error instanceof Error ? error.message : String(error),
        x,
        y,
        width,
        height,
        provider
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Find UI elements by name, type, or window
   */
  async findElement(input: FindElementToolInput) {
    const { name, control_type, window, filter_type = 'all', include_hidden = false } = input

    try {
      // Check permissions
      const perms = await this.checkPermissions()
      if (process.platform === 'darwin' && !perms.accessibility) {
        throw new Error(
          'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility'
        )
      }

      // Get all UI elements
      await this.initialize()
      const allElements = await this.platform.getUIElements(undefined, {
        filterType: filter_type,
        includeHidden: include_hidden
      })

      // Filter elements based on search criteria
      let filteredElements = allElements

      if (name) {
        const searchName = name.toLowerCase()
        filteredElements = filteredElements.filter((el) => el.name.toLowerCase().includes(searchName))
      }

      if (control_type) {
        const searchType = control_type.toLowerCase()
        filteredElements = filteredElements.filter((el) => el.controlType.toLowerCase().includes(searchType))
      }

      if (window) {
        const searchWindow = window.toLowerCase()
        filteredElements = filteredElements.filter((el) => el.window.toLowerCase().includes(searchWindow))
      }

      logger.info('Element search completed', {
        totalElements: allElements.length,
        matchedElements: filteredElements.length,
        searchCriteria: { name, control_type, window, filter_type, include_hidden }
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                totalElements: allElements.length,
                matchedElements: filteredElements.length,
                elements: filteredElements,
                timestamp: new Date().toISOString()
              },
              null,
              2
            )
          }
        ],
        isError: false
      }
    } catch (error) {
      logger.error('Failed to find elements', {
        error: error instanceof Error ? error.message : String(error),
        name,
        control_type,
        window,
        filter_type,
        include_hidden
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Wait for a UI element to appear
   */
  async waitForElement(input: WaitForElementToolInput) {
    const { name, control_type, window, timeout = 30000, interval = 500, filter_type = 'all' } = input

    // Validate timeout and interval
    if (timeout < 1000 || timeout > 300000) {
      throw new Error('Timeout must be between 1000ms and 300000ms (5 minutes)')
    }
    if (interval < 100 || interval > 5000) {
      throw new Error('Interval must be between 100ms and 5000ms')
    }

    try {
      // Check permissions
      const perms = await this.checkPermissions()
      if (process.platform === 'darwin' && !perms.accessibility) {
        throw new Error(
          'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility'
        )
      }

      await this.initialize()

      const startTime = Date.now()
      let attempts = 0
      let foundElement: UIElement | undefined

      // Poll for element
      while (Date.now() - startTime < timeout) {
        attempts++

        // Get all UI elements
        const allElements = await this.platform.getUIElements(undefined, {
          filterType: filter_type,
          includeHidden: false
        })

        // Filter elements based on search criteria
        let filteredElements = allElements

        if (name) {
          const searchName = name.toLowerCase()
          filteredElements = filteredElements.filter((el) => el.name.toLowerCase().includes(searchName))
        }

        if (control_type) {
          const searchType = control_type.toLowerCase()
          filteredElements = filteredElements.filter((el) => el.controlType.toLowerCase().includes(searchType))
        }

        if (window) {
          const searchWindow = window.toLowerCase()
          filteredElements = filteredElements.filter((el) => el.window.toLowerCase().includes(searchWindow))
        }

        // If element found, return it
        if (filteredElements.length > 0) {
          foundElement = filteredElements[0]
          break
        }

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, interval))
      }

      const elapsedTime = Date.now() - startTime

      if (foundElement) {
        logger.info('Element found', {
          element: foundElement,
          attempts,
          elapsedTime,
          searchCriteria: { name, control_type, window }
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  found: true,
                  element: foundElement,
                  attempts,
                  elapsedTime,
                  timestamp: new Date().toISOString()
                },
                null,
                2
              )
            }
          ],
          isError: false
        }
      } else {
        logger.warn('Element not found within timeout', {
          attempts,
          elapsedTime,
          timeout,
          searchCriteria: { name, control_type, window }
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  found: false,
                  message: `Element not found within ${timeout}ms`,
                  attempts,
                  elapsedTime,
                  timestamp: new Date().toISOString()
                },
                null,
                2
              )
            }
          ],
          isError: false
        }
      }
    } catch (error) {
      logger.error('Failed to wait for element', {
        error: error instanceof Error ? error.message : String(error),
        name,
        control_type,
        window,
        timeout,
        interval
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.initialized) {
      await this.platform.cleanup()
      this.initialized = false
      logger.info('UIAutomationController cleaned up')
    }
  }
}

// Export singleton instance
export const uiAutomationController = new UIAutomationController()
