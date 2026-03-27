import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface CaptureWindowToolInput {
  /** Window ID to capture (from list_windows tool) */
  window_id: string
  /** Filter type for UI elements */
  filter_type?: 'all' | 'clickable' | 'buttons' | 'inputs'
}

export const captureWindowToolDefinition: Tool = {
  name: 'capture_window',
  description:
    'Capture a screenshot of a specific window and identify its UI elements. Use list_windows first to get the window_id.',
  inputSchema: {
    type: 'object',
    properties: {
      window_id: {
        type: 'string',
        description: 'The window ID obtained from list_windows tool'
      },
      filter_type: {
        type: 'string',
        enum: ['all', 'clickable', 'buttons', 'inputs'],
        description: 'Filter UI elements by type',
        default: 'clickable'
      }
    },
    required: ['window_id']
  }
}
