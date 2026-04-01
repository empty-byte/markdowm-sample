export type WhiteboardSourceKind = 'image' | 'token'

export interface WhiteboardRecord {
  id: string
  title: string
  previewUrl: string
  scene?: unknown
  updatedAt: number
}

export interface WhiteboardEditRequestDetail {
  kind: WhiteboardSourceKind
  from: number
  to: number
  id: string
  title: string
  previewUrl: string
}

const WHITEBOARD_STORAGE_KEY = 'milkdown:whiteboards:v1'
const WHITEBOARD_SOURCE_PREFIX = 'whiteboard://'
const WHITEBOARD_ID_PATTERN = /^[a-zA-Z0-9_-]+$/
const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const WHITEBOARD_EDIT_REQUEST_EVENT = 'milkdown:whiteboard-edit-request'

let whiteboardCache: Record<string, WhiteboardRecord> | null = null

/**
 * Handle canUseStorage logic.
 * @returns Return value.
 */
function canUseStorage(): boolean {
  // Keep SSR-safe by checking browser globals before touching localStorage.
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * Handle ensureLoaded logic.
 */
function ensureLoaded(): void {
  // Lazy-load local cache once; all read/write operations go through this guard.
  if (whiteboardCache) return

  whiteboardCache = {}
  if (!canUseStorage()) return

  try {
    const raw = window.localStorage.getItem(WHITEBOARD_STORAGE_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw) as Record<string, Partial<WhiteboardRecord>>
    Object.entries(parsed).forEach(([id, value]) => {
      if (!value || typeof value !== 'object') return
      if (!WHITEBOARD_ID_PATTERN.test(id)) return

      const title = typeof value.title === 'string' ? value.title : '白板'
      const previewUrl = typeof value.previewUrl === 'string' ? value.previewUrl : ''
      const scene = value.scene
      const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : Date.now()

      whiteboardCache![id] = {
        id,
        title,
        previewUrl,
        scene,
        updatedAt,
      }
    })
  } catch {
    whiteboardCache = {}
  }
}

/**
 * Handle persist logic.
 */
function persist(): void {
  // Persist in one place so error handling stays centralized.
  if (!canUseStorage() || !whiteboardCache) return

  try {
    window.localStorage.setItem(WHITEBOARD_STORAGE_KEY, JSON.stringify(whiteboardCache))
  } catch {
    // Ignore storage write failures (quota / private mode).
  }
}

/**
 * Handle encodeTime logic.
 * @param now - Parameter.
 * @returns Return value.
 */
function encodeTime(now: number): string {
  // ULID-style timestamp component (base32, fixed length).
  let value = now
  let output = ''
  for (let i = 0; i < 10; i += 1) {
    output = ULID_CHARS[value % 32] + output
    value = Math.floor(value / 32)
  }
  return output
}

/**
 * Handle encodeRandom logic.
 * @param length - Parameter.
 * @returns Return value.
 */
function encodeRandom(length: number): string {
  // ULID-style random component for collision reduction.
  let output = ''
  for (let i = 0; i < length; i += 1) {
    output += ULID_CHARS[Math.floor(Math.random() * 32)]
  }
  return output
}

export function createWhiteboardId(now = Date.now()): string {
  // Prefix keeps different attachment types easy to distinguish in Markdown.
  return `wb_${encodeTime(now)}${encodeRandom(16)}`
}

export function extractWhiteboardId(source: string): string | null {
  if (!source.startsWith(WHITEBOARD_SOURCE_PREFIX)) return null
  const id = source.slice(WHITEBOARD_SOURCE_PREFIX.length).trim()
  if (!WHITEBOARD_ID_PATTERN.test(id)) return null
  return id
}

export function createWhiteboardSource(id: string): string {
  return `${WHITEBOARD_SOURCE_PREFIX}${id}`
}

export function createWhiteboardToken(title: string, id: string): string {
  // Canonical token format used by NodeView parser and editor replace logic.
  const normalizedTitle = title.trim() || '白板'
  return `![whiteboard:${normalizedTitle}](${createWhiteboardSource(id)})`
}

export function getWhiteboardById(id: string): WhiteboardRecord | null {
  ensureLoaded()
  return whiteboardCache![id] ?? null
}

export function upsertWhiteboard(input: { id: string; title: string; previewUrl: string; scene?: unknown }): WhiteboardRecord {
  ensureLoaded()

  // Always overwrite by id to keep "insert" and "edit" on same code path.
  const record: WhiteboardRecord = {
    id: input.id,
    title: input.title.trim() || '白板',
    previewUrl: input.previewUrl.trim(),
    scene: input.scene,
    updatedAt: Date.now(),
  }

  whiteboardCache![record.id] = record
  persist()

  return record
}

export function removeWhiteboard(id: string): void {
  ensureLoaded()
  if (!whiteboardCache![id]) return

  delete whiteboardCache![id]
  persist()
}

export function isValidWhiteboardPreviewUrl(value: string): boolean {
  const url = value.trim()
  if (!url) return false

  if (/^(https?:|blob:|data:)/i.test(url)) return true
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return true

  return false
}

export function emitWhiteboardEditRequest(detail: WhiteboardEditRequestDetail): void {
  // Decouples node click handling from Vue dialog component tree.
  window.dispatchEvent(new CustomEvent<WhiteboardEditRequestDetail>(WHITEBOARD_EDIT_REQUEST_EVENT, { detail }))
}
