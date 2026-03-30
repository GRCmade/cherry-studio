export interface FocusWindowToolInput {
  window_id?: string
  window_name?: string
}

export const focusWindowToolDefinition = {
  name: 'focus_window',
  description:
    'Focus (bring to front) a window by its ID or name. At least one of window_id or window_name must be provided. Use list_windows to get available window IDs and names.',
  inputSchema: {
    type: 'object',
    properties: {
      window_id: {
        type: 'string',
        description: 'The window ID (process ID) to focus. Get this from list_windows tool.'
      },
      window_name: {
        type: 'string',
        description: 'The window name to focus. Partial matches are supported (case-sensitive).'
      }
    }
  }
}
