export interface EmbedBlock {
  id: string
  sourceUrl: string
  provider: EmbedProvider
  embedUrl: string
  status: 'ready' | 'blocked' | 'invalid'
  title: string
  width: number
  height: number
  createdAt: number
  updatedAt: number
}

export type EmbedProvider = 'youtube' | 'bilibili' | 'figma' | 'generic'

export interface ParsedEmbedBlock {
  title: string
  sourceUrl: string
  provider: EmbedProvider
  embedUrl: string
  status: 'ready' | 'invalid'
}

/**
 * Validate that a URL is a valid HTTPS URL.
 */
export function isValidEmbedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Detect the embed provider from a URL.
 */
export function detectProvider(url: string): EmbedProvider {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') return 'youtube'
    if (host === 'bilibili.com' || host === 'b23.tv' || host.endsWith('.bilibili.com')) return 'bilibili'
    if (host === 'figma.com' || host.endsWith('.figma.com')) return 'figma'

    return 'generic'
  } catch {
    return 'generic'
  }
}

/**
 * Convert a source URL to an embeddable iframe URL for known providers.
 */
export function toEmbedUrl(sourceUrl: string, provider: EmbedProvider): string {
  if (provider === 'youtube') {
    return toYouTubeEmbedUrl(sourceUrl) ?? sourceUrl
  }
  if (provider === 'bilibili') {
    return toBilibiliEmbedUrl(sourceUrl) ?? sourceUrl
  }
  if (provider === 'figma') {
    return toFigmaEmbedUrl(sourceUrl)
  }
  return sourceUrl
}

function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    let videoId: string | null = null

    if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1)
    } else {
      videoId = parsed.searchParams.get('v')
    }

    if (!videoId) return null
    return `https://www.youtube.com/embed/${videoId}`
  } catch {
    return null
  }
}

function toBilibiliEmbedUrl(url: string): string | null {
  const match = /bilibili\.com\/video\/(BV[\w]+)/i.exec(url)
  if (!match) return null
  return `https://player.bilibili.com/player.html?bvid=${match[1]}&autoplay=0`
}

function toFigmaEmbedUrl(url: string): string {
  return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`
}

/**
 * Parse embed block tokens from Markdown text.
 * Format: ![embed:Title](https://url) or ![embed:Title](https://url "optional title")
 */
export function parseEmbedBlocks(markdownText: string): ParsedEmbedBlock[] {
  const regex = /!\[embed:([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  const results: ParsedEmbedBlock[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(markdownText)) !== null) {
    const title = match[1] || '内嵌网页'
    const sourceUrl = match[2]

    if (!isValidEmbedUrl(sourceUrl)) {
      results.push({ title, sourceUrl, provider: 'generic', embedUrl: '', status: 'invalid' })
      continue
    }

    const provider = detectProvider(sourceUrl)
    const embedUrl = toEmbedUrl(sourceUrl, provider)
    results.push({ title, sourceUrl, provider, embedUrl, status: 'ready' })
  }

  return results
}

/**
 * Generate an embed Markdown token.
 */
export function createEmbedToken(title: string, url: string): string {
  return `![embed:${title}](${url})`
}

/**
 * Get a display label for a provider.
 */
export function getProviderLabel(provider: EmbedProvider): string {
  switch (provider) {
    case 'youtube':
      return 'YouTube'
    case 'bilibili':
      return 'Bilibili'
    case 'figma':
      return 'Figma'
    default:
      return '网页'
  }
}

export type EmbedSourceKind = 'image' | 'token'

export interface EmbedEditRequestDetail {
  kind: EmbedSourceKind
  from: number
  to: number
  sourceUrl: string
  title: string
}

export const EMBED_EDIT_REQUEST_EVENT = 'milkdown:embed-edit-request'

export function emitEmbedEditRequest(detail: EmbedEditRequestDetail): void {
  window.dispatchEvent(new CustomEvent<EmbedEditRequestDetail>(EMBED_EDIT_REQUEST_EVENT, { detail }))
}
