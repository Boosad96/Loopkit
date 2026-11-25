import { NextRequest, NextResponse } from 'next/server'
import { sameOrigin } from './lib/origin'
import { refreshSession } from './lib/account/refresh'

export async function middleware(request:NextRequest) {
 const path=request.nextUrl.pathname
 if(/^\/(dashboard|admin)(\/|$)/.test(path) && !request.cookies.getAll().some(c=>c.name.startsWith('sb-'))){
   const redirect=NextResponse.redirect(new URL('/login',request.url))
   redirect.headers.set('X-Robots-Tag','noindex, nofollow')
   redirect.headers.set('Cache-Control','private, no-store')
   return redirect
 }
 const embedded=path.startsWith('/embed/')
 const hosted=process.env.NEXT_PUBLIC_SUPABASE_URL
 let supabaseOrigin=''
 if(hosted){try{supabaseOrigin=new URL(hosted).origin}catch{/* fail closed */}}
 const nonce=btoa(crypto.randomUUID())
 const csp=[
 "default-src 'self'", "base-uri 'self'", "object-src 'none'",
 "form-action 'self'", "frame-ancestors "+(embedded?'https: http://localhost:*':"'none'"),
 "script-src 'self' 'nonce-"+nonce+"' 'strict-dynamic' https://challenges.cloudflare.com https://checkout.razorpay.com"+(process.env.NODE_ENV==='development'?" 'unsafe-eval'":""),
 "style-src 'self' 'unsafe-inline'", "font-src 'self' data:", "img-src 'self' data: blob: "+supabaseOrigin,
 "connect-src 'self' "+supabaseOrigin+" https://*.razorpay.com https://challenges.cloudflare.com",
 "frame-src 'self' https://challenges.cloudflare.com https://*.razorpay.com", "worker-src 'self' blob:"
 ].join('; ')
 const origin=request.headers.get('origin')
 if(path.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method)&&origin&&!sameOrigin(origin,request.url))
   return NextResponse.json({error:'Request origin is not allowed.'},{status:403})
 const headers=new Headers(request.headers)
 headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp)
 headers.set('x-loopkit-embed',String(embedded))
 const res=NextResponse.next({request:{headers}})
 res.headers.set('Content-Security-Policy',csp)
 if(!embedded)res.headers.set('X-Frame-Options','DENY')
 if(/^\/(dashboard|admin|s|embed|auth|api|login|register)(\/|$)/.test(path)){
   res.headers.set('X-Robots-Tag','noindex, nofollow');res.headers.set('Cache-Control','private, no-store')
 }
 await refreshSession(request,res)
 return res
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|woff2)$).*)']}
