'use client'
import { useEffect, useSyncExternalStore } from 'react'

// Optional usage-analytics preference, as described in the privacy policy:
// analytics stay off until the visitor opts in on this device. Opting in
// stores a first-party random identifier with a 90-day lifetime in local
// storage; opting out removes it. No analytics events are sent by this
// component itself — it only manages the preference and identifier.
const KEY = 'loopkit-analytics'
const LIFETIME_MS = 90 * 86400000

type Preference = { id: string; expires: number }

function getSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener('loopkit-analytics-change', notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener('loopkit-analytics-change', notify)
  }
}
function announce() {
  window.dispatchEvent(new Event('loopkit-analytics-change'))
}
function parsePreference(raw: string): Preference | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { id, expires } = value as { id?: unknown; expires?: unknown }
    if (typeof id !== 'string' || !id || typeof expires !== 'number') return null
    return { id, expires }
  } catch {
    return null
  }
}

export function AnalyticsPreferences() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => '')
  const preference = parsePreference(raw)
  // Drop a stale identifier after mount so an expired opt-in does not linger.
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = parsePreference(localStorage.getItem(KEY) ?? '')
        if (stored && stored.expires <= Date.now()) {
          localStorage.removeItem(KEY)
          announce()
        }
      } catch {
        /* Restricted storage keeps analytics off. */
      }
    })
  }, [])
  function optIn() {
    try {
      const value: Preference = { id: crypto.randomUUID(), expires: Date.now() + LIFETIME_MS }
      localStorage.setItem(KEY, JSON.stringify(value))
      announce()
    } catch {
      /* Restricted storage keeps analytics off. */
    }
  }
  function optOut() {
    try {
      localStorage.removeItem(KEY)
      announce()
    } catch {
      /* Restricted storage keeps analytics off. */
    }
  }
  if (!preference) {
    return <div><p>Usage analytics are off on this device. Opting in stores a random identifier for 90 days so visits and tool use can be measured without raw URLs, IP addresses or browser details.</p><button type="button" onClick={optIn}>Opt in to usage analytics</button></div>
  }
  return <div><p>Usage analytics are on for this device. Your random identifier expires on {new Date(preference.expires).toUTCString()}.</p><button type="button" onClick={optOut}>Opt out of usage analytics</button></div>
}
