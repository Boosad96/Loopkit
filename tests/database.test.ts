import { readFile, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, expect, test } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'

const db=new PGlite({extensions:{btree_gist}})
const member=randomUUID(), outsider=randomUUID(), admin=randomUUID(), listing=randomUUID()
beforeAll(async()=>{
  await db.exec(`
   create role anon; create role authenticated; create role service_role bypassrls;
   create schema extensions; create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$
     select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to anon,authenticated,service_role;
   alter default privileges in schema public grant all on tables to service_role;
   alter default privileges in schema public grant all on sequences to service_role;
  `)
  const dir='supabase/migrations'
  for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort())
    await db.exec(await readFile(dir+'/'+name,'utf8'))
  await db.query('insert into auth.users values ($1),($2),($3)',[member,outsider,admin])
  await db.query("update profiles set role='admin' where id=$1",[admin])
  await db.query("insert into community_listings(id,owner_id,name,description,platform,category,official_link,language) values ($1,$2,'Local Test','Development-only listing for integration testing','discord','Gaming','https://discord.gg/demo','en')",[listing,member])
},30000)
afterAll(()=>db.close())
async function role(name:'anon'|'authenticated',subject=''){
 await db.exec('reset role')
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[subject])
 await db.exec('set role '+name)
}
test('pending submission is hidden from the anonymous directory',async()=>{
 await role('anon')
 expect((await db.query('select * from directory_entries')).rows).toHaveLength(0)
 await expect(db.query('select * from community_listings')).rejects.toThrow()
})
test('authenticated outsider cannot change roles, moderate or access service procedures',async()=>{
 await role('authenticated',outsider)
 expect((await db.query('select * from community_listings')).rows).toHaveLength(0)
 await expect(db.query("update profiles set role='admin' where id=$1",[outsider])).rejects.toThrow()
 await expect(db.query("select moderate_listing($1,'approved')",[listing])).rejects.toThrow()
 await expect(db.query("select billing_reserve($1,$2,'pro',null,null)",[outsider,randomUUID()])).rejects.toThrow()
})
test('admin approval exposes public fields and removing listing hides it again',async()=>{
 await role('authenticated',admin)
 await db.query("select moderate_listing($1,'approved')",[listing])
 await role('anon')
 const result=await db.query('select * from directory_entries')
 expect(result.rows).toHaveLength(1);expect(result.rows[0]).not.toHaveProperty('owner_id')
 await role('authenticated',admin)
 await db.query("select moderate_listing($1,'removed')",[listing])
 await role('anon')
 expect((await db.query('select * from directory_entries')).rows).toHaveLength(0)
})
test('read permissions isolate other organizers and hide management hashes',async()=>{
 await db.exec('reset role')
 await db.query("insert into projects(slug,kind,title,config,owner_id) values ('1234567890abcdef12345678','goal-tracker','Staging goal','{}',$1)",[member])
 await role('authenticated',outsider)
 expect((await db.query('select slug from projects')).rows).toHaveLength(0)
 await expect(db.query('select management_hash from projects')).rejects.toThrow()
 await expect(db.query("update projects set title='Changed'")).rejects.toThrow()
 await role('authenticated',member)
 expect((await db.query('select slug from projects')).rows).toHaveLength(1)
})

test('growth attribution preserves legacy usage and exposes aggregates only to the service role',async()=>{
 const visitor=randomUUID(), session=randomUUID()
 await db.exec('reset role')
 await db.exec('set role service_role')
 await db.query("select record_usage($1,'page_view',null)",[visitor])
 for(const event of ['page_view','page_view','tool_start','tool_complete']){
  await db.query(`select record_attributed_usage($1,$2,null,$3,'/tools/spin-wheel',
    'campaign','loopkit_growth','hn','spin-wheel')`,[visitor,event,session])
 }
 await db.query("select record_attributed_usage($1,'page_view',null,$2,'/tools','organic',null,null,null)",[visitor,randomUUID()])
 const {rows}=await db.query<{report:unknown}>('select growth_attribution_summary() as report')
 expect(rows[0].report).toMatchObject({
  visits:2,referral_visits:1,organic_visits:1,campaign_visits:1,tool_starts:1,tool_completions:1,campaign_completions:1,
  landing_pages:[{name:'/tools',visits:1},{name:'/tools/spin-wheel',visits:1}],
  campaign_sources:[{name:'loopkit_growth:hn',visits:1,completions:1}],
  tools:[{name:'spin-wheel',starts:1,completions:1}],
 })
 await role('authenticated',admin)
 await expect(db.query('select growth_attribution_summary()')).rejects.toThrow(/permission denied/)
 await expect(db.query("select record_attributed_usage($1,'page_view',null,$2,'/','direct',null,null,null)",[visitor,session])).rejects.toThrow(/permission denied/)
 await role('anon')
 await expect(db.query('select growth_attribution_summary()')).rejects.toThrow(/permission denied/)
})
