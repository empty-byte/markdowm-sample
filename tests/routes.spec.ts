import { describe, expect, it } from 'vitest'
import { demoRoutes } from '../src/router/routes'

describe('editor demo routes', () => {
  it('contains the home page and three方案 pages', () => {
    expect(demoRoutes.map((route) => route.path)).toEqual([
      '/',
      '/tiptap',
      '/milkdown',
      '/blocksuite',
    ])
  })

  it('exposes user-facing titles for navigation', () => {
    expect(demoRoutes.every((route) => typeof route.meta?.title === 'string')).toBe(true)
  })
})
