import { requireAdmin } from '../../../lib/account/server'
import { Article, draftMetadata } from '../../../lib/editorial/Layout'
import { releaseCandidates } from '../../../lib/editorial/guides'
import { editorialDrafts } from '../../../lib/editorial/repository'
import { editGuide } from './actions'
import styles from '../../../lib/editorial/editorial.module.css'

export const metadata={title:'Editorial review',...draftMetadata}
export default async function Editorial({searchParams}:{searchParams:Promise<{notice?:string}>}) {
  await requireAdmin()
  const articles=await editorialDrafts()
  const {notice}=await searchParams
  const allowed=new Set(releaseCandidates().map(item=>item.slug))
  return <Article title="Editorial review" intro="Edit the starter guides and approve a specific version for release. Only approved, allowlisted guides are public.">
    {notice==='saved'&&<p role="status">Changes saved.</p>}
    {notice==='invalid'&&<p role="alert">Check the title, summary and all three sections.</p>}
    {notice==='conflict'&&<p role="alert">The guide could not be saved. Reload the latest revision before editing again.</p>}
    {articles?articles.map(({guide,approved,revision})=><details id={guide.slug} key={guide.slug} className={styles.review}>
      <summary>{guide.title} · {approved?(allowed.has(guide.slug)?'Published':'Approved for release'):'Draft'}</summary>
      <form action={editGuide}>
        <input type="hidden" name="slug" value={guide.slug}/><input type="hidden" name="revision" value={revision}/>
        <label>Title<input name="title" required minLength={3} maxLength={140} defaultValue={guide.title}/></label>
        <label>Summary<textarea name="summary" required minLength={10} maxLength={400} defaultValue={guide.summary}/></label>
        {guide.sections.map(([heading,paragraph],i)=><fieldset key={i}><legend>Section {i+1}</legend>
          <label>Heading<input name={'heading'+i} required minLength={3} maxLength={120} defaultValue={heading}/></label>
          <label>Body<textarea name={'paragraph'+i} rows={5} required minLength={15} maxLength={1800} defaultValue={paragraph}/></label>
        </fieldset>)}
        <div><button name="intent" value="save">Save draft</button> <button name="intent" value="approve">Approve this version</button> {approved&&<button name="intent" value="withdraw">Withdraw guide</button>}</div>
      </form></details>):<p role="alert">Editorial storage is unavailable. Check the database migration and reload.</p>}
  </Article>
}
