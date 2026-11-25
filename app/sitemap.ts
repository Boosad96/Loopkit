import type { MetadataRoute } from 'next'
import { publishedGuides } from '@/lib/editorial/guides'
import {tools} from '@/lib/tools'
export default function sitemap():MetadataRoute.Sitemap{
 const base=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000'
 return ['/','/tools','/create','/discover','/discover/telegram-bots','/discover/telegram-channels','/discover/discord-servers','/pricing','/promote','/about',...(publishedGuides().length?['/blog',...publishedGuides().map(g=>'/blog/'+g.slug)]:[]),...tools.map(t=>'/tools/'+t.slug)].map(path=>({url:new URL(path,base).href}))
}
