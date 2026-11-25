import { serviceClient } from '@/lib/account/server';
import { billingConfigured } from '@/lib/billing/razorpay';
import { PlacementLink } from './PlacementLink';
import './billing.css';
export async function SponsoredPlacement({slot}:{slot:string}) {
  const empty=slot==='homepage'?<aside className="bill-spot"><h3>Community Spotlight</h3><p>Introduce an approved community to visitors looking for their next event.</p><a className="bill-link" href="/promote">Explore spotlight placements</a></aside>:null;
  if (!billingConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return empty;
  const db=serviceClient(), now=new Date().toISOString();
  const {data:s}=await db.from('sponsorships').select('id,listing_id').eq('slot_id',slot).eq('status','confirmed').lte('starts_at',now).gt('ends_at',now).limit(1).maybeSingle();
  if (!s) return empty;
  const {data:l}=await db.from('directory_entries').select('slug,name,description').eq('id',s.listing_id).maybeSingle();
  if (!l) return empty;
  return <aside className="bill-spot"><p>Sponsored · Test placement</p><h3>{l.name}</h3><p>{l.description}</p><PlacementLink id={s.id} href={'/community/'+encodeURIComponent(l.slug)}/></aside>;
}
