import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface ListWindowsToolInput {
  /** Whether to include window thumbnails (base64 encoded) */
  include_thumbnails?: boolean
}

export const listWindowsToolDefinition: Tool = {
  name: 'list_windows',
  description:
    'List all open windows with their IDs and names. Use this to discover available windows before capturing a specific window screenshot.',
  inputSchema: {
    type: 'object',
    properties: {
      include_thumbnails: {
        type: 'boolean',
        description: 'Whether to include small preview thumbnails of each window (base64 encoded)',
        default: false
      }
    }
  }
}
