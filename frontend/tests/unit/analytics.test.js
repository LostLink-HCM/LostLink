import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGIN = 'https://lostlink.example'

function stubBrowser({ referrer = '' } = {}) {
  const head = { appendChild: vi.fn() }
  vi.stubGlobal('window', { location: { origin: ORIGIN } })
  vi.stubGlobal('document', { referrer, head, createElement: () => ({}) })
  return head
}

async function loadAnalytics(measurementId = 'G-TEST123') {
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', measurementId)
  vi.resetModules()
  return import('../../src/lib/analytics.js')
}

const pageViews = () =>
  window.dataLayer
    .filter((entry) => entry[0] === 'event' && entry[1] === 'page_view')
    .map((entry) => entry[2])

describe('Theo dõi lượt xem trang bằng GA4', () => {
  beforeEach(() => {
    stubBrowser()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('không có measurement ID: không nạp script, không ghi dataLayer', async () => {
    const head = stubBrowser()
    const { initializeAnalytics, trackPageView } = await loadAnalytics('')

    initializeAnalytics()

    expect(trackPageView('/messages')).toBe('')
    expect(window.dataLayer).toBeUndefined()
    expect(head.appendChild).not.toHaveBeenCalled()
  })

  it('gtag đẩy đối tượng arguments vào dataLayer, không phải mảng thường', async () => {
    const { initializeAnalytics } = await loadAnalytics()

    initializeAnalytics()

    expect(window.dataLayer.length).toBeGreaterThan(0)
    for (const entry of window.dataLayer) {
      expect(Array.isArray(entry)).toBe(false)
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
    }
  })

  it('chỉ nạp script gtag.js một lần dù gọi khởi tạo nhiều lần', async () => {
    const head = stubBrowser()
    const { initializeAnalytics } = await loadAnalytics()

    initializeAnalytics()
    initializeAnalytics()

    expect(head.appendChild).toHaveBeenCalledTimes(1)
    expect(head.appendChild.mock.calls[0][0].src).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-TEST123'
    )
  })

  it('che tham số động trong đường dẫn trước khi gửi', async () => {
    const { initializeAnalytics, trackPageView } = await loadAnalytics()
    initializeAnalytics()

    expect(trackPageView('/users/nguyenvana')).toBe('/users/:username')
    expect(trackPageView('/messages/abc123/review')).toBe('/messages/:threadId/review')
    expect(trackPageView('/mat-do/vi-da-mau-den-123')).toBe('/mat-do/:slug')
    expect(trackPageView('/settings/profile/')).toBe('/settings/profile')
    expect(trackPageView('/khong-ton-tai/xyz')).toBe('/other')

    const locations = pageViews().map((event) => event.page_location)
    expect(locations).toEqual([
      `${ORIGIN}/users/:username`,
      `${ORIGIN}/messages/:threadId/review`,
      `${ORIGIN}/mat-do/:slug`,
      `${ORIGIN}/settings/profile`,
      `${ORIGIN}/other`,
    ])
    expect(locations.join(' ')).not.toMatch(/nguyenvana|abc123|vi-da-mau-den/)
  })

  it('không gửi trùng page_view khi đường dẫn chuẩn hoá giống nhau', async () => {
    const { initializeAnalytics, trackPageView } = await loadAnalytics()
    initializeAnalytics()

    trackPageView('/users/a')
    trackPageView('/users/b')
    trackPageView('/messages')

    expect(pageViews()).toHaveLength(2)
  })

  it('referrer: trang đầu chỉ lấy origin bên ngoài, các trang sau lấy trang trước', async () => {
    stubBrowser({ referrer: 'https://www.google.com/search?q=lostlink' })
    const { initializeAnalytics, trackPageView } = await loadAnalytics()
    initializeAnalytics()

    trackPageView('/')
    trackPageView('/messages')

    const [first, second] = pageViews()
    expect(first).toMatchObject({
      page_title: 'LostLink · /',
      page_referrer: 'https://www.google.com',
    })
    expect(second).toMatchObject({
      page_title: 'LostLink · /messages',
      page_referrer: `${ORIGIN}/`,
    })
  })
})
