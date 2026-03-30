import { loggerService } from '@logger'
import { execFile } from 'child_process'
import { app } from 'electron'
import path from 'path'
import { promisify } from 'util'

import type { UIElement } from './base'

const logger = loggerService.withContext('MacOSAccessibilityHelper')
const execFileAsync = promisify(execFile)

/**
 * Extract UI elements using macOS Accessibility API
 * This calls a Swift script that uses native macOS APIs
 */
export async function extractUIElementsFromAccessibility(): Promise<UIElement[]> {
  try {
    // Determine script path based on environment
    let scriptPath: string
    if (app.isPackaged) {
      // Production: script should be in resources
      scriptPath = path.join(process.resourcesPath, 'macos-accessibility.swift')
    } else {
      // Development: script is in source directory
      scriptPath = path.join(__dirname, 'macos-accessibility.swift')
    }

    logger.info('Calling macOS Accessibility API script', { scriptPath })

    // Execute Swift script
    const { stdout, stderr } = await execFileAsync('swift', [scriptPath], {
      timeout: 10000, // 10 second timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    })

    if (stderr) {
      logger.warn('Swift script stderr', { stderr })
    }

    // Parse JSON output
    const elements = JSON.parse(stdout) as AccessibilityElement[]

    logger.info(`Extracted ${elements.length} UI elements from Accessibility API`)

    // Convert to UIElement format
    return elements.map((elem) => ({
      id: elem.id,
      window: elem.window,
      controlType: elem.controlType,
      name: elem.name,
      coords: elem.coords as [number, number],
      bounds: elem.bounds,
      metadata: {
        hasFocused: elem.metadata.hasFocused,
        isEnabled: elem.metadata.isEnabled,
        isVisible: elem.metadata.isVisible,
        isClickable: elem.metadata.isClickable,
        role: elem.metadata.role,
        subrole: elem.metadata.subrole,
        value: elem.metadata.value,
        description: elem.metadata.description
      }
    }))
  } catch (error) {
    logger.error('Failed to extract UI elements from Accessibility API', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return []
  }
}

interface AccessibilityElement {
  id: number
  window: string
  controlType: string
  name: string
  coords: number[]
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  metadata: {
    hasFocused: boolean
    isEnabled: boolean
    isVisible: boolean
    isClickable: boolean
    role?: string
    subrole?: string
    value?: string
    description?: string
  }
}
