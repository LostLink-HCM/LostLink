import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initializeAnalytics, trackPageView } from '../lib/analytics.js'

function AnalyticsTracker() {
  const { pathname } = useLocation()

  useEffect(() => {
    initializeAnalytics()
    trackPageView(pathname)
  }, [pathname])

  return null
}

export default AnalyticsTracker
