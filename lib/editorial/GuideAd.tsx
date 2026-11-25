import { adSettings } from './ads'
import { ConsentAd } from './ConsentAd'

export async function GuideAd({guideSlug}:{guideSlug:string}) {
  const config = await adSettings()
  const allowed = (process.env.ADSENSE_REVIEWED_GUIDES ?? '').split(',').map(value=>value.trim())
  if (!config || !allowed.includes(guideSlug)) return null
  return <ConsentAd publisher={config.publisher} slot={config.slot}/>
}
