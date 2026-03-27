import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const keyboardTypeToolDefinition: Tool = {
  name: 'keyboard_type',
  description: `Types text using keyboard input simulation.

This tool is useful for:
- Filling text fields identified by screenshot_ui_elements
- Automating form input
- Simulating user typing

Note: Requires accessibility permission on macOS.`,
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to type'
      },
      delay_ms: {
        type: 'number',
        description: 'Delay between keystrokes in milliseconds',
        default: 50,
        minimum: 0,
        maximum: 1000
      },
      clear_before: {
        type: 'boolean',
        description: 'Clear existing text before typing (Ctrl+A, Delete)',
        default: false
      }
    },
    required: ['text']
  }
}

export interface KeyboardTypeToolInput {
  text: string
  delay_ms?: number
  clear_before?: boolean
}
