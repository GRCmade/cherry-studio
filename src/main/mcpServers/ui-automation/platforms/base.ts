/**
 * UI Automation Platform Abstraction Layer
 *
 * Provides a unified interface for UI element identification across different platforms.
 * Each platform (macOS, Windows, Linux) implements this interface with platform-specific APIs.
 */

export interface UIElement {
  /** Unique identifier for this element */
  id: number
  /** Window title or application name */
  window: string
  /** Control type (Button, Edit, Link, etc.) */
  controlType: string
  /** Element name or label */
  name: string
  /** Center point coordinates [x, y] */
  coords: [number, number]
  /** Bounding rectangle */
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Additional metadata */
  metadata: {
    hasFocused: boolean
    isEnabled: boolean
    isVisible: boolean
    isClickable: boolean
  }
}

export interface UIAutomationOptions {
  /** Filter elements by type */
  filterType?: 'all' | 'clickable' | 'buttons' | 'inputs'
  /** Include hidden elements */
  includeHidden?: boolean
  /** Maximum depth for tree traversal */
  maxDepth?: number
}

/**
 * Abstract base class for platform-specific UI automation implementations
 */
export abstract class UIAutomationPlatform {
  /**
   * Check if this platform is supported on the current OS
   */
  abstract isSupported(): boolean

  /**
   * Initialize the platform-specific automation system
   */
  abstract initialize(): Promise<void>

  /**
   * Get all UI elements from the current screen state
   * @param screenshot Optional screenshot buffer for OCR-based fallback
   * @param options Filtering and traversal options
   */
  abstract getUIElements(screenshot?: Buffer, options?: UIAutomationOptions): Promise<UIElement[]>

  /**
   * Cleanup resources and shutdown the automation system
   */
  abstract cleanup(): Promise<void>

  /**
   * Get platform name for logging and debugging
   */
  abstract getPlatformName(): string
}
