import { describe, expect, it } from 'vitest'
import {
  createMindmapId,
  createMindmapSource,
  createMindmapToken,
  extractMindmapId,
  getMindmapById,
  removeMindmap,
  upsertMindmap,
} from '../src/features/editor-enhance/mindmaps'

describe('mindmap helpers', () => {
  it('creates/parses mindmap source and token', () => {
    const id = createMindmapId(1710000000000)
    const source = createMindmapSource(id)
    const token = createMindmapToken('项目脑图', id)

    expect(id.startsWith('mm_')).toBe(true)
    expect(extractMindmapId(source)).toBe(id)
    expect(token).toContain(`mindmap://${id}`)
    expect(token.startsWith('![mindmap:项目脑图]')).toBe(true)
  })

  it('upserts and removes mindmap records', () => {
    const id = createMindmapId(Date.now())

    const record = upsertMindmap({
      id,
      title: '测试脑图',
      previewUrl: 'data:image/png;base64,abc',
      scene: {
        root: {
          data: { text: '中心主题' },
          children: [{ data: { text: '分支 1' } }],
        },
      },
    })

    expect(record.id).toBe(id)
    expect(getMindmapById(id)?.title).toBe('测试脑图')

    removeMindmap(id)
    expect(getMindmapById(id)).toBeNull()
  })
})
