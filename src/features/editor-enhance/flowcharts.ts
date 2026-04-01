export type FlowchartSourceKind = 'image' | 'token'

export interface FlowchartRecord {
  id: string
  title: string
  previewUrl: string
  scene?: unknown
  updatedAt: number
}

export interface FlowchartEditRequestDetail {
  kind: FlowchartSourceKind
  from: number
  to: number
  id: string
  title: string
  previewUrl: string
}

const FLOWCHART_STORAGE_KEY = 'milkdown:flowcharts:v1'
const FLOWCHART_SOURCE_PREFIX = 'flowchart://'
const FLOWCHART_ID_PATTERN = /^[a-zA-Z0-9_-]+$/
const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const FLOWCHART_EDIT_REQUEST_EVENT = 'milkdown:flowchart-edit-request'

let flowchartCache: Record<string, FlowchartRecord> | null = null

/**
 * Handle canUseStorage logic.
 * @returns Return value.
 */
function canUseStorage(): boolean {
  // Keep SSR-safe by checking browser globals before touching localStorage.
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
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

/**
 * Handle ensureFlowchartLoaded logic.
 */
function ensureFlowchartLoaded(): void {
  // Lazy-load local cache once; all read/write operations go through this guard.
  if (flowchartCache) return

  flowchartCache = {}
  if (!canUseStorage()) return

  try {
    const raw = window.localStorage.getItem(FLOWCHART_STORAGE_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw) as Record<string, Partial<FlowchartRecord>>
    Object.entries(parsed).forEach(([id, value]) => {
      if (!value || typeof value !== 'object') return
      if (!FLOWCHART_ID_PATTERN.test(id)) return

      const title = typeof value.title === 'string' ? value.title : '流程图'
      const previewUrl = typeof value.previewUrl === 'string' ? value.previewUrl : ''
      const scene = value.scene
      const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : Date.now()

      flowchartCache![id] = {
        id,
        title,
        previewUrl,
        scene,
        updatedAt,
      }
    })
  } catch {
    flowchartCache = {}
  }
}

/**
 * Handle persistFlowcharts logic.
 */
function persistFlowcharts(): void {
  // Persist in one place so error handling stays centralized.
  if (!canUseStorage() || !flowchartCache) return

  try {
    window.localStorage.setItem(FLOWCHART_STORAGE_KEY, JSON.stringify(flowchartCache))
  } catch {
    // Ignore storage write failures (quota / private mode).
  }
}

export function createFlowchartId(now = Date.now()): string {
  // Prefix keeps different attachment types easy to distinguish in Markdown.
  return `fc_${encodeTime(now)}${encodeRandom(16)}`
}

export function extractFlowchartId(source: string): string | null {
  if (!source.startsWith(FLOWCHART_SOURCE_PREFIX)) return null
  const id = source.slice(FLOWCHART_SOURCE_PREFIX.length).trim()
  if (!FLOWCHART_ID_PATTERN.test(id)) return null
  return id
}

export function createFlowchartSource(id: string): string {
  return `${FLOWCHART_SOURCE_PREFIX}${id}`
}

export function createFlowchartToken(title: string, id: string): string {
  // Canonical token format used by NodeView parser and editor replace logic.
  const normalizedTitle = title.trim() || '流程图'
  return `![flowchart:${normalizedTitle}](${createFlowchartSource(id)})`
}

export function getFlowchartById(id: string): FlowchartRecord | null {
  ensureFlowchartLoaded()
  return flowchartCache![id] ?? null
}

export function upsertFlowchart(input: { id: string; title: string; previewUrl: string; scene?: unknown }): FlowchartRecord {
  ensureFlowchartLoaded()

  // Always overwrite by id to keep "insert" and "edit" on same code path.
  const record: FlowchartRecord = {
    id: input.id,
    title: input.title.trim() || '流程图',
    previewUrl: input.previewUrl.trim(),
    scene: input.scene,
    updatedAt: Date.now(),
  }

  flowchartCache![record.id] = record
  persistFlowcharts()

  return record
}

export function removeFlowchart(id: string): void {
  ensureFlowchartLoaded()
  if (!flowchartCache![id]) return

  delete flowchartCache![id]
  persistFlowcharts()
}

export function emitFlowchartEditRequest(detail: FlowchartEditRequestDetail): void {
  // Decouples node click handling from Vue dialog component tree.
  window.dispatchEvent(new CustomEvent<FlowchartEditRequestDetail>(FLOWCHART_EDIT_REQUEST_EVENT, { detail }))
}
