'use client'
import { useEffect, useRef, useState } from 'react'
import styles from './editorial.module.css'

interface ConsentBridge {
  mayLoadGoogleAds: () => boolean
  subscribe: (listener: () => void) => () => void
}
declare global {
  interface Window {
    loopkitAdConsent?: ConsentBridge
    adsbygoogle?: Record<string, unknown>[]
  }
}

// A certified CMP integration supplies this bridge and resolves all applicable purposes
// and vendors. Missing, stale or unresolved consent leaves the slot empty.
export function ConsentAd({publisher,slot}:{publisher:string,slot:string}) {
  const [allowed,setAllowed] = useState(false)
  const ad = useRef<HTMLModElement>(null)
  useEffect(()=>{
    let unsubscribe: (()=>void) | undefined
    function connect() {
      unsubscribe?.()
      const bridge = window.loopkitAdConsent
      const refresh = () => {
        try {setAllowed(bridge?.mayLoadGoogleAds() === true)} catch {setAllowed(false)}
      }
      refresh()
      unsubscribe = bridge?.subscribe(refresh)
    }
    connect()
    window.addEventListener('loopkit:cmp-ready',connect)
    return ()=>{window.removeEventListener('loopkit:cmp-ready',connect); unsubscribe?.()}
  },[])
  useEffect(()=>{
    if (!allowed) return
    let active = true
    const scriptId = 'loopkit-manual-adsense'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    const render = () => {
      if (!active || !ad.current || ad.current.dataset.requested || window.loopkitAdConsent?.mayLoadGoogleAds() !== true) return
      ad.current.dataset.requested = 'true'
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    }
    const ready = () => { if (script) script.dataset.ready = 'true'; render() }
    if (script) {
      if (script.dataset.ready === 'true') render()
      else script.addEventListener('load',ready)
    } else {
      script = document.createElement('script')
      script.id = scriptId
      script.async = true
      script.crossOrigin = 'anonymous'
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-' + publisher
      script.addEventListener('load',ready)
      script.addEventListener('error',()=>script?.remove(),{once:true})
      document.head.appendChild(script)
    }
    return ()=>{ active=false; script?.removeEventListener('load',ready) }
  },[allowed,publisher])
  if (!allowed) return null
  return <aside className={styles.ad} aria-label="Advertisement"><span>Advertisement</span>
    <ins ref={ad} className="adsbygoogle" style={{display:'block',minHeight:250}} data-ad-client={'ca-'+publisher} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true"/>
  </aside>
}
