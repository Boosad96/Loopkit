import { z } from 'zod'
import { Temporal } from '@js-temporal/polyfill'

export const kinds = ['countdown-maker', 'poll-maker', 'tournament-bracket-maker', 'leaderboard-maker', 'community-event-page-maker', 'goal-tracker', 'community-challenge-maker', 'community-link-page-maker'] as const
export type Kind = typeof kinds[number]
export const labels: Record<Kind, string> = {
  'countdown-maker': 'Countdown', 'poll-maker': 'Poll', 'tournament-bracket-maker': 'Tournament bracket',
  'leaderboard-maker': 'Leaderboard', 'community-event-page-maker': 'Event Hub', 'goal-tracker': 'Goal tracker',
  'community-challenge-maker': 'Community challenge', 'community-link-page-maker': 'Community link page',
}
const id = z.string().uuid()
const label = z.string().trim().min(1).max(100)
const short = z.string().trim().max(240)
const numeric = z.number().finite().min(-1000000000).max(1000000000)
const absoluteTime = z.string().datetime()
export const slugPattern = /^[a-f0-9]{24}$/
export const components = ['Event information', 'Countdown', 'RSVP', 'Poll', 'Tournament', 'Leaderboard', 'Announcements', 'Community links'] as const
export function safeUrl(raw: string) {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password && !/[\u0000-\u0020]/.test(raw)
  } catch { return false }
}
export const configSchema = z.object({
  title: label,
  description: z.string().trim().max(2000),
  theme: z.enum(['midnight', 'paper', 'forest']), accent: z.string().regex(/^#[a-f\d]{6}$/i),
  ends: absoluteTime, timezone: z.string().max(80).refine(zone => {try {new Intl.DateTimeFormat('en', {timeZone: zone}); return true} catch {return false}}),
  completion: short, multiple: z.boolean(), hideResults: z.boolean(),
  options: z.array(z.object({id, name:label})).min(2).max(10),
  entries: z.array(z.object({id, name:label, score:numeric})).min(1).max(200),
  tie: z.enum(['competition','dense','ordinal']),
  teams: z.array(z.object({id, name:label})).min(2).max(32),
  scores: z.record(z.string().regex(/^\d{1,2}:\d{1,2}$/), z.tuple([z.number().int().min(0).max(999), z.number().int().min(0).max(999)])),
  target: numeric.positive(), progress: numeric.nonnegative(), milestones: z.array(numeric.positive()).max(20),
  organizer: short, rules: z.string().max(2000), logo: z.string().max(1600).refine(s => !s || safeUrl(s)),
  links: z.array(z.object({name:label, url:z.string().max(1600).refine(safeUrl, 'Enter an HTTPS URL')})).max(16),
  announcements: z.array(short.min(1)).max(16),
  order: z.array(z.enum(components)).max(8),
  attachments: z.object({Poll:z.string().regex(slugPattern).or(z.literal('')),Tournament:z.string().regex(slugPattern).or(z.literal('')),Leaderboard:z.string().regex(slugPattern).or(z.literal(''))}),
}).strict().superRefine((v, c) => {
  const unique = (xs:string[]) => new Set(xs).size === xs.length
  for (const key of ['options','entries','teams'] as const) {
    if (!unique(v[key].map(row => row.id))) c.addIssue({code:'custom', path:[key], message:'Each row needs its own identifier'})
  }
  if (!unique(v.options.map(o=>o.name.toLowerCase()))) c.addIssue({code:'custom',path:['options'],message:'Give each poll option a different name'})
  if (!unique(v.order)) c.addIssue({code:'custom',path:['order'],message:'Include each event section once'})
  if (!unique(Object.keys(v.scores)) || Object.keys(v.scores).length > 31) c.addIssue({code:'custom',path:['scores'],message:'Too many matches'})
})
export type Config = z.infer<typeof configSchema>
export function initialConfig(kind:Kind): Config {
  const row = (name:string) => ({ id:crypto.randomUUID(), name })
  return {title:'Untitled '+labels[kind], description:'', theme:'midnight', accent:'#a3e635', ends:new Date(Date.now()+86400000).toISOString(), timezone:'UTC', completion:'The event has started.', multiple:false, hideResults:false,
    options:[row('Option A'),row('Option B')], entries:[{...row('Player 1'),score:0}], tie:'competition',teams:['Team 1','Team 2','Team 3','Team 4'].map(row), scores:{},
    target:100,progress:0,milestones:[],organizer:'',rules:'',logo:'',links:[],announcements:[],order:['Event information','Countdown','RSVP'],attachments:{Poll:'',Tournament:'',Leaderboard:''}}
}
export function localTime(instant:string, zone:string) {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toPlainDateTime().toString({smallestUnit:'minute'})
}
export function resolveTime(wall:string, zone:string) {
  return Temporal.PlainDateTime.from(wall).toZonedDateTime(zone,{disambiguation:'reject'}).toInstant().toString({smallestUnit:'millisecond'})
}
export function standings(config:Config) {
  const sorted=[...config.entries].sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  let rank=0
  return sorted.map((e,i)=>{
    if(i===0 || sorted[i-1].score!==e.score) rank=config.tie==='dense'?rank+1:i+1
    return {...e,rank:config.tie==='ordinal'?i+1:rank}
  })
}
type Team = Config['teams'][number]
export type Match = { key:string, a:Team|null, b:Team|null, bye:boolean, winner:Team|null, score?:[number,number] }
export function rounds(c: Pick<Config,'teams'|'scores'>): Match[][] {
  const size=Math.max(4,2**Math.ceil(Math.log2(c.teams.length)))
  let seeds=[1,2]
  while(seeds.length<size) seeds=seeds.flatMap(seed=>[seed,seeds.length*2+1-seed])
  const history:Match[][]=[]
  for(let count=size/2,level=0;count>=1;count/=2,level++) {
    const matches:Match[]=[]
    for(let i=0;i<count;i++){
      const prev=history[level-1]
      const a=level?prev[i*2].winner:c.teams[seeds[i*2]-1]??null
      const b=level?prev[i*2+1].winner:c.teams[seeds[i*2+1]-1]??null
      const bye=level===0 && (!a || !b)
      const key=level+':'+i
      const score=c.scores[key]
      const winner=bye?a??b:(a && b && score && score[0]!==score[1]?score[0]>score[1]?a:b:null)
      matches.push({key,a,b,bye,score,winner})
    }
    history.push(matches)
  }
  return history
}
export function recordScore(c:Config, level:number, index:number, score:[number,number]) {
  const scores={...c.scores}
  scores[level+':'+index]=score
  let parent=index
  for(let r=level+1;r<rounds(c).length;r++){ parent=Math.floor(parent/2); delete scores[r+':'+parent] }
  return scores
}
export function shuffle<T>(list:T[]) {
  const copy=[...list], pool=new Uint32Array(1)
  for(let i=copy.length-1;i>0;i--){const n=i+1,limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(pool)}while(pool[0]>=limit); const j=pool[0]%n; [copy[i],copy[j]]=[copy[j],copy[i]]}
  return copy
}
export type View = {slug:string;kind:Kind;config:Config;revision:number;updatedAt:string;counts:Record<string,number>;votes:number;joined:number;finished:number;voted:boolean;participating:boolean;completed:boolean}
