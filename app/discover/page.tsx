import Directory from '@/components/account/Directory'
import { type Query } from '@/components/account/ui'
export async function generateMetadata({searchParams}:{searchParams:Query}) {
  return {title:'Community directory',description:'Find public Discord servers, Telegram channels and bots by community votes, category and language.',alternates:{canonical:'/discover'},robots:{index:Object.keys(await searchParams).length===0}}
}
export default function Screen({searchParams}:{searchParams:Query}) { return <Directory searchParams={searchParams} /> }
