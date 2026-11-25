import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ProjectEditor from '@/components/projects/ProjectEditor'
import {getView} from '@/lib/projects/server'
import {kinds,labels} from '@/lib/projects/model'

export const metadata:Metadata={title:'Create a community project',robots:{index:false,follow:false}}
export default async function Create({searchParams}:{searchParams:Promise<{edit?:string;remix?:string;tool?:string}>}){
 const params=await searchParams, slug=params.edit||params.remix
 let view=null
 if(slug){try{view=await getView(slug)}catch{return <main className="project-host"><h1>Project storage is unavailable</h1><p>Please try again after the site owner checks the Supabase configuration.</p></main>}if(!view)notFound()}
 const kind=view?.kind??kinds.find(k=>k===params.tool)??'community-event-page-maker'
 return <main className="project-host"><h1>{params.edit?'Manage project':params.remix?'Remix project':'Create a community project'}</h1>
 {!view&&<nav className="project-actions" aria-label="Choose a project type">{kinds.map(k=><Link key={k} href={'/create?tool='+k} aria-current={k===kind?'page':undefined}>{labels[k]}</Link>)}</nav>}
 <ProjectEditor key={kind+slug} slug={kind} existing={view??undefined} mode={params.edit?'edit':params.remix?'remix':undefined}/></main>
}
