import { test, expect, type BrowserContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { randomUUID, createHash, randomBytes } from 'node:crypto'
import { initialConfig } from '../lib/projects/model'

const url=process.env.NEXT_PUBLIC_SUPABASE_URL||''
if (new URL(url).hostname!=='127.0.0.1') throw Error('These tests require a disposable Supabase instance on loopback.')
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
const origin=process.env.NEXT_PUBLIC_SITE_URL||'http://127.0.0.1:3000'
const password=randomBytes(24).toString('hex')
const accounts:string[]=[]
async function login(context:BrowserContext,role:'member'|'admin'){
 const email='loopkit-'+randomUUID()+'@example.test'
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true})
 if(error||!data.user)throw error||Error('Local identity creation failed.')
 accounts.push(data.user.id)
 if(role==='admin'){
   const {error}=await admin.from('profiles').update({role}).eq('id',data.user.id)
   if(error)throw error
 }
 const jar=new Map<string,string>()
 const client=createServerClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{
   getAll:()=>Array.from(jar,([name,value])=>({name,value})),
   setAll:values=>{for(const {name,value} of values)jar.set(name,value)}
 }})
 const result=await client.auth.signInWithPassword({email,password});if(result.error)throw result.error
 await context.addCookies(Array.from(jar,([name,value])=>({name,value,url:origin})))
 return data.user.id
}
test.afterAll(async()=>{for(const id of accounts)await admin.auth.admin.deleteUser(id)})
test('authenticated admin and organizer pages use real isolated database sessions',async({browser})=>{
 const member=await browser.newContext(),staff=await browser.newContext()
 await login(member,'member');await login(staff,'admin')
 const page=await member.newPage()
 await page.goto(origin+'/dashboard')
 await expect(page.getByRole('heading',{name:'Your workspace'})).toBeVisible()
 await page.screenshot({path:'qa/authenticated-dashboard.png'})
 await page.goto(origin+'/admin')
 await expect(page.getByRole('heading',{name:'Administration',exact:true})).toHaveCount(0)
 const staffPage=await staff.newPage()
 await staffPage.goto(origin+'/admin')
 await expect(staffPage.getByRole('heading',{name:'Administration'})).toBeVisible()
 await staffPage.screenshot({path:'qa/authenticated-admin.png'})
 await member.close();await staff.close()
})
test('anonymous project can be viewed, embedded, claimed and then edited by its owner',async({browser,request})=>{
 const slug=randomBytes(12).toString('hex'),token=randomBytes(32).toString('hex')
 const config=initialConfig('goal-tracker')
 config.title='Development-only integration goal'
 const {error}=await admin.rpc('project_save',{p_slug:slug,p_kind:'goal-tracker',p_cfg:config,p_user:null,
 p_hash:createHash('sha256').update(token).digest('hex'),p_rev:0,p_days:1,p_cap:10})
 if(error)throw error
 try{
 const publicView=await request.get('/api/projects/'+slug)
 expect(publicView.ok()).toBeTruthy();expect(await publicView.text()).not.toContain(token)
 for(const prefix of ['/s/','/embed/']){
   const res=await request.get(prefix+slug)
   expect(res.ok()).toBeTruthy();expect(await res.text()).toContain(config.title)
   expect(res.headers()['x-robots-tag']).toContain('noindex')
 }
 const headers={origin}
 const payload={kind:'goal-tracker',config:{...config,progress:37},revision:1}
 const denied=await request.put('/api/projects/'+slug,{headers,data:payload})
 expect(denied.status()).toBe(403)
 const member=await browser.newContext()
 await login(member,'member')
 const claimed=await member.request.post(origin+'/api/projects/'+slug,{headers:{origin,authorization:'Bearer '+token},data:{action:'claim'}})
 expect(claimed.ok(),await claimed.text()).toBeTruthy()
 const saved=await member.request.put(origin+'/api/projects/'+slug,{headers,data:{...payload,revision:2}})
 expect(saved.ok(),await saved.text()).toBeTruthy()
 expect((await (await request.get('/api/projects/'+slug)).json()).config.progress).toBe(37)
 await member.close()
 }finally{await admin.from('projects').delete().eq('slug',slug)}
})
