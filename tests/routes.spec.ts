import { describe, expect, it } from 'vitest'
import { demoRoutes } from '../src/router/routes'

describe('editor demo routes', () => {
  it('only keeps the milkdown page route', () => {
    expect(demoRoutes.map((route) => route.path)).toEqual(['/'])
  })

  it('exposes user-facing titles for navigation', () => {
    expect(demoRoutes.every((route) => typeof route.meta?.title === 'string')).toBe(true)
  })
})
