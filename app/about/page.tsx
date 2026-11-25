import Link from 'next/link'
import { Article } from '../../lib/editorial/Layout'
import { brand } from '../../lib/brand'
export const metadata = {title:'About the platform', description:'Why this toolkit brings community events and their organizers together.', alternates:{canonical:'/about'}}
export default function About() {
  return <Article title={'About '+brand.name} intro={brand.positioning}>
    <h2>One link for event day</h2><p>Organizers often announce the time in one chat and keep scores in another. Our toolkit brings the details people need to the same place, from the opening countdown to the final result.</p>
    <h2>Start with a single task</h2><p>Use the <Link href="/tools">tools directory</Link> to prepare an image, translate an event time or divide a roster into teams. Choose an <Link href="/create">Event Hub</Link> when several tools belong to the same event.</p>
    <h2>Community discovery</h2><p>The <Link href="/discover">directory</Link> helps visitors find communities. Paid placements carry a sponsorship label so visitors can distinguish them from organic results.</p>
  </Article>
}
