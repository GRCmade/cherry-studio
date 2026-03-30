import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const mouseDragToolDefinition: Tool = {
  name: 'mouse_drag',
  description: `Performs a mouse drag operation from start to end coordinates.

This tool is useful for:
- Dragging and dropping UI elements
- Selecting text or regions
- Resizing windows or elements

Note: Requires accessibility permission on macOS.`,
  inputSchema: {
    type: 'object',
    properties: {
      start_x: {
        type: 'number',
        description: 'Starting X coordinate'
      },
      start_y: {
        type: 'number',
        description: 'Starting Y coordinate'
      },
      end_x: {
        type: 'number',
        description: 'Ending X coordinate'
      },
      end_y: {
        type: 'number',
        description: 'Ending Y coordinate'
      },
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        description: 'Mouse button to use for drag',
        default: 'left'
      },
      duration_ms: {
        type: 'number',
        description: 'Duration of drag operation in milliseconds',
        default: 500,
        minimum: 100,
        maximum: 5000
      }
    },
    required: ['start_x', 'start_y', 'end_x', 'end_y']
  }
}

export interface MouseDragToolInput {
  start_x: number
  start_y: number
  end_x: number
  end_y: number
  button?: 'left' | 'right' | 'middle'
  duration_ms?: number
}
