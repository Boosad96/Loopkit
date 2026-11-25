import 'server-only';
import { currentUser, serviceClient } from '@/lib/account/server';
import { defaults, type Price } from './contracts';
import { billingConfigured } from './razorpay';
export async function prices(): Promise<Price[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return defaults;
  const { data, error } = await serviceClient().from('billing_prices').select('product,amount,currency');
  if (error || !data?.length) return defaults;
  return data as Price[];
}
export async function hasPro(userId: string) {
  if (!billingConfigured()) return false;
  const { data, error } = await serviceClient().rpc('billing_has_pro', { p_user: userId });
  return !error && data === true;
}
export async function authenticatedWrite(request: Request) {
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return null;
  return await currentUser();
}
export async function readLimited(request: Request, limit: number) {
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new Error('Payload too large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error('Payload too large'); }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function fail(message: string, status: number) { return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } }); }
