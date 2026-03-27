import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface WaitForElementToolInput {
  name?: string
  control_type?: string
  window?: string
  timeout?: number
  interval?: number
  filter_type?: 'all' | 'clickable' | 'buttons' | 'inputs'
}

export const waitForElementToolDefinition: Tool = {
  name: 'wait_for_element',
  description:
    'Wait for a UI element to appear on the screen. Polls periodically until the element is found or timeout is reached. Useful for waiting for windows to open, buttons to become available, or UI state changes.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Element name or label to wait for (partial match, case-insensitive)'
      },
      control_type: {
        type: 'string',
        description: 'Control type to wait for (e.g., Button, Edit, Link, Text, Window, etc.)'
      },
      window: {
        type: 'string',
        description: 'Window title or application name to wait for (partial match, case-insensitive)'
      },
      timeout: {
        type: 'number',
        description: 'Maximum time to wait in milliseconds. Default is 30000 (30 seconds).',
        default: 30000,
        minimum: 1000,
        maximum: 300000
      },
      interval: {
        type: 'number',
        description: 'Polling interval in milliseconds. Default is 500ms.',
        default: 500,
        minimum: 100,
        maximum: 5000
      },
      filter_type: {
        type: 'string',
        enum: ['all', 'clickable', 'buttons', 'inputs'],
        description:
          'Filter elements by type: all (all elements), clickable (interactive elements), buttons (button controls), inputs (input fields). Default is "all".',
        default: 'all'
      }
    }
  }
}
