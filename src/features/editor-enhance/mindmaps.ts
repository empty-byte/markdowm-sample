export type MindmapSourceKind = 'image' | 'token'

export interface MindmapRecord {
  id: string
  title: string
  previewUrl: string
  scene?: unknown
  updatedAt: number
}

export interface MindmapEditRequestDetail {
  kind: MindmapSourceKind
  from: number
  to: number
  id: string
  title: string
  previewUrl: string
}

const MINDMAP_STORAGE_KEY = 'milkdown:mindmaps:v1'
const MINDMAP_SOURCE_PREFIX = 'mindmap://'
const MINDMAP_ID_PATTERN = /^[a-zA-Z0-9_-]+$/
const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const MINDMAP_EDIT_REQUEST_EVENT = 'milkdown:mindmap-edit-request'

let mindmapCache: Record<string, MindmapRecord> | null = null

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
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

function ensureMindmapsLoaded(): void {
  if (mindmapCache) return

  mindmapCache = {}
  if (!canUseStorage()) return

  try {
    const raw = window.localStorage.getItem(MINDMAP_STORAGE_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw) as Record<string, Partial<MindmapRecord>>
    Object.entries(parsed).forEach(([id, value]) => {
      if (!value || typeof value !== 'object') return
      if (!MINDMAP_ID_PATTERN.test(id)) return

      const title = typeof value.title === 'string' ? value.title : '思维导图'
      const previewUrl = typeof value.previewUrl === 'string' ? value.previewUrl : ''
      const scene = value.scene
      const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : Date.now()

      mindmapCache![id] = {
        id,
        title,
        previewUrl,
        scene,
        updatedAt,
      }
    })
  } catch {
    mindmapCache = {}
  }
}

function persistMindmaps(): void {
  if (!canUseStorage() || !mindmapCache) return

  try {
    window.localStorage.setItem(MINDMAP_STORAGE_KEY, JSON.stringify(mindmapCache))
  } catch {
    // Ignore storage write failures (quota / private mode).
  }
}

export function createMindmapId(now = Date.now()): string {
  return `mm_${encodeTime(now)}${encodeRandom(16)}`
}

export function extractMindmapId(source: string): string | null {
  if (!source.startsWith(MINDMAP_SOURCE_PREFIX)) return null
  const id = source.slice(MINDMAP_SOURCE_PREFIX.length).trim()
  if (!MINDMAP_ID_PATTERN.test(id)) return null
  return id
}

export function createMindmapSource(id: string): string {
  return `${MINDMAP_SOURCE_PREFIX}${id}`
}

export function createMindmapToken(title: string, id: string): string {
  const normalizedTitle = title.trim() || '思维导图'
  return `![mindmap:${normalizedTitle}](${createMindmapSource(id)})`
}

export function getMindmapById(id: string): MindmapRecord | null {
  ensureMindmapsLoaded()
  return mindmapCache![id] ?? null
}

export function upsertMindmap(input: { id: string; title: string; previewUrl: string; scene?: unknown }): MindmapRecord {
  ensureMindmapsLoaded()

  const record: MindmapRecord = {
    id: input.id,
    title: input.title.trim() || '思维导图',
    previewUrl: input.previewUrl.trim(),
    scene: input.scene,
    updatedAt: Date.now(),
  }

  mindmapCache![record.id] = record
  persistMindmaps()

  return record
}

export function removeMindmap(id: string): void {
  ensureMindmapsLoaded()
  if (!mindmapCache![id]) return

  delete mindmapCache![id]
  persistMindmaps()
}

export function emitMindmapEditRequest(detail: MindmapEditRequestDetail): void {
  window.dispatchEvent(new CustomEvent<MindmapEditRequestDetail>(MINDMAP_EDIT_REQUEST_EVENT, { detail }))
}
