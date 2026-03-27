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

function commentId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function addComment(list: EditorComment[], input: NewCommentInput): EditorComment[] {
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
  return list.filter((item) => item.id !== id)
}
