import { platform } from 'node:os'

import type { UIAutomationPlatform } from './base'

/**
 * Factory function to create the appropriate UI automation platform
 * based on the current operating system
 *
 * Supported platforms:
 * - macOS: Uses native Accessibility API
 * - Windows: Uses native UI Automation API
 *
 * Note: This function is synchronous but imports are dynamic.
 * Platform implementations are loaded lazily to avoid loading
 * platform-specific code on unsupported systems.
 */
export function createUIAutomationPlatform(): UIAutomationPlatform {
  const os = platform()

  switch (os) {
    case 'darwin': {
      // macOS implementation using Accessibility API
      const { MacOSUIAutomation } = require('./macos')
      return new MacOSUIAutomation()
    }
    case 'win32': {
      // Windows implementation using UI Automation API
      const { WindowsUIAutomation } = require('./windows')
      return new WindowsUIAutomation()
    }
    default:
      throw new Error(`Unsupported platform: ${os}. Only macOS and Windows are supported.`)
  }
}

/**
 * Check if UI automation is supported on the current platform
 */
export function isUIAutomationSupported(): boolean {
  try {
    const platformImpl = createUIAutomationPlatform()
    return platformImpl.isSupported()
  } catch {
    return false
  }
}
