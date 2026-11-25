import { AnalyticsPreferences } from '@/components/account/Analytics'
import Link from 'next/link'
import { Article, draftMetadata } from '../../lib/editorial/Layout'
import { policies } from '../../lib/editorial/policies'

const policy = policies['privacy']
export const metadata = {title:policy.title, description:policy.intro, ...draftMetadata}
export default function Policy() {
  return <Article title={policy.title} intro={policy.intro} draft>
    {policy.sections.map(([heading,body])=><section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
    <h2>Analytics preference on this device</h2>
    <AnalyticsPreferences/>
    <p><Link href="/contact">Contact the operator</Link></p>
  </Article>
}
