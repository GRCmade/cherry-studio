import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const mouseMoveToolDefinition: Tool = {
  name: 'mouse_move',
  description: `Moves the mouse cursor to specified coordinates without clicking.

This tool is useful for:
- Hovering over UI elements to trigger tooltips
- Positioning cursor before drag operations
- Testing hover states

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
      smooth: {
        type: 'boolean',
        description: 'Use smooth movement animation',
        default: false
      },
      duration_ms: {
        type: 'number',
        description: 'Duration of smooth movement in milliseconds',
        default: 500,
        minimum: 0,
        maximum: 5000
      }
    },
    required: ['x', 'y']
  }
}

export interface MouseMoveToolInput {
  x: number
  y: number
  smooth?: boolean
  duration_ms?: number
}
