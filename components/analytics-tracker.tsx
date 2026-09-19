'use client'

import { useEffect } from 'react'

export function AnalyticsTracker() {
  useEffect(() => {
    fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'page_view', path: location.pathname, referrer: document.referrer }) }).catch(() => {})
    let activeSince: number | null = document.visibilityState === 'visible' ? Date.now() : null
    const sendTime = () => {
      if (activeSince === null) return
      const seconds = Math.min(3600, Math.max(1, Math.round((Date.now() - activeSince) / 1000)))
      activeSince = null
      navigator.sendBeacon('/api/analytics/event', new Blob([JSON.stringify({ event: 'time_spent', path: location.pathname, durationSeconds: seconds })], { type: 'application/json' }))
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sendTime()
      else if (activeSince === null) activeSince = Date.now()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', sendTime)
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', sendTime); sendTime() }
  }, [])
  return null
}
