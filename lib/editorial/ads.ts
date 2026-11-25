import { serviceClient } from '../account/server'

export async function adSettings() {
  const publisher = process.env.ADSENSE_PUBLISHER_ID?.trim()
  const slot = process.env.ADSENSE_GUIDE_SLOT?.trim()
  if (process.env.ADSENSE_ENABLED !== 'true' || process.env.ADSENSE_APPROVED !== 'true' ||
    !publisher || !/^pub-\d{16}$/.test(publisher) || !slot || !/^\d{10}$/.test(slot)) return null
  try {
    const db = serviceClient()
    const {data, error} = await db.from('site_settings').select('value').eq('key', 'adsense_enabled').maybeSingle()
    if (error || data?.value !== true) return null
    return {publisher, slot}
  } catch {
    return null
  }
}
