import { describe, expect, it } from 'vitest'
import { addComment, removeComment } from '../src/features/editor-enhance/comments'
import { createSnapshot, findSnapshot, removeSnapshot } from '../src/features/editor-enhance/history'

describe('editor enhance helpers', () => {
  it('adds comment to the top and can remove by id', () => {
    const list = addComment([], {
      text: '需要补充结论',
      quote: '这是一段选中文本',
      from: 2,
      to: 8,
      author: 'Alice',
    })

    expect(list).toHaveLength(1)
    expect(list[0].author).toBe('Alice')

    const removed = removeComment(list, list[0].id)
    expect(removed).toHaveLength(0)
  })

  it('creates snapshots in reverse chronological order and can query by id', () => {
    const first = createSnapshot([], { label: 'v1', content: '{"type":"doc"}' }, 5)
    const second = createSnapshot(first, { label: 'v2', content: '{"type":"doc","v":2}' }, 5)

    expect(second[0].label).toBe('v2')
    expect(second[1].label).toBe('v1')
    expect(findSnapshot(second, second[1].id)?.label).toBe('v1')

    const removed = removeSnapshot(second, second[0].id)
    expect(removed).toHaveLength(1)
    expect(removed[0].label).toBe('v1')
  })
})
