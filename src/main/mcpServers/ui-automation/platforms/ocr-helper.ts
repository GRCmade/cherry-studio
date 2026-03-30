import { loggerService } from '@logger'
import { getIpCountry } from '@main/utils/ipService'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { createWorker } from 'tesseract.js'

import type { UIElement } from './base'
import { detectClickableRegions } from './cv-helper'

const logger = loggerService.withContext('OcrHelper')

enum TesseractLangsDownloadUrl {
  CN = 'https://gitcode.com/beyondkmp/tessdata-best/releases/download/1.0.0/'
}

async function getLangPath(): Promise<string> {
  const country = await getIpCountry()
  return country.toLowerCase() === 'cn' ? TesseractLangsDownloadUrl.CN : ''
}

async function getCacheDir(): Promise<string> {
  const cacheDir = path.join(app.getPath('userData'), 'tesseract')
  if (
    !(await fs.promises
      .access(cacheDir, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false))
  ) {
    await fs.promises.mkdir(cacheDir, { recursive: true })
  }
  return cacheDir
}

/**
 * Extract UI elements from screenshot using OCR and Computer Vision
 * Combines text recognition (OCR) with visual button detection (CV)
 */
export async function extractUIElementsFromOCR(screenshot: Buffer): Promise<UIElement[]> {
  const elements: UIElement[] = []

  try {
    // Step 1: OCR for text elements
    const textElements = await extractTextElements(screenshot)
    elements.push(...textElements)

    // Step 2: CV for visual elements (buttons, icons)
    const visualElements = await detectClickableRegions(screenshot)
    elements.push(...visualElements)

    logger.info(
      `Extracted ${elements.length} UI elements (${textElements.length} text, ${visualElements.length} visual)`
    )
    return elements
  } catch (error) {
    logger.error('Failed to extract UI elements', {
      error: error instanceof Error ? error.message : String(error)
    })
    return elements // Return whatever we managed to extract
  }
}

/**
 * Extract text elements using OCR
 */
async function extractTextElements(screenshot: Buffer): Promise<UIElement[]> {
  try {
    // Get proper paths for tesseract
    const langPath = await getLangPath()
    const cachePath = await getCacheDir()

    // Use tesseract.js for OCR with proper configuration
    const worker = await createWorker(['eng', 'chi_sim'], undefined, {
      langPath,
      cachePath,
      logger: (m) => logger.debug('Tesseract worker', m)
    })

    const result = await worker.recognize(screenshot)
    await worker.terminate()

    logger.info('OCR recognition completed', {
      hasData: !!result.data,
      text: result.data.text?.substring(0, 100),
      confidence: result.data.confidence
    })

    const elements: UIElement[] = []
    let elementId = 1

    // Access the data object which contains words
    const data = result.data as any

    logger.debug('OCR data structure', {
      hasWords: !!data.words,
      wordsType: Array.isArray(data.words) ? 'array' : typeof data.words,
      wordsLength: data.words?.length,
      hasLines: !!data.lines,
      linesLength: data.lines?.length
    })

    // Process each word from OCR result
    if (data.words && Array.isArray(data.words)) {
      logger.info(`Processing ${data.words.length} words from OCR`)

      for (const word of data.words) {
        logger.debug('Word details', {
          text: word.text,
          confidence: word.confidence,
          hasBbox: !!word.bbox
        })

        // Filter out low-confidence results (lowered threshold to 50 for better detection)
        if (word.confidence < 50) {
          logger.debug(`Skipping low confidence word: "${word.text}" (${word.confidence})`)
          continue
        }

        const bbox = word.bbox
        const centerX = Math.round((bbox.x0 + bbox.x1) / 2)
        const centerY = Math.round((bbox.y0 + bbox.y1) / 2)

        elements.push({
          id: elementId++,
          window: 'Screen',
          controlType: 'Text',
          name: word.text,
          coords: [centerX, centerY],
          bounds: {
            x: bbox.x0,
            y: bbox.y0,
            width: bbox.x1 - bbox.x0,
            height: bbox.y1 - bbox.y0
          },
          metadata: {
            hasFocused: false,
            isEnabled: true,
            isVisible: true,
            isClickable: isLikelyClickable(word.text)
          }
        })
      }
    } else if (data.lines && Array.isArray(data.lines)) {
      // Fallback: use lines if words are not available
      logger.info(`No words found, processing ${data.lines.length} lines from OCR`)

      for (const line of data.lines) {
        if (line.confidence < 50 || !line.text || line.text.trim().length === 0) {
          continue
        }

        const bbox = line.bbox
        const centerX = Math.round((bbox.x0 + bbox.x1) / 2)
        const centerY = Math.round((bbox.y0 + bbox.y1) / 2)

        elements.push({
          id: elementId++,
          window: 'Screen',
          controlType: 'Text',
          name: line.text,
          coords: [centerX, centerY],
          bounds: {
            x: bbox.x0,
            y: bbox.y0,
            width: bbox.x1 - bbox.x0,
            height: bbox.y1 - bbox.y0
          },
          metadata: {
            hasFocused: false,
            isEnabled: true,
            isVisible: true,
            isClickable: isLikelyClickable(line.text)
          }
        })
      }
    } else {
      logger.warn('No words or lines found in OCR result', {
        hasText: !!data.text,
        textLength: data.text?.length,
        textPreview: data.text?.substring(0, 200)
      })
    }

    logger.info(`Extracted ${elements.length} UI elements from OCR`)
    return elements
  } catch (error) {
    logger.error('Failed to extract UI elements from OCR', {
      error: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

/**
 * Heuristic to determine if text is likely clickable
 * Based on common button/link text patterns
 */
function isLikelyClickable(text: string): boolean {
  const clickablePatterns = [
    /^(ok|cancel|yes|no|submit|send|save|delete|edit|close|open|start|stop|play|pause)$/i,
    /^(确定|取消|是|否|提交|发送|保存|删除|编辑|关闭|打开|开始|停止|播放|暂停)$/,
    /button|btn|link/i,
    /^(sign in|log in|log out|sign up|register)$/i,
    /^(登录|注册|退出)$/
  ]

  return clickablePatterns.some((pattern) => pattern.test(text.trim()))
}
