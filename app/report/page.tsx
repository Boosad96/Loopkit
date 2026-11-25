import { Page,styles,Notice,one,type Query,privateMetadata } from '@/components/account/ui'
import { reportListing } from '@/lib/account/listing-actions'
import Challenge from '@/components/account/Challenge'
export const metadata={...privateMetadata,title:'Report a listing'}
export default async function Screen({searchParams}:{searchParams:Query}) {
 const q=await searchParams
 return <Page title="Report a community listing" intro="Explain the issue so a moderator can review the listing. Please leave out private personal information."><Notice code={one(q.notice)}/><form action={reportListing} className={styles.form}><label>Listing ID<input name="id" defaultValue={one(q.id)} required maxLength={36}/></label><label>Reason<textarea name="reason" minLength={12} maxLength={1000} required/></label><Challenge action="report"/><button>Send report</button></form></Page>
}
