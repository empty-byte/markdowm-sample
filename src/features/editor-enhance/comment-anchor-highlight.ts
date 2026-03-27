import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'

export interface CommentHighlightRange {
  from: number
  to: number
}

export interface CommentAnchorHighlightOptions {
  getRanges: () => CommentHighlightRange[]
  getActiveRange: () => CommentHighlightRange | null
}

export const commentAnchorHighlightPluginKey = new PluginKey('commentAnchorHighlight')

export function createCommentAnchorHighlightPlugin(options: CommentAnchorHighlightOptions) {
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
    },
  })
}

export default createCommentAnchorHighlightPlugin
