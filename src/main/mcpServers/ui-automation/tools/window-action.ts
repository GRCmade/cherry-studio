export interface WindowActionToolInput {
  action: 'minimize' | 'maximize' | 'close' | 'restore'
  window_id?: string
  window_name?: string
}

export const windowActionToolDefinition = {
  name: 'window_action',
  description:
    'Perform an action on a window (minimize, maximize, close, or restore). At least one of window_id or window_name must be provided along with the action. Use list_windows to get available window IDs and names.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['minimize', 'maximize', 'close', 'restore'],
        description:
          'The action to perform: minimize (hide window), maximize (full screen), close (close window), restore (return to normal size)'
      },
      window_id: {
        type: 'string',
        description: 'The window ID (process ID) to act on. Get this from list_windows tool.'
      },
      window_name: {
        type: 'string',
        description: 'The window name to act on. Partial matches are supported (case-sensitive).'
      }
    },
    required: ['action']
  }
}
