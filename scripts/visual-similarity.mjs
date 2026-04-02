#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const DEFAULT_VIEWPORT = { width: 1536, height: 960 }
const DEFAULT_THRESHOLD = 95
const DEFAULT_BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

function parseArgs(argv) {
  const args = {
    current: 'http://localhost:5173/',
    reference: 'C:/Users/Lenovo/Downloads/stitch/code.html',
    browser: '',
    outDir: '',
    threshold: DEFAULT_THRESHOLD,
    viewport: `${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height}`,
    masks: [],
    waitMs: 6000,
    metric: 'perceptual',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (!item.startsWith('--')) continue

    const [flag, inlineValue] = item.split('=', 2)
    const value = inlineValue ?? argv[i + 1]
    const consumeNext = inlineValue === undefined

    switch (flag) {
      case '--current': args.current = value; break
      case '--reference': args.reference = value; break
      case '--browser': args.browser = value; break
      case '--out-dir': args.outDir = value; break
      case '--threshold': args.threshold = Number(value); break
      case '--viewport': args.viewport = value; break
      case '--wait-ms': args.waitMs = Number(value); break
      case '--mask': args.masks.push(value); break
      case '--metric': args.metric = String(value || '').toLowerCase(); break
      default: break
    }

    if (consumeNext) i += 1
  }

  return args
}

function resolveViewport(value) {
  const match = /^(\d+)x(\d+)$/i.exec(String(value).trim())
  if (!match) throw new Error(`Invalid viewport "${value}". Use WIDTHxHEIGHT.`)
  return { width: Number(match[1]), height: Number(match[2]) }
}

function toFileUrl(value) {
  return !/^https?:\/\//i.test(value) && !/^file:\/\//i.test(value)
    ? pathToFileURL(path.resolve(value)).toString()
    : value
}

function resolveBrowserPath(input) {
  if (input && fs.existsSync(input)) return input
  const envBrowser = process.env.BROWSER_PATH
  if (envBrowser && fs.existsSync(envBrowser)) return envBrowser
  for (const candidate of DEFAULT_BROWSER_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }
  return ''
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function captureScreenshot(browserPath, url, outFile, viewport, waitMs, profileDir) {
  const args = [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--allow-file-access-from-files',
    '--force-device-scale-factor=1',
    '--no-sandbox',
    `--window-size=${viewport.width},${viewport.height}`,
    `--virtual-time-budget=${waitMs}`,
    '--run-all-compositor-stages-before-draw',
    `--user-data-dir=${profileDir}`,
    `--screenshot=${outFile}`,
    url,
  ]

  const result = spawnSync(browserPath, args, { stdio: 'pipe', windowsHide: true, encoding: 'utf8' })
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`Browser screenshot failed for ${url}\nCommand: ${browserPath} ${args.join(' ')}\n${details ? `Output:\n${details}\n` : ''}`)
  }
  if (!fs.existsSync(outFile)) {
    throw new Error(`Screenshot not found: ${outFile}`)
  }
}

function parsePng(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('Expected PNG screenshot output.')

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const chunks = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset); offset += 4
    const type = buffer.toString('ascii', offset, offset + 4); offset += 4
    const data = buffer.subarray(offset, offset + length); offset += length
    offset += 4
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data.readUInt8(8)
      colorType = data.readUInt8(9)
    } else if (type === 'IDAT') {
      chunks.push(data)
    } else if (type === 'IEND') {
      break
    }
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`)
  if (![2, 6].includes(colorType)) throw new Error(`Unsupported PNG color type: ${colorType}`)

  const inflated = zlib.inflateSync(Buffer.concat(chunks))
  const channels = colorType === 6 ? 4 : 3
  const rowSize = width * channels
  const output = Buffer.alloc(width * height * 4)
  const previousRow = Buffer.alloc(rowSize)
  const currentRow = Buffer.alloc(rowSize)

  let inputOffset = 0
  let outOffset = 0

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated.readUInt8(inputOffset); inputOffset += 1
    inflated.copy(currentRow, 0, inputOffset, inputOffset + rowSize)
    inputOffset += rowSize
    applyPngFilter(filterType, currentRow, previousRow, channels)

    for (let x = 0; x < width; x += 1) {
      const base = x * channels
      output[outOffset] = currentRow[base]
      output[outOffset + 1] = currentRow[base + 1]
      output[outOffset + 2] = currentRow[base + 2]
      output[outOffset + 3] = channels === 4 ? currentRow[base + 3] : 255
      outOffset += 4
    }

    currentRow.copy(previousRow)
  }

  return { width, height, data: output }
}

function applyPngFilter(filterType, currentRow, previousRow, channels) {
  switch (filterType) {
    case 0: return
    case 1:
      for (let i = 0; i < currentRow.length; i += 1) {
        const left = i >= channels ? currentRow[i - channels] : 0
        currentRow[i] = (currentRow[i] + left) & 0xff
      }
      return
    case 2:
      for (let i = 0; i < currentRow.length; i += 1) {
        const up = previousRow[i] ?? 0
        currentRow[i] = (currentRow[i] + up) & 0xff
      }
      return
    case 3:
      for (let i = 0; i < currentRow.length; i += 1) {
        const left = i >= channels ? currentRow[i - channels] : 0
        const up = previousRow[i] ?? 0
        currentRow[i] = (currentRow[i] + Math.floor((left + up) / 2)) & 0xff
      }
      return
    case 4:
      for (let i = 0; i < currentRow.length; i += 1) {
        const left = i >= channels ? currentRow[i - channels] : 0
        const up = previousRow[i] ?? 0
        const upLeft = i >= channels ? previousRow[i - channels] ?? 0 : 0
        currentRow[i] = (currentRow[i] + paethPredictor(left, up, upLeft)) & 0xff
      }
      return
    default:
      throw new Error(`Unsupported PNG filter type: ${filterType}`)
  }
}

function paethPredictor(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function clampInt(value, min, max) {
  return Math.min(Math.max(Math.trunc(value), min), max)
}

function normalizeMasks(maskList, width, height) {
  return maskList.map((entry) => {
    const parts = String(entry).split(',').map((part) => Number(part.trim()))
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
      throw new Error(`Invalid mask "${entry}". Use x,y,w,h.`)
    }
    let [x, y, w, h] = parts
    x = clampInt(x, 0, width)
    y = clampInt(y, 0, height)
    w = clampInt(w, 0, width - x)
    h = clampInt(h, 0, height - y)
    return { x, y, w, h }
  }).filter((rect) => rect.w > 0 && rect.h > 0)
}

function isMaskedPixel(x, y, masks) {
  return masks.some((rect) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h)
}

function compareStrict(left, right, masks) {
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error(`Image dimensions do not match: left ${left.width}x${left.height}, right ${right.width}x${right.height}`)
  }

  const width = left.width
  const height = left.height
  let comparedPixels = 0
  let squaredError = 0
  let absoluteError = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isMaskedPixel(x, y, masks)) continue
      const idx = (y * width + x) * 4
      for (let c = 0; c < 4; c += 1) {
        const delta = left.data[idx + c] - right.data[idx + c]
        squaredError += delta * delta
        absoluteError += Math.abs(delta)
      }
      comparedPixels += 1
    }
  }

  if (!comparedPixels) throw new Error('No pixels available after masks.')

  const totalChannels = comparedPixels * 4
  const rmse = Math.sqrt(squaredError / totalChannels)
  const similarity = Math.max(0, 1 - rmse / 255)
  return {
    similarity: similarity * 100,
    meanAbsDelta: absoluteError / totalChannels,
    comparedPixels,
    totalPixels: width * height,
  }
}

function comparePerceptual(left, right, masks, outWidth = 64, outHeight = 36) {
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error(`Image dimensions do not match: left ${left.width}x${left.height}, right ${right.width}x${right.height}`)
  }

  const width = left.width
  const height = left.height
  let comparedSamples = 0
  let absoluteError = 0

  for (let y = 0; y < outHeight; y += 1) {
    const y0 = Math.floor((y * height) / outHeight)
    const y1 = Math.max(y0, Math.floor(((y + 1) * height) / outHeight) - 1)

    for (let x = 0; x < outWidth; x += 1) {
      const x0 = Math.floor((x * width) / outWidth)
      const x1 = Math.max(x0, Math.floor(((x + 1) * width) / outWidth) - 1)

      let leftR = 0
      let leftG = 0
      let leftB = 0
      let rightR = 0
      let rightG = 0
      let rightB = 0
      let blockCount = 0

      for (let sy = y0; sy <= y1; sy += 1) {
        for (let sx = x0; sx <= x1; sx += 1) {
          if (isMaskedPixel(sx, sy, masks)) continue
          const idx = (sy * width + sx) * 4
          leftR += left.data[idx]
          leftG += left.data[idx + 1]
          leftB += left.data[idx + 2]
          rightR += right.data[idx]
          rightG += right.data[idx + 1]
          rightB += right.data[idx + 2]
          blockCount += 1
        }
      }

      if (!blockCount) continue

      absoluteError += Math.abs(leftR / blockCount - rightR / blockCount)
      absoluteError += Math.abs(leftG / blockCount - rightG / blockCount)
      absoluteError += Math.abs(leftB / blockCount - rightB / blockCount)
      comparedSamples += 1
    }
  }

  if (!comparedSamples) throw new Error('No perceptual samples available after masks.')

  const meanAbsDelta = absoluteError / (comparedSamples * 3)
  const similarity = Math.max(0, 1 - meanAbsDelta / 255)
  return {
    similarity: similarity * 100,
    meanAbsDelta,
    comparedPixels: comparedSamples,
    totalPixels: outWidth * outHeight,
    downscaledTo: `${outWidth}x${outHeight}`,
  }
}

function selectScore(metric, strictResult, perceptualResult) {
  if (metric === 'strict') return strictResult
  if (metric === 'hybrid') {
    return {
      ...perceptualResult,
      similarity: perceptualResult.similarity * 0.85 + strictResult.similarity * 0.15,
    }
  }
  return perceptualResult
}

function pct(v) {
  return `${v.toFixed(2)}%`
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const viewport = resolveViewport(args.viewport)
  const browserPath = resolveBrowserPath(args.browser)
  if (!browserPath) throw new Error('No browser executable found. Set --browser or BROWSER_PATH.')

  const outDir = path.resolve(args.outDir || path.join('output', 'visual-similarity', new Date().toISOString().replace(/[:.]/g, '-')))
  ensureDir(outDir)

  const currentUrl = toFileUrl(args.current)
  const referenceUrl = toFileUrl(args.reference)
  const currentShot = path.join(outDir, 'current.png')
  const referenceShot = path.join(outDir, 'reference.png')

  console.log(`Browser: ${browserPath}`)
  console.log(`Current: ${currentUrl}`)
  console.log(`Reference: ${referenceUrl}`)
  console.log(`Viewport: ${viewport.width}x${viewport.height}`)
  console.log(`Metric: ${args.metric}`)

  captureScreenshot(browserPath, referenceUrl, referenceShot, viewport, args.waitMs, path.join(outDir, 'profile-ref'))
  captureScreenshot(browserPath, currentUrl, currentShot, viewport, args.waitMs, path.join(outDir, 'profile-current'))

  const left = parsePng(fs.readFileSync(referenceShot))
  const right = parsePng(fs.readFileSync(currentShot))
  const masks = normalizeMasks(args.masks, left.width, left.height)
  if (masks.length) {
    console.log(`Masks: ${masks.map((m) => `${m.x},${m.y},${m.w},${m.h}`).join(' | ')}`)
  }

  const strictResult = compareStrict(left, right, masks)
  const perceptualResult = comparePerceptual(left, right, masks)
  const selected = selectScore(args.metric, strictResult, perceptualResult)
  const status = selected.similarity >= args.threshold ? 'PASS' : 'FAIL'

  console.log([
    `Perceptual similarity: ${pct(perceptualResult.similarity)}`,
    `Strict similarity: ${pct(strictResult.similarity)}`,
    `Selected similarity: ${pct(selected.similarity)}`,
    `Threshold: ${pct(args.threshold)}`,
    `Status: ${status}`,
    `Perceptual mean absolute channel delta: ${perceptualResult.meanAbsDelta.toFixed(2)} (${perceptualResult.downscaledTo})`,
    `Strict mean absolute channel delta: ${strictResult.meanAbsDelta.toFixed(2)}`,
    `Strict compared pixels: ${strictResult.comparedPixels}/${strictResult.totalPixels}`,
    `Artifacts: ${outDir}`,
  ].join('\n'))

  if (status !== 'PASS') process.exitCode = 1
}

main()


