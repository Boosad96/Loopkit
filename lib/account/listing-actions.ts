'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { currentUser, requireUser, requireRole, requireAdmin, serviceClient, userClient } from './server'
import { verifyChallenge } from './challenge'
import { listingInput } from './validation'

function validLogo(value: string) {
  if (!value) return true
  if (value.length > 60000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value)) return false
  const bytes = Buffer.from(value.slice(22), 'base64')
  return bytes.length >= 33 && bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a' &&
    bytes.subarray(12,16).toString('ascii') === 'IHDR' && bytes.readUInt32BE(16) === 96 && bytes.readUInt32BE(20) === 96
}
export async function saveListing(form: FormData) {
  const user = await requireUser()
  const listing = String(form.get('id') || '')
  const back = listing && z.uuid().safeParse(listing).success ? '/submit?edit='+listing+'&notice=' : '/submit?notice='
  const input = listingInput.safeParse({ ...Object.fromEntries(form), tags: String(form.get('tags') || '').split(',').map(t=>t.trim()).filter(Boolean) })
  const logo = String(form.get('logo') || '')
  if (!input.success || !validLogo(logo) || (listing && !z.uuid().safeParse(listing).success)) redirect(back+'input')
  if (!await verifyChallenge(form.get('cf-turnstile-response'), 'listing')) redirect(back+'challenge')
  const { error } = await serviceClient().rpc('save_directory_listing',{ subject:user.id, listing:listing || null, fields:{ ...input.data, logo:logo || null } })
  if (error) redirect(back+'limit')
  revalidatePath('/discover','layout')
  redirect('/dashboard/listings?notice=submitted')
}
export async function vote(form: FormData) {
  const user = await requireUser()
  const id = z.uuid().safeParse(form.get('id'))
  if (!id.success) redirect('/discover')
  const { data: entry } = await serviceClient().from('directory_entries').select('slug').eq('id', id.data).maybeSingle()
  if (!entry) redirect('/discover')
  const back = '/community/'+encodeURIComponent(entry.slug)+'?notice='
  if (!await verifyChallenge(form.get('cf-turnstile-response'), 'vote')) redirect(back+'challenge')
  const { error } = await serviceClient().rpc('vote_listing', { subject:user.id, listing:id.data })
  if (error) redirect(back+'vote_failed')
  revalidatePath('/discover','layout')
  redirect(back+'voted')
}
export async function reportListing(form: FormData) {
  const id = z.uuid().safeParse(form.get('id'))
  const reason = z.string().trim().min(12).max(1000).safeParse(form.get('reason'))
  if (!reason.success || !id.success) redirect('/report?notice=input')
  const back = '/report?id='+id.data+'&notice='
  if (!await verifyChallenge(form.get('cf-turnstile-response'),'report')) redirect(back+'challenge')
  const user = await currentUser()
  const { error } = await serviceClient().rpc('report_directory_entry',{subject:user?.id || null, listing:id.data, explanation:reason.data})
  if (error) redirect(back+'limit')
  redirect('/report?notice=reported')
}
export async function moderate(form: FormData) {
  await requireRole(['moderator','admin'])
  const listing = z.uuid().safeParse(form.get('id'))
  const decision = z.enum(['approved','rejected','removed']).safeParse(form.get('decision'))
  if (!listing.success || !decision.success) redirect('/admin?notice=input')
  const db = await userClient()
  const { error } = await db!.rpc('moderate_listing',{listing:listing.data,decision:decision.data})
  if (error) redirect('/admin?notice=unavailable')
  revalidatePath('/discover','layout')
  redirect('/admin?notice=reviewed')
}
export async function setSuspension(form: FormData) {
  await requireAdmin()
  const id = z.uuid().safeParse(form.get('id'))
  if (!id.success || !['suspend','restore'].includes(String(form.get('decision')))) redirect('/admin?notice=input')
  const { error } = await (await userClient())!.rpc('change_suspension',{ subject:id.data, suspend:form.get('decision')==='suspend' })
  redirect('/admin?notice='+(error?'unavailable':'reviewed'))
}
