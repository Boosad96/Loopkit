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
  return <html lang="en" suppressHydrationWarning><body>{embed?children:<><a className="skip" href="#content">Skip to content</a><BrandHeader/><main id="content">{children}</main><BrandFooter/></>}</body></html>
}
