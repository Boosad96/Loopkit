import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {serviceClient} from '@/lib/account/server';
import {billingConfigured} from '@/lib/billing/razorpay';
import {readLimited} from '@/lib/billing/server';
export async function POST(req:Request){
  if(!billingConfigured()||req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-gpc')==='1'||req.headers.get('dnt')==='1')return new Response(null,{status:204});
  // Only enable on a Worker reached through Cloudflare, where the edge owns this header.
  const ip=process.env.BILLING_EDGE_METRICS==='true'?req.headers.get('cf-connecting-ip'):null;
  const secret=process.env.ANALYTICS_HASH_SECRET;
  if(!ip||!secret)return new Response(null,{status:204});
  const parsed=z.object({id:z.string().uuid(),kind:z.enum(['view','click'])}).strict().safeParse(await readLimited(req,512).then(JSON.parse).catch(()=>null));
  if(!parsed.success)return new Response(null,{status:400});
  const {id,kind}=parsed.data;
  const hash=createHmac('sha256',secret).update([new Date().toISOString().slice(0,10),id,ip].join('|')).digest('hex');
  const {error}=await serviceClient().rpc('billing_record_metric',{p_id:id,p_kind:kind,p_hash:hash});
  return new Response(null,{status:error?503:204});
}
