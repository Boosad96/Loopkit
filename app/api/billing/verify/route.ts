import { z } from 'zod';
import { serviceClient } from '@/lib/account/server';
import { authenticatedWrite, fail, readLimited } from '@/lib/billing/server';
import { provider,billingConfigured } from '@/lib/billing/razorpay';
export async function POST(req: Request) {
  if (!billingConfigured()) return fail('Test checkout unavailable.',503);
  const user = await authenticatedWrite(req);
  if (!user) return fail('Sign in to continue.',403);
  const data = z.object({order:z.string().uuid(),payment:z.string().regex(/^pay_[A-Za-z0-9]{1,90}$/),signature:z.string().length(64)}).strict().safeParse(await readLimited(req,2048).then(JSON.parse).catch(()=>null));
  if (!data.success) return fail('Invalid receipt.',400);
  const {data:order} = await serviceClient().from('orders').select('product,provider_id').eq('id',data.data.order).eq('user_id',user.id).maybeSingle();
  if (!order?.provider_id || !provider().verifyCheckout(order.provider_id,data.data.payment,data.data.signature,order.product==='pro'?'subscription':'order')) return fail('Receipt verification failed.',400);
  return Response.json({message:'Receipt verified. Your billing history updates after the provider confirms capture.'});
}
