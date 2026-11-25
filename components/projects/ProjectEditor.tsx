'use client'
import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import Challenge from '@/components/account/Challenge'
import { components, configSchema, initialConfig, kinds, labels, localTime, recordScore, resolveTime, rounds, shuffle, slugPattern, type Config, type Kind, type View } from '@/lib/projects/model'
import ProjectView,{draftView} from './ProjectView'
import Sharing from './Sharing'
import './projects.css'

function DateEditor({value,zone,onChange}:{value:string;zone:string;onChange:(value:string,zone:string)=>void}){
 const [wall,setWall]=useState(localTime(value,zone)),[error,setError]=useState('')
 const zones=Array.from(new Set(['UTC',zone,...(Intl.supportedValuesOf?.('timeZone')??[])]))
 useEffect(()=>setWall(localTime(value,zone)),[zone,value])
 function apply(w:string,z:string){setWall(w);try{onChange(resolveTime(w,z),z);setError('')}catch{setError('This time is missing or ambiguous in the chosen timezone. Choose another time, or enter the exact instant in UTC.')}}
 return <><label>Date and time<input type="datetime-local" value={wall} required aria-invalid={!!error} ref={el=>el?.setCustomValidity(error)} onChange={e=>apply(e.target.value,zone)}/></label><label>Timezone<select value={zone} onChange={e=>apply(wall,e.target.value)}>{zones.map(z=><option key={z}>{z}</option>)}</select></label>{error&&<p role="alert">{error}</p>}</>
}

function Matches({config,change}:{config:Config;change:(v:Config['scores'])=>void}){
 return <div>{rounds(config).map((round,l)=><fieldset key={l}><legend>Round {l+1}</legend>{round.map((m,i)=>m.a&&m.b?<MatchScore key={m.key+':'+m.a.id+':'+m.b.id} a={m.a.name} b={m.b.name} current={m.score} onRecord={s=>change(recordScore(config,l,i,s))}/>:<p key={m.key}>{m.a?.name??m.b?.name??'Awaiting earlier matches'}{m.bye?' advances by bye':''}</p>)}</fieldset>)}</div>
}
function MatchScore({a,b,current,onRecord}:{a:string;b:string;current?:[number,number];onRecord:(s:[number,number])=>void}){
 const [s,set]=useState<[string,string]>([String(current?.[0]??''),String(current?.[1]??'')])
 const [error,setError]=useState('')
 return <div className="pj-score"><label>{a}<input type="number" min={0} max={999} value={s[0]} onChange={e=>set([e.target.value,s[1]])}/></label><label>{b}<input type="number" min={0} max={999} value={s[1]} onChange={e=>set([s[0],e.target.value])}/></label><button type="button" onClick={()=>{const nums=s.map(Number) as [number,number];if(s.some(x=>x==='')||nums.some(n=>!Number.isInteger(n)||n<0||n>999)||nums[0]===nums[1]){setError('Enter two different whole scores from 0 to 999.');return}onRecord(nums);setError('')}}>Record score</button>{error&&<p role="alert">{error}</p>}</div>
}
export default function ProjectEditor({slug,existing,mode}:{slug:string;existing?:View;mode?:'edit'|'remix'}){
 const kind=slug as Kind
 const [cfg,setConfig]=useState<Config|null>(existing?.config??null),[published,setPublished]=useState(mode==='edit'?existing?.slug??'':''),[revision,setRevision]=useState(mode==='edit'?existing?.revision??0:0),[token,setToken]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[challengeKey,refresh]=useState(0)
 useEffect(()=>{if(!existing&&kinds.includes(kind))setConfig(initialConfig(kind));if(mode==='edit'&&existing){try{setToken(sessionStorage.getItem('lk-manage:'+existing.slug)??'')}catch{}}},[kind,existing,mode])
 if(!cfg||!kinds.includes(kind))return <p>Opening editor…</p>
 const c=cfg
 const set=<K extends keyof Config>(k:K,v:Config[K])=>setConfig(old=>old?{...old,[k]:v}:old)
 function mutate(patch:Partial<Config>){setConfig(old=>old?{...old,...patch}:old)}
 const is=(k:Kind)=>kind===k
 function text(k:'title'|'description'|'completion'|'organizer'|'rules'|'logo',label:string,multi=false){
   return <label>{label}{multi?<textarea maxLength={2000} value={c[k]} onChange={e=>set(k,e.target.value)}/>:<input required={k==='title'} maxLength={k==='logo'?1600:k==='title'?100:240} value={c[k]} onChange={e=>set(k,e.target.value)}/>}</label>
 }
 function attachment(k:keyof Config['attachments']){
   return <label>Linked {k.toLowerCase()} ID<input placeholder="24-character project ID" value={c.attachments[k]} onChange={e=>set('attachments',{...c.attachments,[k]:e.target.value.trim().replace(/^.*\/s\//,'').split(/[?#]/)[0]})}/><small>Paste its public LoopKit link or project ID.</small></label>
 }
 function reorder(order:Config['order'],a:number,b:number){const next=[...order];[next[a],next[b]]=[next[b],next[a]];set('order',next)}
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return
  const valid=configSchema.safeParse(c)
  if(!valid.success){const issue=valid.error.issues[0];setMessage('Check '+issue.path.join(' › ')+'. '+issue.message);return}
  setBusy(true);setMessage('')
  try{
   const res=await fetch('/api/projects'+(published?'/'+published:''),{method:published?'PUT':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({kind,config:valid.data,revision,challenge:new FormData(e.currentTarget).get('cf-turnstile-response')??undefined})})
   const data=await res.json();if(!res.ok)throw Error(data.error)
   setPublished(data.slug);setRevision(data.revision);if(data.managementToken){setToken(data.managementToken);try{sessionStorage.setItem('lk-manage:'+data.slug,data.managementToken)}catch{}}
   setMessage('Saved. Your public link is ready.')
  }catch(x){setMessage(x instanceof Error?x.message:'Unable to save.')}finally{setBusy(false);refresh(i=>i+1)}
 }
 async function claim(){
   setBusy(true);try{const r=await fetch('/api/projects/'+published,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'claim'})}),j=await r.json();if(!r.ok)throw Error(j.error);setToken('');try{sessionStorage.removeItem('lk-manage:'+published)}catch{}setRevision(r=>r+1);setMessage('This project now belongs to your account.')}catch(x){setMessage(x instanceof Error?x.message:'Claim failed.')}finally{setBusy(false)}
 }
 return <div className="project-workspace"><div className="project-controls"><form onSubmit={save}>
 <div className="pj-heading"><p className="pj-type">Project settings</p><h2>Customize your {labels[kind].toLowerCase()}</h2></div>
 {text('title',is('community-link-page-maker')?'Profile name':'Title')}{text('description','Description',true)}
 {(['poll-maker','countdown-maker','community-event-page-maker','community-challenge-maker'] as string[]).includes(kind)&&<DateEditor value={c.ends} zone={c.timezone} onChange={(ends,timezone)=>mutate({ends,timezone})}/>}
 {(is('countdown-maker')||is('community-event-page-maker'))&&text('completion','Completion message')}
 {is('poll-maker')&&<fieldset><legend>Poll options</legend>{c.options.map((o,i)=><div className="pj-row" key={o.id}><input value={o.name} aria-label={'Option '+(i+1)} maxLength={100} required onChange={e=>set('options',c.options.map(a=>a.id===o.id?{...a,name:e.target.value}:a))}/><button type="button" disabled={c.options.length<=2} aria-label={'Remove option '+(i+1)} onClick={()=>set('options',c.options.filter(a=>a.id!==o.id))}>Remove</button></div>)}<button type="button" disabled={c.options.length>=10} onClick={()=>set('options',[...c.options,{id:crypto.randomUUID(),name:'Option '+(c.options.length+1)}])}>Add option</button><label className="pj-check"><input type="checkbox" checked={c.multiple} onChange={e=>set('multiple',e.target.checked)}/>Allow multiple choices</label><label className="pj-check"><input type="checkbox" checked={c.hideResults} onChange={e=>set('hideResults',e.target.checked)}/>Hide results until voting</label></fieldset>}
 {is('leaderboard-maker')&&<fieldset><legend>Scores</legend>{c.entries.map((a,i)=><div className="pj-row" key={a.id}><input aria-label={'Player '+(i+1)} value={a.name} required maxLength={100} onChange={e=>set('entries',c.entries.map(v=>v.id===a.id?{...v,name:e.target.value}:v))}/><input type="number" step="any" aria-label={'Score for '+a.name} value={a.score} onChange={e=>set('entries',c.entries.map(v=>v.id===a.id?{...v,score:Number(e.target.value)}:v))}/><button type="button" disabled={c.entries.length<=1} onClick={()=>set('entries',c.entries.filter(v=>v.id!==a.id))}>Remove</button></div>)}<div className="project-actions"><button type="button" disabled={c.entries.length>=200} onClick={()=>set('entries',[...c.entries,{id:crypto.randomUUID(),name:'Player '+(c.entries.length+1),score:0}])}>Add player</button><button type="button" onClick={()=>{if(window.confirm('Reset all player scores to zero?'))set('entries',c.entries.map(v=>({...v,score:0})))}}>Reset scores</button></div><label>Tie handling<select value={c.tie} onChange={e=>set('tie',e.target.value as Config['tie'])}><option value="competition">Competition (1, 1, 3)</option><option value="dense">Dense (1, 1, 2)</option><option value="ordinal">Alphabetical tiebreak (1, 2, 3)</option></select></label></fieldset>}
 {is('tournament-bracket-maker')&&<fieldset><legend>Single elimination</legend><label>Seed order · one team per line<textarea rows={6} value={c.teams.map(t=>t.name).join('\n')} onChange={e=>mutate({teams:e.target.value.split('\n').slice(0,32).map((name,i)=>({id:c.teams[i]?.id??crypto.randomUUID(),name})),scores:{}})}/></label><small>Enter 2–32 teams. Seed 1 is strongest. Changing the seed list clears match scores.</small><div className="project-actions"><button type="button" onClick={()=>mutate({teams:shuffle(c.teams),scores:{}})}>Shuffle seeds</button>{[4,8,16,32].map(n=><button key={n} type="button" onClick={()=>{if(window.confirm('Replace seeds and clear match scores?'))mutate({teams:Array.from({length:n},(_,i)=>({id:crypto.randomUUID(),name:'Team '+(i+1)})),scores:{}})}}>{n} teams</button>)}</div><Matches config={c} change={v=>set('scores',v)}/></fieldset>}
 {is('goal-tracker')&&<><label>Target<input required type="number" min="0.000001" step="any" value={c.target} onChange={e=>set('target',Number(e.target.value))}/></label><label>Current progress<input type="number" min="0" step="any" value={c.progress} onChange={e=>set('progress',Number(e.target.value))}/></label><label>Milestones, separated by commas<input defaultValue={c.milestones.join(', ')} onBlur={e=>set('milestones',e.target.value.trim()?e.target.value.split(',').map(Number):[])}/></label></>}
 {is('community-challenge-maker')&&<>{text('rules','Challenge rules',true)}{attachment('Leaderboard')}</>}
 {is('community-event-page-maker')&&<>{text('organizer','Organizer')}<fieldset><legend>Event Hub sections</legend>{c.order.map((v,i)=><div className="pj-row" key={v}><b>{v}</b><button type="button" aria-label={'Move '+v+' up'} disabled={!i} onClick={()=>reorder(c.order,i,i-1)}>↑</button><button type="button" aria-label={'Move '+v+' down'} disabled={i===c.order.length-1} onClick={()=>reorder(c.order,i,i+1)}>↓</button><button type="button" onClick={()=>set('order',c.order.filter(x=>x!==v))}>Remove</button></div>)}<label>Add a section<select value="" onChange={e=>{if(e.target.value)set('order',[...c.order,e.target.value as Config['order'][number]])}}><option value="">Choose section</option>{components.filter(k=>!c.order.includes(k)).map(k=><option key={k}>{k}</option>)}</select></label></fieldset>{(['Poll','Tournament','Leaderboard'] as const).filter(k=>c.order.includes(k)).map(k=><div key={k}>{attachment(k)}</div>)}{c.order.includes('Announcements')&&<label>Announcements · one per line<textarea value={c.announcements.join('\n')} onChange={e=>set('announcements',e.target.value?e.target.value.split('\n'):[])}/></label>}</>}
 {is('community-link-page-maker')&&text('logo','Logo HTTPS URL')}
 {(is('community-link-page-maker')||(is('community-event-page-maker')&&c.order.includes('Community links')))&&<fieldset><legend>Community links</legend>{c.links.map((l,i)=><div key={i} className="pj-links"><label>Label<input value={l.name} onChange={e=>set('links',c.links.map((v,j)=>i===j?{...v,name:e.target.value}:v))}/></label><label>HTTPS address<input type="url" value={l.url} onChange={e=>set('links',c.links.map((v,j)=>i===j?{...v,url:e.target.value}:v))}/></label><button type="button" onClick={()=>set('links',c.links.filter((_,j)=>j!==i))}>Remove link</button></div>)}<button type="button" disabled={c.links.length>=16} onClick={()=>set('links',[...c.links,{name:'Community',url:''}])}>Add link</button></fieldset>}
 <fieldset><legend>Appearance</legend><label>Theme<select value={c.theme} onChange={e=>set('theme',e.target.value as Config['theme'])}><option value="midnight">Midnight</option><option value="paper">Paper</option><option value="forest">Forest</option></select></label><label>Accent color<input type="color" value={c.accent} onChange={e=>set('accent',e.target.value)}/></label></fieldset>
 {published&&<label>Private management key <small>Optional when signed in as the owner. Keep this key separate from the public link.</small><input type="password" value={token} autoComplete="off" onChange={e=>setToken(e.target.value)} placeholder="Paste key for anonymous project"/></label>}
 {!published&&<Challenge key={challengeKey} action="project_create"/>}<button className="pj-primary" disabled={busy} type="submit">{busy?'Saving…':published?'Save changes':'Create share link'}</button></form>
 {published&&<section><Link href={'/s/'+published}>Open public page</Link><p>Organizer editor · <Link href={'/create?edit='+published}>Open management page</Link></p>{token&&<div className="project-actions"><button onClick={()=>navigator.clipboard.writeText(token).then(()=>setMessage('Private management key copied.')).catch(()=>setMessage('Select the management key field and copy its contents.'))}>Copy private management key</button><button disabled={busy} onClick={claim}>Claim with signed-in account</button></div>}<Sharing slug={published} title={c.title} kind={kind}/></section>}
 <p role="status" className="pj-message">{message}</p></div><aside className="project-preview"><p className="pj-type">Live preview</p><ProjectView initial={draftView(kind,c)}/></aside></div>
}

export function isProjectSlug(value:string){return slugPattern.test(value)}
