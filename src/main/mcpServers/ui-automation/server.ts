import { loggerService } from '@logger'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { UIAutomationController } from './controller'
import {
  captureWindowToolDefinition,
  type CaptureWindowToolInput,
  extractTextToolDefinition,
  type ExtractTextToolInput,
  findElementToolDefinition,
  type FindElementToolInput,
  focusWindowToolDefinition,
  type FocusWindowToolInput,
  keyboardTypeToolDefinition,
  type KeyboardTypeToolInput,
  listWindowsToolDefinition,
  type ListWindowsToolInput,
  mouseClickToolDefinition,
  type MouseClickToolInput,
  mouseDragToolDefinition,
  type MouseDragToolInput,
  mouseMoveToolDefinition,
  type MouseMoveToolInput,
  screenshotToolDefinition,
  type ScreenshotToolInput,
  scrollToolDefinition,
  type ScrollToolInput,
  waitForElementToolDefinition,
  type WaitForElementToolInput,
  windowActionToolDefinition,
  type WindowActionToolInput
} from './tools'

const logger = loggerService.withContext('UIAutomationServer')

/**
 * MCP Server for UI Automation
 *
 * Provides tools for:
 * - Capturing screenshots and identifying UI elements
 * - Controlling mouse clicks at specified coordinates
 * - Listing all open windows
 * - Capturing screenshots of specific windows
 */
export class UIAutomationServer {
  public server: Server
  private controller = new UIAutomationController()

  constructor() {
    this.server = new Server(
      {
        name: '@cherry/ui-automation',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.registerHandlers()
    logger.info('UIAutomationServer created')
  }

  private registerHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Listing UI automation tools')
      return {
        tools: [
          screenshotToolDefinition,
          mouseClickToolDefinition,
          listWindowsToolDefinition,
          captureWindowToolDefinition,
          keyboardTypeToolDefinition,
          mouseMoveToolDefinition,
          mouseDragToolDefinition,
          focusWindowToolDefinition,
          windowActionToolDefinition,
          scrollToolDefinition,
          extractTextToolDefinition,
          findElementToolDefinition,
          waitForElementToolDefinition
        ]
      }
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      logger.info('Tool call received', { name, args })

      try {
        switch (name) {
          case 'screenshot_ui_elements': {
            const input = args as ScreenshotToolInput
            return await this.controller.captureAndIdentify(input)
          }

          case 'mouse_click': {
            const input = args as unknown as MouseClickToolInput
            return await this.controller.click(input)
          }

          case 'list_windows': {
            const input = args as unknown as ListWindowsToolInput
            return await this.controller.listWindows(input)
          }

          case 'capture_window': {
            const input = args as unknown as CaptureWindowToolInput
            return await this.controller.captureWindow(input)
          }

          case 'keyboard_type': {
            const input = args as unknown as KeyboardTypeToolInput
            return await this.controller.keyboardType(input)
          }

          case 'mouse_move': {
            const input = args as unknown as MouseMoveToolInput
            return await this.controller.mouseMove(input)
          }

          case 'mouse_drag': {
            const input = args as unknown as MouseDragToolInput
            return await this.controller.mouseDrag(input)
          }

          case 'focus_window': {
            const input = args as unknown as FocusWindowToolInput
            return await this.controller.focusWindow(input)
          }

          case 'window_action': {
            const input = args as unknown as WindowActionToolInput
            return await this.controller.windowAction(input)
          }

          case 'scroll': {
            const input = args as unknown as ScrollToolInput
            return await this.controller.scroll(input)
          }

          case 'extract_text': {
            const input = args as unknown as ExtractTextToolInput
            return await this.controller.extractText(input)
          }

          case 'find_element': {
            const input = args as unknown as FindElementToolInput
            return await this.controller.findElement(input)
          }

          case 'wait_for_element': {
            const input = args as unknown as WaitForElementToolInput
            return await this.controller.waitForElement(input)
          }

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        logger.error('Tool execution failed', {
          name,
          error: error instanceof Error ? error.message : String(error)
        })

        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    })
  }

  /**
   * Cleanup resources when server is shutting down
   */
  async cleanup() {
    await this.controller.cleanup()
    logger.info('UIAutomationServer cleaned up')
  }
}
