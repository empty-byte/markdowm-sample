import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import type { EditorView } from '@milkdown/prose/view'
import type { Node as ProsemirrorNode } from '@milkdown/prose/model'
import { isValidEmbedUrl, detectProvider, toEmbedUrl } from './embeds'

export const embedNodeViewPluginKey = new PluginKey('embedNodeView')

type EmbedSourceKind = 'image' | 'token'

interface EmbedWidget {
  from: number
  to: number
  kind: EmbedSourceKind
  sourceUrl: string
  embedUrl: string
}

const embedTokenPattern = /!\[embed:([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

function collectEmbedWidgets(doc: ProsemirrorNode): EmbedWidget[] {
  const results: EmbedWidget[] = []

  doc.descendants((node, pos, parent) => {
    if (node.type.name === 'image' && typeof node.attrs.alt === 'string' && node.attrs.alt.startsWith('embed:')) {
      const sourceUrl = String(node.attrs.src ?? '')
      if (!isValidEmbedUrl(sourceUrl)) return

      const provider = detectProvider(sourceUrl)
      const embedUrl = toEmbedUrl(sourceUrl, provider)

      results.push({
        from: pos,
        to: pos + node.nodeSize,
        kind: 'image',
        sourceUrl,
        embedUrl,
      })
      return
    }

    if (!node.isText || !node.text) return
    if (parent?.type?.spec?.code) return

    embedTokenPattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = embedTokenPattern.exec(node.text)) !== null) {
      const token = match[0]
      const sourceUrl = match[2] ?? ''
      if (!isValidEmbedUrl(sourceUrl)) continue

      const provider = detectProvider(sourceUrl)
      const embedUrl = toEmbedUrl(sourceUrl, provider)
      const from = pos + match.index
      const to = from + token.length

      results.push({
        from,
        to,
        kind: 'token',
        sourceUrl,
        embedUrl,
      })
    }
  })

  return results
}

function createIframeWidget(widget: EmbedWidget): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'embed-inline-card'
  wrapper.contentEditable = 'false'

  const actions = document.createElement('div')
  actions.className = 'embed-card-actions'

  const openBtn = document.createElement('a')
  openBtn.className = 'embed-action-btn'
  openBtn.textContent = '打开'
  openBtn.href = widget.sourceUrl
  openBtn.target = '_blank'
  openBtn.rel = 'noopener noreferrer'
  openBtn.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })

  actions.appendChild(openBtn)

  const iframeWrap = document.createElement('div')
  iframeWrap.className = 'embed-iframe-wrap'
  iframeWrap.style.width = '100%'
  iframeWrap.style.height = '400px'

  const iframe = document.createElement('iframe')
  iframe.src = widget.embedUrl
  iframe.title = '内嵌网页'
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups')
  iframe.setAttribute('loading', 'lazy')
  iframe.setAttribute('referrerpolicy', 'no-referrer')
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.border = 'none'
  iframe.style.display = 'block'

  iframeWrap.appendChild(iframe)

  wrapper.appendChild(actions)
  wrapper.appendChild(iframeWrap)

  return wrapper
}

export function createEmbedNodeViewPlugin() {
  return new Plugin({
    key: embedNodeViewPluginKey,
    props: {
      decorations: (state) => {
        const widgets = collectEmbedWidgets(state.doc)
        if (!widgets.length) return null

        const decorations: Decoration[] = []

        for (const widget of widgets) {
          if (widget.kind === 'image') {
            decorations.push(
              Decoration.node(widget.from, widget.to, {
                style: 'display:none',
              })
            )
          } else {
            decorations.push(
              Decoration.inline(widget.from, widget.to, {
                class: 'embed-token-hidden',
              })
            )
          }

          decorations.push(
            Decoration.widget(widget.to, (_view: EditorView) => createIframeWidget(widget), {
              side: -1,
              key: `embed-${widget.kind}-${widget.from}-${widget.to}`,
            })
          )
        }

        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
}

export default createEmbedNodeViewPlugin
