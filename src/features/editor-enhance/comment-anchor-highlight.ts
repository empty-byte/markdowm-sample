import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'

export interface CommentHighlightRange {
  from: number
  to: number
}

export interface CommentAnchorHighlightOptions {
  getRanges: () => CommentHighlightRange[]
  getActiveRange: () => CommentHighlightRange | null
  getRangeKeyAt: (pos: number) => string | null
  onClickRange: (key: string) => void
}

export const commentAnchorHighlightPluginKey = new PluginKey('commentAnchorHighlight')

export function createCommentAnchorHighlightPlugin(options: CommentAnchorHighlightOptions) {
  // Render two decoration layers: all comment anchors + currently active anchor.
  return new Plugin({
    key: commentAnchorHighlightPluginKey,
    props: {
      decorations: (state) => {
        const docSize = state.doc.content.size
        const decorations = options.getRanges().flatMap((range) => {
          const from = Math.max(0, Math.min(range.from, docSize))
          const to = Math.max(from, Math.min(range.to, docSize))

          if (from === to) return []

          return [Decoration.inline(from, to, { class: 'comment-anchor-mark' })]
        })

        const activeRange = options.getActiveRange()
        if (activeRange) {
          const from = Math.max(0, Math.min(activeRange.from, docSize))
          const to = Math.max(from, Math.min(activeRange.to, docSize))

          if (from !== to) {
            decorations.push(
              Decoration.inline(from, to, { class: 'comment-anchor-highlight' })
            )
          }
        }

        if (!decorations.length) return null

        return DecorationSet.create(state.doc, decorations)
      },
      handleClick: (_view, pos) => {
        // Translate click position back to comment ID, then delegate to sidebar behavior.
        const key = options.getRangeKeyAt(pos)
        if (!key) return false

        options.onClickRange(key)
        return false
      },
    },
  })
}

export default createCommentAnchorHighlightPlugin
