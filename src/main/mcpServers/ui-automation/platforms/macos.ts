import { loggerService } from '@logger'

import type { UIAutomationOptions, UIElement } from './base'
import { UIAutomationPlatform } from './base'
import { extractUIElementsFromAccessibility } from './macos-accessibility-helper'

const logger = loggerService.withContext('MacOSUIAutomation')

/**
 * macOS UI Automation implementation using native Accessibility API
 *
 * Uses macOS Accessibility API to directly read UI element tree
 * from the operating system, providing accurate element information
 * without relying on computer vision or OCR.
 */
export class MacOSUIAutomation extends UIAutomationPlatform {
  isSupported(): boolean {
    return process.platform === 'darwin'
  }

  async initialize(): Promise<void> {
    logger.info('macOS UI Automation initialized (using native Accessibility API)')
  }

  async getUIElements(_screenshot?: Buffer, _options?: UIAutomationOptions): Promise<UIElement[]> {
    logger.info('Using macOS Accessibility API to extract UI elements')
    return extractUIElementsFromAccessibility()
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for Accessibility API
  }

  getPlatformName(): string {
    return 'macOS'
  }
}
