import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface CommentHighlightRange {
  from: number
  to: number
}

interface CommentAnchorHighlightOptions {
  getRange: () => CommentHighlightRange | null
}

export const commentAnchorHighlightPluginKey = new PluginKey('commentAnchorHighlight')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentAnchorHighlight: {
      refreshCommentAnchorHighlight: () => ReturnType
    }
  }
}

export const CommentAnchorHighlight = Extension.create<CommentAnchorHighlightOptions>({
  name: 'commentAnchorHighlight',

  addOptions() {
    return {
      getRange: () => null,
    }
  },

  addCommands() {
    return {
      refreshCommentAnchorHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(commentAnchorHighlightPluginKey, Date.now()))
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: commentAnchorHighlightPluginKey,
        props: {
          decorations: (state) => {
            const range = this.options.getRange()
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
      }),
    ]
  },
})

export default CommentAnchorHighlight
