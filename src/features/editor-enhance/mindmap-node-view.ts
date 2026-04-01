import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import type { EditorView } from '@milkdown/prose/view'
import type { Node as ProsemirrorNode } from '@milkdown/prose/model'
import {
  emitMindmapEditRequest,
  extractMindmapId,
  getMindmapById,
  type MindmapSourceKind,
} from './mindmaps'

export const mindmapNodeViewPluginKey = new PluginKey('mindmapNodeView')

interface MindmapWidget {
  from: number
  to: number
  kind: MindmapSourceKind
  id: string
  source: string
  title: string
  previewUrl: string
  updatedAt: number
}

const mindmapTokenPattern = /!\[mindmap:([^\]]*)\]\((mindmap:\/\/[a-zA-Z0-9_-]+)(?:\s+"[^"]*")?\)/g

/**
 * Handle collectMindmapWidgets logic.
 * @param doc - Parameter.
 * @returns Return value.
 */
function collectMindmapWidgets(doc: ProsemirrorNode): MindmapWidget[] {
  // Scan both rendered image nodes and raw token text so migration states both work.
  const results: MindmapWidget[] = []

  doc.descendants((node, pos, parent) => {
    if (node.type.name === 'image' && typeof node.attrs.alt === 'string' && node.attrs.alt.startsWith('mindmap:')) {
      const source = String(node.attrs.src ?? '')
      const id = extractMindmapId(source)
      if (!id) return

      const title = String(node.attrs.alt).slice('mindmap:'.length).trim() || '思维导图'
      const stored = getMindmapById(id)
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

    mindmapTokenPattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = mindmapTokenPattern.exec(node.text)) !== null) {
      const token = match[0]
      const source = match[2] ?? ''
      const id = extractMindmapId(source)
      if (!id) continue

      const stored = getMindmapById(id)
      const title = (match[1] ?? '').trim() || stored?.title || '思维导图'
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

/**
 * Handle stopMouseDown logic.
 * @param event - Parameter.
 */
function stopMouseDown(event: MouseEvent): void {
  // Keep editor selection stable when interacting with widget controls.
  event.preventDefault()
  event.stopPropagation()
}

/**
 * Handle stopAction logic.
 * @param event - Parameter.
 */
function stopAction(event: MouseEvent): void {
  // Action buttons should not bubble into ProseMirror click handlers.
  event.preventDefault()
  event.stopPropagation()
}

/**
 * Handle createMindmapWidget logic.
 * @param widget - Parameter.
 * @param view - Parameter.
 * @returns Return value.
 */
function createMindmapWidget(widget: MindmapWidget, view: EditorView): HTMLElement {
  // Build non-editable card UI shown inline in the document.
  const wrapper = document.createElement('div')
  wrapper.className = 'embed-inline-card mindmap-inline-card'
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
    emitMindmapEditRequest({
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
  previewWrap.className = 'mindmap-preview-wrap'

  if (widget.previewUrl) {
    const image = document.createElement('img')
    image.src = widget.previewUrl
    image.alt = widget.title
    image.loading = 'lazy'
    previewWrap.appendChild(image)
  } else {
    const empty = document.createElement('div')
    empty.className = 'mindmap-preview-empty'
    empty.textContent = '思维导图预览未设置，请点击“编辑”生成预览图'
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

export default function createMindmapNodeViewPlugin() {
  // Render mindmap widgets via decorations while hiding original token/image content.
  return new Plugin({
    key: mindmapNodeViewPluginKey,
    props: {
      decorations: (state) => {
        const widgets = collectMindmapWidgets(state.doc)
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
                class: 'mindmap-token-hidden',
              })
            )
          }

          decorations.push(
            Decoration.widget(widget.to, (view: EditorView) => createMindmapWidget(widget, view), {
              side: -1,
              key: `mindmap-${widget.kind}-${widget.from}-${widget.to}-${widget.updatedAt}`,
            })
          )
        }

        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
}
