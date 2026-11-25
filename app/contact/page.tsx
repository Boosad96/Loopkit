import Link from 'next/link'
import { Article, ContactLink } from '../../lib/editorial/Layout'
export const metadata = {title:'Contact', description:'Contact the operator about an account, purchase or community safety concern.',alternates:{canonical:'/contact'}}
export default function Contact() {
  return <Article title="Contact" intro="For account, privacy or billing questions, contact the operator.">
    <ContactLink/><h2>Report a listing</h2><p>Use the <Link href="/report">reporting page</Link> and include its public URL and the reason for your report.</p>
    <h2>What to include</h2><p>For a purchase, include the order reference and transaction date. Keep passwords, card details and private project management links out of your message.</p>
  </Article>
}
