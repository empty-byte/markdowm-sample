import { describe, expect, it } from 'vitest'
import { detectSlashTrigger } from '../src/features/editor-enhance/slash'

describe('slash trigger detection', () => {
  it('detects / command query at line end', () => {
    const result = detectSlashTrigger('abc /he', 7)
    expect(result).toEqual({ from: 4, to: 7, query: 'he' })
  })

  it('supports empty query right after /', () => {
    const result = detectSlashTrigger('/', 1)
    expect(result).toEqual({ from: 0, to: 1, query: '' })
  })

  it('returns null when cursor is no longer in slash token', () => {
    expect(detectSlashTrigger('abc /he world', 13)).toBeNull()
  })
})
