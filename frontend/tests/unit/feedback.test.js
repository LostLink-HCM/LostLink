import { describe, expect, it } from 'vitest'
import { hiddenNow, hidesFeedback, isHidden } from '../../src/lib/user/feedback'

describe('hidesFeedback', () => {
  it.each([
    '/messages',
    '/messages/abc/review',
    '/posts/new',
    '/posts/42/edit',
    '/posts/42/verify',
    '/posts/42/report',
    '/settings/account',
    '/users/an/report',
  ])('hides on %s', (path) => expect(hidesFeedback(path)).toBe(true))

  it.each(['/', '/trending', '/mat-do/vi-da', '/notifications', '/users/an'])(
    'shows on %s',
    (path) => expect(hidesFeedback(path)).toBe(false)
  )
})

describe('isHidden', () => {
  const DAY = 86_400_000
  const NOW = Date.UTC(2026, 10, 20)

  it('hides for one day after closing', () => {
    expect(isHidden(NOW - DAY + 1, NOW)).toBe(true)
    expect(isHidden(NOW - DAY, NOW)).toBe(false)
  })

  it('shows when never closed', () => {
    expect(isHidden(Number(null), NOW)).toBe(false)
    expect(isHidden(Number('abc'), NOW)).toBe(false)
  })

  it('treats unavailable storage as not hidden', () => {
    expect(hiddenNow(NOW)).toBe(false)
  })
})
