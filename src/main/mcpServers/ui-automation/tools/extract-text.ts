import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface ExtractTextToolInput {
  x?: number
  y?: number
  width?: number
  height?: number
  provider?: 'system' | 'tesseract'
}

export const extractTextToolDefinition: Tool = {
  name: 'extract_text',
  description:
    'Extract text from a screen region using OCR (Optical Character Recognition). If no region is specified, extracts text from the entire screen. Supports two OCR providers: system (native OS OCR, fastest, macOS/Windows only) and tesseract (open source, cross-platform).',
  inputSchema: {
    type: 'object',
    properties: {
      x: {
        type: 'number',
        description: 'X coordinate of the top-left corner of the region to extract text from'
      },
      y: {
        type: 'number',
        description: 'Y coordinate of the top-left corner of the region to extract text from'
      },
      width: {
        type: 'number',
        description: 'Width of the region to extract text from'
      },
      height: {
        type: 'number',
        description: 'Height of the region to extract text from'
      },
      provider: {
        type: 'string',
        enum: ['system', 'tesseract'],
        description:
          'OCR provider to use. Default is "system" (native OS OCR). Options: system (fastest, macOS/Windows only), tesseract (cross-platform, slower).',
        default: 'system'
      }
    }
  }
}
