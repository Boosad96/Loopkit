import Link from 'next/link'
import { Article } from '../../lib/editorial/Layout'
import { publishedGuides } from '../../lib/editorial/guides'

export const dynamic = 'force-dynamic'
export function generateMetadata() {
  return {title:'Community guides', description:'Practical walkthroughs for community organizers.', robots:{index:publishedGuides().length > 0, follow:true}, alternates:{canonical:'/blog'}}
}
export default function Blog() {
  const guides = publishedGuides()
  return <Article title="Community guides" intro="Walkthroughs for organizers running events, managing groups and preparing creative assets.">
    {guides.length ? guides.map(guide => <section key={guide.slug}><h2><Link href={'/blog/' + guide.slug}>{guide.title}</Link></h2><p>{guide.summary}</p></section>) :
      <p>The first guides are in editorial review. <Link href="/tools">Explore the tools</Link> for instructions you can use today.</p>}
  </Article>
}
