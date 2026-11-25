import Link from 'next/link'
import {notFound} from 'next/navigation'
import {tools} from '@/lib/tools'
import UtilityEditor from '@/components/utilities/UtilityEditor'
import ProjectEditor from '@/components/projects/ProjectEditor'
import type {Metadata} from 'next'
type Props={params:Promise<{slug:string}>}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params; const t=tools.find(x=>x.slug===slug);return t?{title:t.name,description:t.description,alternates:{canonical:'/tools/'+slug},openGraph:{title:t.name,description:t.description}}:{}}
export default async function ToolPage({params}:Props){
 const {slug}=await params,t=tools.find(x=>x.slug===slug);if(!t)notFound()
 const base=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000'
 const schema=[{'@context':'https://schema.org','@type':'WebApplication',name:t.name,applicationCategory:'UtilitiesApplication',operatingSystem:'Web',description:t.description},{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Tools',item:base+'/tools'},{'@type':'ListItem',position:2,name:t.name,item:base+'/tools/'+slug}]}]
 return <section className="tool-wrap"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><nav aria-label="Breadcrumb"><Link href="/tools">Tools</Link> / {t.category}</nav><h1>{t.name}</h1><p>{t.description}</p>{t.local?<UtilityEditor slug={slug}/>:<ProjectEditor slug={slug}/>}<section className="tool-guide"><h2>How to use it</h2><ol>{t.steps.map(s=><li key={s}>{s}</li>)}</ol><p>{t.example} {t.limitation}</p><h2>Related tools</h2>{tools.filter(x=>x.slug!==slug&&x.category===t.category).map(x=><Link key={x.slug} href={'/tools/'+x.slug}>{x.name} </Link>)}</section></section>
}
