import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'

export interface CommentHighlightRange {
  from: number
  to: number
}

export interface CommentAnchorHighlightOptions {
  getRange: () => CommentHighlightRange | null
}

export const commentAnchorHighlightPluginKey = new PluginKey('commentAnchorHighlight')

export function createCommentAnchorHighlightPlugin(options: CommentAnchorHighlightOptions) {
  return new Plugin({
    key: commentAnchorHighlightPluginKey,
    props: {
      decorations: (state) => {
        const range = options.getRange()
        if (!range) return null

        const docSize = state.doc.content.size
        const from = Math.max(0, Math.min(range.from, docSize))
        const to = Math.max(from, Math.min(range.to, docSize))

        if (from === to) return null

        return DecorationSet.create(state.doc, [
          Decoration.inline(from, to, { class: 'comment-anchor-highlight' }),
        ])
      },
    },
  })
}

export default createCommentAnchorHighlightPlugin
