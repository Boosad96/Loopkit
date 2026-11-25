import Link from 'next/link'
import { Article } from '../../lib/editorial/Layout'
import { publishedGuides } from '../../lib/editorial/repository'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  return {title:'Community guides', description:'Practical walkthroughs for community organizers.', robots:{index:(await publishedGuides()).length > 0, follow:true}, alternates:{canonical:'/blog'}}
}
export default async function Blog() {
  const guides = await publishedGuides()
  return <Article title="Community guides" intro="Walkthroughs for organizers running events, managing groups and preparing creative assets.">
    {guides.length ? guides.map(guide => <section key={guide.slug}><h2><Link href={'/blog/' + guide.slug}>{guide.title}</Link></h2><p>{guide.summary}</p></section>) :
      <p>The first guides are in editorial review. <Link href="/tools">Explore the tools</Link> for instructions you can use today.</p>}
  </Article>
}
