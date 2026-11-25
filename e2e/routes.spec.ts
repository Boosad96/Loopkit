import {test,expect} from '@playwright/test'
import {tools} from '../lib/tools'
test('public directory links resolve to sixteen distinct indexable tool pages', async({page,request})=>{
 await page.goto('/tools')
 await expect(page.locator('.tool-card')).toHaveCount(16)
 for(const tool of tools){
   const res=await request.get('/tools/'+tool.slug)
   expect(res.status(),tool.slug).toBe(200)
   const html=await res.text()
   expect(html).toContain('rel="canonical"')
   expect(html).toContain('WebApplication')
   expect(html).toContain(tool.name)
 }
})
test('private routes require sign-in and disallow indexing',async({request})=>{
 for(const path of ['/dashboard','/dashboard/analytics','/dashboard/billing','/dashboard/listings','/dashboard/settings','/admin','/admin/billing']){
   const res=await request.get(path,{maxRedirects:0})
   expect([303,307,308],path).toContain(res.status())
   expect(res.headers().location).toContain('/login')
   expect(res.headers()['x-robots-tag']).toContain('noindex')
 }
})
test('public discovery, policy and pricing pages render',async({request})=>{
 for(const path of ['/pricing','/promote','/discover','/discover/telegram-channels','/discover/telegram-bots','/discover/discord-servers','/privacy','/terms','/contact','/refund-policy','/acceptable-use','/blog','/ads.txt','/sitemap.xml','/robots.txt']){
   const res=await request.get(path)
   expect(res.status(),path).toBe(200)
 }
})
test('capture tool, directory, pricing and event editor for review',async({page})=>{
 await page.setViewportSize({width:1280,height:900})
 await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'})
 for(const [path,name] of [['/tools','tools'],['/tools/discord-timestamp-generator','timestamps'],['/tools/leaderboard-maker','leaderboard'],['/discover','discover'],['/pricing','pricing'],['/create','event-hub-editor']]){
   await page.goto(path)
   await expect(page.locator('h1').first()).toBeVisible()
   await page.evaluate(()=>document.fonts.ready)
   expect(await page.evaluate(()=>document.documentElement.scrollWidth),path).toBeLessThanOrEqual(1280)
   await page.screenshot({path:'qa/'+name+'.png',animations:'disabled'})
 }
})
