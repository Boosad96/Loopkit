import { adSettings } from '../../lib/editorial/ads'

export const dynamic = 'force-dynamic'
export async function GET() {
  const settings = await adSettings()
  return new Response(settings ? `google.com, ${settings.publisher}, DIRECT, f08c47fec0942fa0\n` : '# No authorized advertising sellers configured.\n', {
    headers: {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'},
  })
}
