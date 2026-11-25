import { bodyFont, headingFont } from '@/lib/brandFonts'
import { AnalyticsObserver } from '@/components/account/Analytics'
import {headers} from 'next/headers'
import type { Metadata } from 'next'
import { BrandHeader, BrandFooter } from '@/components/BrandShell'
import { brand } from '@/lib/brand'
import './globals.css'
import './tools.css'
export const metadata: Metadata = {
  metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title:{default:brand.name+' — Create. Share. Grow.',template:'%s · '+brand.name},
  description:'Free tools for gamers, creators and connected communities.',
  icons:{icon:'/brand/app-icon.svg'},
  verification:{google:process.env.GOOGLE_SITE_VERIFICATION},
}
export default async function RootLayout({children}:{children:React.ReactNode}) {
  const requestHeaders=await headers()
  const embed=requestHeaders.get("x-loopkit-embed")==="true"
  const base=new URL(String(metadata.metadataBase)).href
  const identity=[{'@context':'https://schema.org','@type':'WebSite',name:brand.name,url:base},{'@context':'https://schema.org','@type':'Organization',name:brand.name,url:base,logo:new URL(brand.logo,base).href}]
  return <html className={bodyFont.variable+" "+headingFont.variable} lang="en" suppressHydrationWarning><body><script nonce={requestHeaders.get('x-nonce')||undefined} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(identity).replace(/</g,'\\u003c')}}/>{embed?children:<><a className="skip" href="#content">Skip to content</a><BrandHeader/><main id="content">{children}</main><BrandFooter/><AnalyticsObserver/></>}</body></html>
}
