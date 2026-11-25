import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Article } from '../../../lib/editorial/Layout'
import { publishedGuides } from '../../../lib/editorial/guides'
import { GuideAd } from '../../../lib/editorial/GuideAd'

type Props = {params:Promise<{slug:string}>}
export const dynamic = 'force-dynamic'
async function guideFor(params:Props['params']) {
  const {slug} = await params
  return publishedGuides().find(item => item.slug === slug) ?? notFound()
}
export async function generateMetadata({params}:Props) {
  const guide = await guideFor(params)
  return {title:guide.title, description:guide.summary, alternates:{canonical:'/blog/'+guide.slug}, openGraph:{type:'article',title:guide.title,description:guide.summary}}
}
export default async function GuidePage({params}:Props) {
  const guide = await guideFor(params)
  return <Article title={guide.title} intro={guide.summary} section="Community guides">
    {guide.sections.map(([heading,copy])=><section key={heading}><h2>{heading}</h2><p>{copy}</p></section>)}
    <p><Link href={'/tools/'+guide.tool}>Open the tool</Link></p>
    <GuideAd guideSlug={guide.slug}/>
  </Article>
}
