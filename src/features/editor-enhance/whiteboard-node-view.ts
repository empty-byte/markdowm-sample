import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import type { EditorView } from '@milkdown/prose/view'
import type { Node as ProsemirrorNode } from '@milkdown/prose/model'
import {
  emitWhiteboardEditRequest,
  extractWhiteboardId,
  getWhiteboardById,
  type WhiteboardSourceKind,
} from './whiteboards'

export const whiteboardNodeViewPluginKey = new PluginKey('whiteboardNodeView')

interface WhiteboardWidget {
  from: number
  to: number
  kind: WhiteboardSourceKind
  id: string
  source: string
  title: string
  previewUrl: string
  updatedAt: number
}

const whiteboardTokenPattern = /!\[whiteboard:([^\]]*)\]\((whiteboard:\/\/[a-zA-Z0-9_-]+)(?:\s+"[^"]*")?\)/g

function collectWhiteboardWidgets(doc: ProsemirrorNode): WhiteboardWidget[] {
  const results: WhiteboardWidget[] = []

  doc.descendants((node, pos, parent) => {
    if (node.type.name === 'image' && typeof node.attrs.alt === 'string' && node.attrs.alt.startsWith('whiteboard:')) {
      const source = String(node.attrs.src ?? '')
      const id = extractWhiteboardId(source)
      if (!id) return

      const title = String(node.attrs.alt).slice('whiteboard:'.length).trim() || '白板'
      const stored = getWhiteboardById(id)
      results.push({
        from: pos,
        to: pos + node.nodeSize,
        kind: 'image',
        id,
        source,
        title,
        previewUrl: stored?.previewUrl ?? '',
        updatedAt: stored?.updatedAt ?? 0,
      })
      return
    }

    if (!node.isText || !node.text) return
    if (parent?.type?.spec?.code) return

    whiteboardTokenPattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = whiteboardTokenPattern.exec(node.text)) !== null) {
      const token = match[0]
      const source = match[2] ?? ''
      const id = extractWhiteboardId(source)
      if (!id) continue

      const stored = getWhiteboardById(id)
      const title = (match[1] ?? '').trim() || stored?.title || '白板'
      const from = pos + match.index
      const to = from + token.length

      results.push({
        from,
        to,
        kind: 'token',
        id,
        source,
        title,
        previewUrl: stored?.previewUrl ?? '',
        updatedAt: stored?.updatedAt ?? 0,
      })
    }
  })

  return results
}

function stopMouseDown(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

function stopAction(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

function createWhiteboardWidget(widget: WhiteboardWidget, view: EditorView): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'embed-inline-card whiteboard-inline-card'
  wrapper.contentEditable = 'false'

  const actions = document.createElement('div')
  actions.className = 'embed-card-actions'

  const editBtn = document.createElement('button')
  editBtn.type = 'button'
  editBtn.className = 'embed-action-btn'
  editBtn.textContent = '编辑'
  editBtn.addEventListener('mousedown', stopMouseDown)
  editBtn.addEventListener('click', (event) => {
    stopAction(event)
    emitWhiteboardEditRequest({
      kind: widget.kind,
      from: widget.from,
      to: widget.to,
      id: widget.id,
      title: widget.title,
      previewUrl: widget.previewUrl,
    })
    view.focus()
  })

  const deleteBtn = document.createElement('button')
  deleteBtn.type = 'button'
  deleteBtn.className = 'embed-action-btn danger'
  deleteBtn.textContent = '删除'
  deleteBtn.addEventListener('mousedown', stopMouseDown)
  deleteBtn.addEventListener('click', (event) => {
    stopAction(event)
    try {
      const tr = view.state.tr.delete(widget.from, widget.to)
      view.dispatch(tr)
      view.focus()
    } catch {
      view.focus()
    }
  })

  actions.appendChild(editBtn)
  actions.appendChild(deleteBtn)

  const previewWrap = document.createElement('div')
  previewWrap.className = 'whiteboard-preview-wrap'

  if (widget.previewUrl) {
    const image = document.createElement('img')
    image.src = widget.previewUrl
    image.alt = widget.title
    image.loading = 'lazy'
    previewWrap.appendChild(image)
  } else {
    const empty = document.createElement('div')
    empty.className = 'whiteboard-preview-empty'
    empty.textContent = '白板预览未设置，请点击“编辑”补充预览图地址'
    previewWrap.appendChild(empty)
  }

  const meta = document.createElement('div')
  meta.className = 'embed-card-meta'

  const titleEl = document.createElement('div')
  titleEl.className = 'embed-card-title'
  titleEl.textContent = widget.title

  const idEl = document.createElement('div')
  idEl.className = 'embed-card-subtitle'
  idEl.textContent = widget.id
  idEl.title = widget.id

  meta.appendChild(titleEl)
  meta.appendChild(idEl)

  wrapper.appendChild(meta)
  wrapper.appendChild(actions)
  wrapper.appendChild(previewWrap)

  return wrapper
}

export function createWhiteboardNodeViewPlugin() {
  return new Plugin({
    key: whiteboardNodeViewPluginKey,
    props: {
      decorations: (state) => {
        const widgets = collectWhiteboardWidgets(state.doc)
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
                class: 'whiteboard-token-hidden',
              })
            )
          }

          decorations.push(
            Decoration.widget(widget.to, (view: EditorView) => createWhiteboardWidget(widget, view), {
              side: -1,
              key: `whiteboard-${widget.kind}-${widget.from}-${widget.to}-${widget.updatedAt}`,
            })
          )
        }

        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
}

export default createWhiteboardNodeViewPlugin
