'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin, userClient } from '../../../lib/account/server'
import { guides } from '../../../lib/editorial/guides'
import { copySchema } from '../../../lib/editorial/repository'

export async function editGuide(form:FormData) {
  await requireAdmin()
  const slug = form.get('slug')
  const intent = form.get('intent')
  const revision = Number(form.get('revision'))
  const copy = copySchema.safeParse({
    title:form.get('title'),summary:form.get('summary'),
    sections:[0,1,2].map(i=>[form.get('heading'+i),form.get('paragraph'+i)]),
  })
  if (!Number.isInteger(revision)||revision<0||typeof slug!=='string'||!guides.some(guide=>guide.slug===slug)||
      !['save','approve','withdraw'].includes(String(intent))||!copy.success) redirect('/admin/editorial?notice=invalid')
  const db=await userClient()
  const {error}=await db!.rpc('edit_guide',{guide_slug:slug,expected_revision:revision,intent,copy:copy.data})
  if (error) redirect('/admin/editorial?notice=conflict')
  for (const page of ['/admin/editorial','/blog','/blog/'+slug,'/sitemap.xml']) revalidatePath(page)
  redirect('/admin/editorial?notice=saved#'+slug)
}
