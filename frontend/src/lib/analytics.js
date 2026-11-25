const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
const STATIC_PATHS = new Set([
  '/',
  '/trending',
  '/posts/new',
  '/leaderboard',
  '/matches',
  '/notifications',
  '/saved',
  '/settings',
  '/settings/profile',
  '/settings/account',
  '/settings/notifications',
  '/settings/areas',
  '/settings/blocked',
  '/messages',
  '/moderator/posts',
  '/moderator/review',
  '/moderator/reports',
  '/moderator/messages',
  '/moderator/notifications',
  '/admin/dashboard',
  '/admin/users',
  '/admin/categories',
  '/admin/posts',
  '/admin/audit-log',
  '/admin/settings',
  '/admin/messages',
  '/admin/notifications',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
])

let initialized = false
let previousPageLocation = ''

function normalizePath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (STATIC_PATHS.has(path)) return path

  const templates = [
    [/^\/posts\/[^/]+\/edit$/, '/posts/:id/edit'],
    [/^\/posts\/[^/]+\/verify$/, '/posts/:id/verify'],
    [/^\/posts\/[^/]+\/report$/, '/posts/:id/report'],
    [/^\/mat-do\/[^/]+$/, '/mat-do/:slug'],
    [/^\/nhat-duoc\/[^/]+$/, '/nhat-duoc/:slug'],
    [/^\/messages\/[^/]+\/review$/, '/messages/:threadId/review'],
    [/^\/users\/[^/]+\/report$/, '/users/:username/report'],
    [/^\/users\/[^/]+$/, '/users/:username'],
  ]

  return templates.find(([pattern]) => pattern.test(path))?.[1] || '/other'
}

function safePageTitle(path) {
  return `LostLink · ${path}`
}

function safeInitialReferrer() {
  if (!document.referrer) return ''
  try {
    return new URL(document.referrer).origin
  } catch {
    return ''
  }
}

export function initializeAnalytics() {
  if (!measurementId || initialized || typeof window === 'undefined') return

  window.dataLayer = window.dataLayer || []
  // gtag.js only reads Arguments objects, plain arrays are ignored
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', measurementId, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)
  initialized = true
}

export function trackPageView(pathname) {
  if (!measurementId || !initialized || typeof window.gtag !== 'function') return ''

  const safePath = normalizePath(pathname)
  const pageLocation = `${window.location.origin}${safePath}`
  if (pageLocation === previousPageLocation) return safePath

  const pageTitle = safePageTitle(safePath)
  const pageReferrer = previousPageLocation || safeInitialReferrer()

  window.gtag('config', measurementId, {
    send_page_view: false,
    page_title: pageTitle,
    page_location: pageLocation,
  })

  window.gtag('event', 'page_view', {
    page_title: pageTitle,
    page_location: pageLocation,
    page_referrer: pageReferrer,
  })

  previousPageLocation = pageLocation
  return safePath
}
