import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface FindElementToolInput {
  name?: string
  control_type?: string
  window?: string
  filter_type?: 'all' | 'clickable' | 'buttons' | 'inputs'
  include_hidden?: boolean
}

export const findElementToolDefinition: Tool = {
  name: 'find_element',
  description:
    'Find UI elements on the screen by name, control type, or window. Returns a list of matching elements with their coordinates and properties. Useful for locating buttons, inputs, links, and other interactive elements.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Element name or label to search for (partial match, case-insensitive)'
      },
      control_type: {
        type: 'string',
        description: 'Control type to filter by (e.g., Button, Edit, Link, Text, Window, etc.)'
      },
      window: {
        type: 'string',
        description: 'Window title or application name to filter by (partial match, case-insensitive)'
      },
      filter_type: {
        type: 'string',
        enum: ['all', 'clickable', 'buttons', 'inputs'],
        description:
          'Filter elements by type: all (all elements), clickable (interactive elements), buttons (button controls), inputs (input fields). Default is "all".',
        default: 'all'
      },
      include_hidden: {
        type: 'boolean',
        description: 'Include hidden/invisible elements in results. Default is false.',
        default: false
      }
    }
  }
}
