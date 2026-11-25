import Link from 'next/link'
import { userClient } from '@/lib/account/server'
import { categories, escapedSearch, platformNames, type Platform } from '@/lib/account/validation'
import { Notice, Page, styles, type Query, one } from './ui'

export default async function Directory({ searchParams, platform }: { searchParams: Query; platform?: Platform }) {
  const query = await searchParams
  const search = one(query.q).trim().slice(0,80)
  const category = one(query.category)
  const language = one(query.language).trim().slice(0,40)
  const page = Math.min(100,Math.max(1,Number.parseInt(one(query.page),10)||1))
  const db = await userClient()
  const limit = 18
  let stmt = db?.from('directory_entries').select('id,slug,name,description,platform,category,language,vote_count,logo_path,tags')
  if (platform) stmt = stmt?.eq('platform',platform)
  if (category && categories.some(v=>v===category)) stmt = stmt?.eq('category',category)
  if (search) stmt = stmt?.ilike('name','%'+escapedSearch(search)+'%')
  if (language) stmt = stmt?.ilike('language',escapedSearch(language))
  const response = await stmt?.order('vote_count',{ascending:false}).order('created_at',{ascending:false}).order('id').range((page-1)*limit,page*limit)
  const entries = response?.data || []
  function move(n: number) {
    const p = new URLSearchParams({ page:String(n) })
    if (search) p.set('q',search)
    if (category) p.set('category',category)
    if (language) p.set('language',language)
    return '?'+p.toString()
  }
  return <Page title={platform ? {discord:'Discover Discord servers','telegram-channel':'Discover Telegram channels','telegram-bot':'Discover Telegram bots'}[platform] : 'Discover communities'} intro="Explore approved public communities. Organic results are ranked by member votes.">
    <nav className={styles.nav} aria-label="Community platforms">{[['All','/discover'],['Discord servers','/discover/discord-servers'],['Telegram channels','/discover/telegram-channels'],['Telegram bots','/discover/telegram-bots']].map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</nav>
    <form className={styles.filters} method="get"><label>Search by name<input name="q" type="search" maxLength={80} defaultValue={search} /></label><label>Category<select name="category" defaultValue={category}><option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Language<input name="language" placeholder="Any language" defaultValue={language} maxLength={40} /></label><button>Find communities</button></form>
    {!db ? <Notice code="config" /> : response?.error ? <Notice code="unavailable" /> : entries.length ? <div className={styles.grid}>{entries.slice(0,limit).map(item=><article key={item.id} className={styles.card}>
      {item.logo_path && <img className={styles.logo} src={item.logo_path} alt="" width={52} height={52} />}
      <p className={styles.meta}>{platformNames[item.platform as Platform]} · {item.category}</p><h2><Link href={'/community/'+item.slug}>{item.name}</Link></h2><p>{String(item.description).slice(0,190)}</p><small>{item.language} · {item.vote_count} votes</small>
    </article>)}</div> : <div className={styles.panel}><h2>{search||category||language?'No matching communities':'No approved communities here yet'}</h2><p>{search||category||language?'Try a different name or clear your filters.':'Submit your community for moderation to get started.'}</p><Link href="/submit">Submit a community</Link></div>}
    <nav className={styles.pager} aria-label="Directory pagination">{page>1 && <Link href={move(page-1)}>Previous page</Link>}{entries.length>limit && <Link href={move(page+1)}>Next page</Link>}</nav>
  </Page>
}
