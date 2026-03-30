import { loggerService } from '@logger'
import sharp from 'sharp'

import type { UIElement } from './base'

const logger = loggerService.withContext('CVHelper')

/**
 * Detect potential clickable UI elements using computer vision
 * This detects buttons, icons, and other interactive elements based on visual features
 */
export async function detectClickableRegions(screenshot: Buffer): Promise<UIElement[]> {
  try {
    const image = sharp(screenshot)
    const metadata = await image.metadata()

    if (!metadata.width || !metadata.height) {
      logger.warn('Invalid image metadata')
      return []
    }

    // Convert to grayscale and detect edges
    const edges = await image
      .clone()
      .grayscale()
      .normalise()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Edge detection kernel
      })
      .raw()
      .toBuffer()

    // Analyze the edge-detected image to find rectangular regions
    const regions = findRectangularRegions(edges, metadata.width, metadata.height)

    logger.info(`Detected ${regions.length} potential clickable regions`)

    // Convert regions to UI elements
    const elements: UIElement[] = regions.map((region, index) => ({
      id: 1000 + index, // Start from 1000 to avoid conflict with OCR elements
      window: 'Screen',
      controlType: 'Button',
      name: `Clickable Region ${index + 1}`,
      coords: [region.centerX, region.centerY],
      bounds: {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height
      },
      metadata: {
        hasFocused: false,
        isEnabled: true,
        isVisible: true,
        isClickable: true
      }
    }))

    return elements
  } catch (error) {
    logger.error('Failed to detect clickable regions', {
      error: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

interface Region {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

/**
 * Find rectangular regions in edge-detected image
 * This is a simplified algorithm that looks for clusters of edges
 */
function findRectangularRegions(edgeData: Buffer, width: number, height: number): Region[] {
  const regions: Region[] = []
  const threshold = 128 // Edge intensity threshold
  const minSize = 20 // Minimum button size (20x20 pixels)
  const maxSize = 200 // Maximum button size (200x200 pixels)
  const gridSize = 40 // Sample every 40 pixels to find potential regions

  // Sample the image in a grid pattern
  for (let y = 0; y < height - minSize; y += gridSize) {
    for (let x = 0; x < width - minSize; x += gridSize) {
      // Check if this region has significant edges (potential button)
      const edgeCount = countEdgesInRegion(edgeData, x, y, minSize, minSize, width, threshold)

      // If we found edges, try to find the exact bounds
      if (edgeCount > minSize * 2) {
        // Heuristic: buttons typically have edges on all sides
        const region = refineRegion(x, y, width, height, minSize, maxSize)

        if (region) {
          // Check if this region overlaps with existing regions
          const overlaps = regions.some((r) => regionsOverlap(r, region))

          if (!overlaps) {
            regions.push(region)
          }
        }
      }
    }
  }

  return regions
}

/**
 * Count edges in a rectangular region
 */
function countEdgesInRegion(
  data: Buffer,
  x: number,
  y: number,
  w: number,
  h: number,
  imageWidth: number,
  threshold: number
): number {
  let count = 0

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx
      const py = y + dy
      const index = py * imageWidth + px

      if (index < data.length && data[index] > threshold) {
        count++
      }
    }
  }

  return count
}

/**
 * Refine region bounds to find the actual button area
 */
function refineRegion(
  startX: number,
  startY: number,
  imageWidth: number,
  imageHeight: number,
  minSize: number,
  maxSize: number
): Region | null {
  // Simple approach: use a fixed size region centered on the detected point
  // In a more sophisticated implementation, we would trace the edges to find exact bounds

  const size = Math.min(maxSize, Math.max(minSize, 40)) // Default to 40x40

  const x = Math.max(0, startX)
  const y = Math.max(0, startY)
  const width = Math.min(size, imageWidth - x)
  const height = Math.min(size, imageHeight - y)

  if (width < minSize || height < minSize) {
    return null
  }

  return {
    x,
    y,
    width,
    height,
    centerX: x + Math.floor(width / 2),
    centerY: y + Math.floor(height / 2)
  }
}

/**
 * Check if two regions overlap
 */
function regionsOverlap(r1: Region, r2: Region): boolean {
  return !(r1.x + r1.width < r2.x || r2.x + r2.width < r1.x || r1.y + r1.height < r2.y || r2.y + r2.height < r1.y)
}
