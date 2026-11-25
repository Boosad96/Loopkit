import { notFound } from 'next/navigation'
import Directory from '@/components/account/Directory'
import { directoryPlatform,platformNames } from '@/lib/account/validation'
import { type Query } from '@/components/account/ui'
type Props={params:Promise<{directory:string}>;searchParams:Query}
function platform(key:string) {
  if (!Object.hasOwn(directoryPlatform,key)) notFound()
  return directoryPlatform[key as keyof typeof directoryPlatform]
}
export async function generateMetadata({params,searchParams}:Props) {
 const {directory}=await params
 return {title:platformNames[platform(directory)]+' directory',alternates:{canonical:'/discover/'+directory},robots:{index:Object.keys(await searchParams).length===0}}
}
export default async function Screen({params,searchParams}:Props) {
  return <Directory platform={platform((await params).directory)} searchParams={searchParams} />
}
