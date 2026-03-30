import { loggerService } from '@logger'
import { execFile } from 'child_process'
import { app } from 'electron'
import path from 'path'
import { promisify } from 'util'

import type { UIElement } from './base'

const logger = loggerService.withContext('WindowsUIAutomationHelper')
const execFileAsync = promisify(execFile)

/**
 * Extract UI elements using Windows UI Automation API
 * This calls a PowerShell script that uses native Windows APIs
 */
export async function extractUIElementsFromWindowsAutomation(): Promise<UIElement[]> {
  try {
    // Determine script path based on environment
    let scriptPath: string
    if (app.isPackaged) {
      // Production: script should be in resources
      scriptPath = path.join(process.resourcesPath, 'windows-uiautomation.ps1')
    } else {
      // Development: script is in source directory
      scriptPath = path.join(__dirname, 'windows-uiautomation.ps1')
    }

    logger.info('Calling Windows UI Automation API script', { scriptPath })

    // Execute PowerShell script
    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-NonInteractive', '-File', scriptPath],
      {
        timeout: 10000, // 10 second timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }
    )

    if (stderr) {
      logger.warn('PowerShell script stderr', { stderr })
    }

    // Parse JSON output
    const elements = JSON.parse(stdout) as WindowsUIElement[]

    logger.info(`Extracted ${elements.length} UI elements from Windows UI Automation API`)

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
        automationId: elem.metadata.automationId,
        className: elem.metadata.className
      }
    }))
  } catch (error) {
    logger.error('Failed to extract UI elements from Windows UI Automation API', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return []
  }
}

interface WindowsUIElement {
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
    automationId?: string
    className?: string
  }
}
