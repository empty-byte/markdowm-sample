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

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function ensureLoaded(): void {
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

function persist(): void {
  if (!canUseStorage() || !whiteboardCache) return

  try {
    window.localStorage.setItem(WHITEBOARD_STORAGE_KEY, JSON.stringify(whiteboardCache))
  } catch {
    // Ignore storage write failures (quota / private mode).
  }
}

function encodeTime(now: number): string {
  let value = now
  let output = ''
  for (let i = 0; i < 10; i += 1) {
    output = ULID_CHARS[value % 32] + output
    value = Math.floor(value / 32)
  }
  return output
}

function encodeRandom(length: number): string {
  let output = ''
  for (let i = 0; i < length; i += 1) {
    output += ULID_CHARS[Math.floor(Math.random() * 32)]
  }
  return output
}

export function createWhiteboardId(now = Date.now()): string {
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
  const normalizedTitle = title.trim() || '白板'
  return `![whiteboard:${normalizedTitle}](${createWhiteboardSource(id)})`
}

export function getWhiteboardById(id: string): WhiteboardRecord | null {
  ensureLoaded()
  return whiteboardCache![id] ?? null
}

export function upsertWhiteboard(input: { id: string; title: string; previewUrl: string; scene?: unknown }): WhiteboardRecord {
  ensureLoaded()

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
  window.dispatchEvent(new CustomEvent<WhiteboardEditRequestDetail>(WHITEBOARD_EDIT_REQUEST_EVENT, { detail }))
}
