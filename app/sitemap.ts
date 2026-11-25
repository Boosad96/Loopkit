import type { MetadataRoute } from 'next'
import { toolPolicies } from '@/lib/account/tools'
import { publishedGuides } from '@/lib/editorial/repository'
import { tools } from '@/lib/tools'

export const dynamic = 'force-dynamic'
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const base=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000'
  const [guides,policies]=await Promise.all([publishedGuides(),toolPolicies()])
  const paths=['/','/tools','/create','/discover','/discover/telegram-bots','/discover/telegram-channels','/discover/discord-servers','/pricing','/promote','/about',
    ...(guides.length?['/blog',...guides.map(guide=>'/blog/'+guide.slug)]:[]),
    ...tools.filter(tool=>policies[tool.slug]?.available!==false && policies[tool.slug]?.indexable!==false).map(tool=>'/tools/'+tool.slug)]
  return paths.map(path=>({url:new URL(path,base).href}))
}
