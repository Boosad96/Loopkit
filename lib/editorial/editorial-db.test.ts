import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import {guides} from './guides'

const db=new PGlite()
const {slug,title,summary,sections}=guides[0]
const copy=JSON.stringify({title,summary,sections})
beforeAll(async()=>{
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select 'bbbbbbbb-0000-4000-8000-000000000001'::uuid $$;
    create function public.is_loopkit_admin() returns boolean language sql stable as $$
      select current_setting('test.admin',true)='true' $$;
    create table moderation_actions(actor_id uuid, action text, details jsonb);
  `)
  await db.exec(await readFile('supabase/migrations/004_editorial.sql','utf8'))
},30000)
afterAll(()=>db.close())
function edit(revision:number,intent:string,body=copy) {
  return db.query('select edit_guide($1,$2,$3,$4::jsonb)',[slug,revision,intent,body])
}
test('private draft permissions, version conflicts, publication, withdrawal and audit',async()=>{
  await db.exec("set role anon")
  await expect(edit(0,'approve')).rejects.toThrow()
  await expect(db.query('select * from editorial_guides')).rejects.toThrow()
  await db.exec("reset role; set role authenticated; set test.admin='false'")
  await expect(edit(0,'approve')).rejects.toThrow()
  await db.exec("set test.admin='true'")
  await edit(0,'save')
  expect((await db.query('select approved from editorial_guides')).rows).toEqual([{approved:null}])
  await expect(edit(0,'approve')).rejects.toThrow()
  await expect(edit(1,'approve','{}')).rejects.toThrow()
  await edit(1,'approve')
  const changed={title:title+' revised',summary,sections}
  await edit(2,'save',JSON.stringify(changed))
  expect((await db.query("select approved->>'title' approved,draft->>'title' draft from editorial_guides")).rows).toEqual([{approved:title,draft:changed.title}])
  await db.exec("set test.admin='false'")
  expect((await db.query('select * from editorial_guides')).rows).toEqual([])
  await db.exec("set test.admin='true'")
  await edit(3,'withdraw',JSON.stringify(changed))
  expect((await db.query('select approved,revision from editorial_guides')).rows).toEqual([{approved:null,revision:4}])
  await db.exec('reset role')
  expect((await db.query('select count(*)::int count from moderation_actions')).rows).toEqual([{count:4}])
})
