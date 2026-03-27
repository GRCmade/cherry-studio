/**
 * Screenshot UI Elements Tool Definition
 */

export const screenshotToolDefinition = {
  name: 'screenshot_ui_elements',
  description: `Captures a screenshot of the screen and identifies all clickable UI elements.
Returns a list of UI elements with their coordinates, types, and names.

This tool is useful for:
- Identifying interactive elements on the screen
- Getting coordinates for mouse click operations
- Understanding the current UI state

Note: Requires screen recording permission on macOS.`,
  inputSchema: {
    type: 'object',
    properties: {
      display_id: {
        type: 'number',
        description: 'Display ID to capture (0 for primary display)',
        default: 0
      },
      filter_type: {
        type: 'string',
        enum: ['all', 'clickable', 'buttons', 'inputs'],
        description: 'Filter UI elements by type',
        default: 'clickable'
      }
    }
  }
}

export interface ScreenshotToolInput {
  display_id?: number
  filter_type?: 'all' | 'clickable' | 'buttons' | 'inputs'
}
