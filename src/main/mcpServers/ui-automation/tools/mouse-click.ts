/**
 * Mouse Click Tool Definition
 */

export const mouseClickToolDefinition = {
  name: 'mouse_click',
  description: `Moves the mouse to specified coordinates and performs a click action.

This tool is useful for:
- Clicking UI elements identified by screenshot_ui_elements
- Automating mouse interactions
- Testing UI workflows

Note: Requires accessibility permission on macOS.`,
  inputSchema: {
    type: 'object',
    properties: {
      x: {
        type: 'number',
        description: 'X coordinate on screen'
      },
      y: {
        type: 'number',
        description: 'Y coordinate on screen'
      },
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        description: 'Mouse button to click',
        default: 'left'
      },
      click_count: {
        type: 'number',
        description: 'Number of clicks (1 for single, 2 for double)',
        default: 1,
        minimum: 1,
        maximum: 3
      },
      delay_ms: {
        type: 'number',
        description: 'Delay before click in milliseconds',
        default: 100,
        minimum: 0,
        maximum: 5000
      }
    },
    required: ['x', 'y']
  }
}

export interface MouseClickToolInput {
  x: number
  y: number
  button?: 'left' | 'right' | 'middle'
  click_count?: number
  delay_ms?: number
}
