import { exec } from 'child_process'
import { join } from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface WindowInfo {
  id: string
  name: string
  bundleId?: string
  processId?: number
}

export interface FocusWindowOptions {
  windowId?: string
  windowName?: string
}

export interface WindowActionOptions {
  action: 'minimize' | 'maximize' | 'close' | 'restore'
  windowId?: string
  windowName?: string
}

export interface FocusWindowResult {
  success: boolean
  windowId?: string
  windowName?: string
  message?: string
}

export interface WindowActionResult {
  success: boolean
  action: string
  windowId?: string
  windowName?: string
  message?: string
}

class WindowManagementService {
  private platform: NodeJS.Platform
  private swiftToolPath: string

  constructor() {
    this.platform = process.platform
    // Swift tool will be copied to out/main/ during build
    this.swiftToolPath = join(__dirname, 'macos-window-manager.swift')
  }

  /**
   * Focus a window by ID or name
   */
  async focusWindow(options: FocusWindowOptions): Promise<FocusWindowResult> {
    const { windowId, windowName } = options

    if (!windowId && !windowName) {
      throw new Error('Either windowId or windowName must be provided')
    }

    try {
      if (this.platform === 'darwin') {
        return await this.focusWindowMacOS(windowId, windowName)
      } else if (this.platform === 'win32') {
        return await this.focusWindowWindows(windowId, windowName)
      } else {
        throw new Error(`Platform ${this.platform} is not supported`)
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Perform window action (minimize, maximize, close, restore)
   */
  async windowAction(options: WindowActionOptions): Promise<WindowActionResult> {
    const { action, windowId, windowName } = options

    if (!windowId && !windowName) {
      throw new Error('Either windowId or windowName must be provided')
    }

    try {
      if (this.platform === 'darwin') {
        return await this.windowActionMacOS(action, windowId, windowName)
      } else if (this.platform === 'win32') {
        return await this.windowActionWindows(action, windowId, windowName)
      } else {
        throw new Error(`Platform ${this.platform} is not supported`)
      }
    } catch (error) {
      return {
        success: false,
        action,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Focus window on macOS using Swift tool
   */
  private async focusWindowMacOS(windowId?: string, windowName?: string): Promise<FocusWindowResult> {
    let identifier: string

    if (windowName) {
      identifier = windowName
    } else if (windowId) {
      // Extract process ID from Electron window ID format (e.g., "window:151235:0")
      const pidMatch = windowId.match(/window:(\d+):/)
      identifier = pidMatch && pidMatch[1] ? pidMatch[1] : windowId
    } else {
      throw new Error('Either windowId or windowName must be provided')
    }

    try {
      const { stdout } = await execAsync(`swift "${this.swiftToolPath}" focus "${identifier}"`)
      const result = JSON.parse(stdout.trim())

      if (result.success) {
        return {
          success: true,
          windowId,
          windowName,
          message: result.message || 'Window focused successfully'
        }
      } else {
        throw new Error(result.message || 'Failed to focus window')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check for accessibility permission error
      if (errorMessage.includes('-1719') || errorMessage.includes('不允许辅助访问')) {
        throw new Error(
          'Accessibility permission required. Please grant accessibility access to this application in System Settings > Privacy & Security > Accessibility'
        )
      }

      throw new Error(`Failed to focus window: ${errorMessage}`)
    }
  }

  /**
   * Focus window on Windows using PowerShell
   */
  private async focusWindowWindows(windowId?: string, windowName?: string): Promise<FocusWindowResult> {
    let psScript: string

    if (windowName) {
      // Focus by window name
      psScript = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
          }
"@
        $proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${windowName}*" } | Select-Object -First 1
        if ($proc) {
          [Win32]::SetForegroundWindow($proc.MainWindowHandle)
        }
      `
    } else if (windowId) {
      // Focus by window ID (process ID)
      psScript = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
          }
"@
        $proc = Get-Process -Id ${windowId}
        if ($proc) {
          [Win32]::SetForegroundWindow($proc.MainWindowHandle)
        }
      `
    } else {
      throw new Error('Either windowId or windowName must be provided')
    }

    try {
      await execAsync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`)
      return {
        success: true,
        windowId,
        windowName,
        message: 'Window focused successfully'
      }
    } catch (error) {
      throw new Error(`Failed to focus window: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Window action on macOS using Swift tool
   */
  private async windowActionMacOS(action: string, windowId?: string, windowName?: string): Promise<WindowActionResult> {
    let identifier: string

    if (windowName) {
      identifier = windowName
    } else if (windowId) {
      // Extract process ID from Electron window ID format (e.g., "window:151235:0")
      const pidMatch = windowId.match(/window:(\d+):/)
      identifier = pidMatch && pidMatch[1] ? pidMatch[1] : windowId
    } else {
      throw new Error('Either windowId or windowName must be provided')
    }

    try {
      const { stdout } = await execAsync(`swift "${this.swiftToolPath}" action "${action}" "${identifier}"`)
      const result = JSON.parse(stdout.trim())

      if (result.success) {
        return {
          success: true,
          action,
          windowId,
          windowName,
          message: result.message || `Window ${action} action completed successfully`
        }
      } else {
        throw new Error(result.message || 'Failed to perform window action')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check for accessibility permission error
      if (errorMessage.includes('-1719') || errorMessage.includes('不允许辅助访问')) {
        throw new Error(
          'Accessibility permission required. Please grant accessibility access to this application in System Settings > Privacy & Security > Accessibility'
        )
      }

      throw new Error(`Failed to perform window action: ${errorMessage}`)
    }
  }

  /**
   * Window action on Windows using PowerShell
   */
  private async windowActionWindows(
    action: string,
    windowId?: string,
    windowName?: string
  ): Promise<WindowActionResult> {
    const findWindow = windowName
      ? `Get-Process | Where-Object { $_.MainWindowTitle -like "*${windowName}*" } | Select-Object -First 1`
      : `Get-Process -Id ${windowId}`

    let psScript: string

    switch (action) {
      case 'minimize':
        psScript = `
          Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class Win32 {
              [DllImport("user32.dll")]
              public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            }
"@
          $proc = ${findWindow}
          if ($proc) {
            [Win32]::ShowWindow($proc.MainWindowHandle, 6)
          }
        `
        break
      case 'maximize':
        psScript = `
          Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class Win32 {
              [DllImport("user32.dll")]
              public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            }
"@
          $proc = ${findWindow}
          if ($proc) {
            [Win32]::ShowWindow($proc.MainWindowHandle, 3)
          }
        `
        break
      case 'restore':
        psScript = `
          Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class Win32 {
              [DllImport("user32.dll")]
              public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            }
"@
          $proc = ${findWindow}
          if ($proc) {
            [Win32]::ShowWindow($proc.MainWindowHandle, 9)
          }
        `
        break
      case 'close':
        psScript = `
          Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class Win32 {
              [DllImport("user32.dll")]
              public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
            }
"@
          $proc = ${findWindow}
          if ($proc) {
            [Win32]::PostMessage($proc.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
          }
        `
        break
      default:
        throw new Error(`Unsupported action: ${action}`)
    }

    try {
      await execAsync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`)
      return {
        success: true,
        action,
        windowId,
        windowName,
        message: `Window ${action} action completed successfully`
      }
    } catch (error) {
      throw new Error(`Failed to perform window action: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export const windowManagementService = new WindowManagementService()
