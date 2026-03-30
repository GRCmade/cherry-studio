import { loggerService } from '@logger'

import type { UIAutomationOptions, UIElement } from './base'
import { UIAutomationPlatform } from './base'
import { extractUIElementsFromWindowsAutomation } from './windows-uiautomation-helper'

const logger = loggerService.withContext('WindowsUIAutomation')

/**
 * Windows UI Automation implementation using native UI Automation API
 *
 * Uses Windows UI Automation API to directly read UI element tree
 * from the operating system, providing accurate element information
 * without relying on computer vision or OCR.
 */
export class WindowsUIAutomation extends UIAutomationPlatform {
  isSupported(): boolean {
    return process.platform === 'win32'
  }

  async initialize(): Promise<void> {
    logger.info('Windows UI Automation initialized (using native UI Automation API)')
  }

  async getUIElements(_screenshot?: Buffer, _options?: UIAutomationOptions): Promise<UIElement[]> {
    logger.info('Using Windows UI Automation API to extract UI elements')
    return extractUIElementsFromWindowsAutomation()
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for UI Automation API
  }

  getPlatformName(): string {
    return 'Windows'
  }
}
