import { cache } from 'react'
import { z } from 'zod'
import { serviceClient, userClient } from '../account/server'
import { guides, releaseCandidates, type Guide } from './guides'

export const copySchema = z.object({
  title:z.string().trim().min(3).max(140),
  summary:z.string().trim().min(10).max(400),
  sections:z.array(z.tuple([z.string().trim().min(3).max(120),z.string().trim().min(15).max(1800)])).length(3),
}).strict()

export const publishedGuides = cache(async ():Promise<Guide[]>=>{
  const candidates = releaseCandidates()
  if (!candidates.length) return []
  try {
    const {data,error} = await serviceClient().from('editorial_guides')
      .select('slug,approved').in('slug', candidates.map(guide=>guide.slug)).not('approved','is',null)
    if (error || !data) return []
    return candidates.flatMap(guide=>{
      const checked = copySchema.safeParse(data.find(row=>row.slug===guide.slug)?.approved)
      return checked.success ? [{...guide,...checked.data}] : []
    })
  } catch {
    return []
  }
})

export async function editorialDrafts() {
  const db = await userClient()
  if (!db) return null
  const {data,error} = await db.from('editorial_guides').select('slug,draft,approved,revision').in('slug', guides.map(guide=>guide.slug))
  if (error || !data) return null
  return guides.map(guide=>{
    const row=data.find(entry=>entry.slug===guide.slug)
    const draft=copySchema.safeParse(row?.draft)
    return {guide:draft.success?{...guide,...draft.data}:guide, approved:!!row?.approved, revision:Number(row?.revision??0)}
  })
}
