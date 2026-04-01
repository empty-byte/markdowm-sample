export interface EditorComment {
  id: string
  text: string
  quote: string
  from: number
  to: number
  author: string
  createdAt: number
}

export interface NewCommentInput {
  text: string
  quote: string
  from: number
  to: number
  author: string
}

/**
 * Handle commentId logic.
 */
function commentId() {
  // Comment IDs only need local uniqueness for in-memory list operations.
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function addComment(list: EditorComment[], input: NewCommentInput): EditorComment[] {
  // Prepend newest comment so sidebar naturally shows latest feedback first.
  const next: EditorComment = {
    id: commentId(),
    text: input.text.trim(),
    quote: input.quote.trim(),
    from: input.from,
    to: input.to,
    author: input.author,
    createdAt: Date.now(),
  }

  return [next, ...list]
}

export function removeComment(list: EditorComment[], id: string): EditorComment[] {
  // Keep operation immutable for Vue reactivity and Yjs sync consistency.
  return list.filter((item) => item.id !== id)
}
