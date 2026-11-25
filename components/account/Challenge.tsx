'use client'
import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

interface Widget { render(node: HTMLDivElement, options: Record<string, unknown>): string; remove(id: string): void }
export default function Challenge({ action }: { action: string }) {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const node = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const widget = (window as Window & { turnstile?: Widget }).turnstile
    if (!loaded || !node.current || !key || !widget) return
    const id = widget.render(node.current, { sitekey: key, action, theme: 'auto', size: 'flexible' })
    return () => widget.remove(id)
  }, [loaded, key, action])
  if (!key) return <p role="status">This action is unavailable until the site owner configures abuse protection.</p>
  return <><Script id="cf-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setLoaded(true)} /><div ref={node} /></>
}
