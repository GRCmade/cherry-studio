import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface ScrollToolInput {
  direction: 'up' | 'down' | 'left' | 'right'
  amount?: number
  x?: number
  y?: number
}

export const scrollToolDefinition: Tool = {
  name: 'scroll',
  description:
    'Scroll in the specified direction (up, down, left, right). Optionally specify a position (x, y) to scroll at that location, otherwise scrolls at current mouse position. Amount controls scroll distance (1-100, default 3).',
  inputSchema: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        enum: ['up', 'down', 'left', 'right'],
        description: 'The direction to scroll: up, down, left, or right'
      },
      amount: {
        type: 'number',
        description: 'Scroll amount (1-100). Higher values scroll more. Default is 3.',
        default: 3,
        minimum: 1,
        maximum: 100
      },
      x: {
        type: 'number',
        description: 'Optional X coordinate to scroll at. If not provided, scrolls at current mouse position.'
      },
      y: {
        type: 'number',
        description: 'Optional Y coordinate to scroll at. If not provided, scrolls at current mouse position.'
      }
    },
    required: ['direction']
  }
}
