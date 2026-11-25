import Link from 'next/link';
import { ArrowUpRight, CalendarDays, ChartNoAxesColumnIncreasing, ChevronDown, Clock3, Compass, Flag, Layers3, LayoutGrid, Link2, Plus, ScanLine, Search, Shapes, Sparkles, Trophy, Users, Vote, WandSparkles } from 'lucide-react';
import { BrandHubDemo, BrandNetwork } from '../components/BrandNetwork';
import { SponsoredPlacement } from '../components/billing/SponsoredPlacement';
import { brand } from '../lib/brand';
import type { Metadata } from 'next';

export const metadata:Metadata={title:brand.name+' — Free tools for connected communities',description:brand.description,alternates:{canonical:'/'}};
const cards=[
  {name:'Countdown Maker',description:'Give everyone a live clock for your next big moment.',slug:'countdown-maker',Icon:Clock3,type:'count'},
  {name:'Tournament Bracket Maker',description:'Seed teams, score matches and follow the winners.',slug:'tournament-bracket-maker',Icon:Trophy,type:'cup'},
  {name:'Poll Maker',description:'Let your community decide what happens next.',slug:'poll-maker',Icon:Vote,type:'vote'},
  {name:'Random Team Generator',description:'Split your player list into teams for game night.',slug:'random-team-generator',Icon:Users,type:'team'},
  {name:'Leaderboard Maker',description:'Track scores and share the standings.',slug:'leaderboard-maker',Icon:ChartNoAxesColumnIncreasing,type:'rank'},
  {name:'Discord Timestamp Generator',description:'Share event times in everyone’s local timezone.',slug:'discord-timestamp-generator',Icon:CalendarDays,type:'time'},
];
function CardPreview({type}:{type:string}){
  if(type==='count') return <div className="lk-card-clock">{['02','14','36'].map((v,i)=><span key={v}>{v}<small>{['DAYS','HRS','MIN'][i]}</small></span>)}</div>;
  if(type==='vote') return <div className="lk-card-poll"><i/><i/><i/></div>;
  if(type==='cup') return <svg className="lk-card-bracket" viewBox="0 0 152 65" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 7h30v12H5m30-6h20v15h19M5 37h30v12H5m30-6h20V28m19 0h28v9h24"/><rect x="126" y="31" width="12" height="12" rx="2"/></svg>;
  if(type==='team')return <div className="lk-card-team"><Users/><span>vs</span><Users/></div>;
  if(type==='rank')return <div className="lk-card-rank"><i>2</i><i>1</i><i>3</i></div>;
  return <div className="lk-card-stamp">&lt;t:1762538400:R&gt;</div>;
}
export default function Home(){
  return <div className="lk-home">
    <section className="lk-hero"><div className="lk-container lk-hero-grid"><div className="lk-intro"><div className="lk-overline"><span className="lk-overline-line"/>{brand.positioning.slice(0,-1)}</div><h1>Create together.<br/><em>Grow together.</em></h1><p>{brand.description}</p><div className="lk-hero-actions"><Link className="lk-button lk-button-main" href="/tools"><LayoutGrid size={17}/>Explore free tools</Link><Link className="lk-button lk-button-quiet" href="/create"><Plus size={17}/>Create an event</Link></div></div><BrandNetwork/></div></section>
    <section className="lk-tools-section"><div className="lk-container"><div className="lk-section-title"><div className="lk-title-cluster"><span className="lk-section-icon"><Shapes/></span><h2>Popular tools</h2></div><Link className="lk-text-link" href="/tools">All tools <ArrowUpRight size={16}/></Link></div>
    <form className="lk-search" action="/tools" role="search"><Search size={19}/><input aria-label="Search community tools" name="q" placeholder="Search for a tool…" type="search" maxLength={100}/><button type="submit">Search</button></form>
    <div className="lk-tool-grid">{cards.map(({name,description,slug,Icon,type})=><Link className={'lk-tool-card lk-tool-'+type} href={'/tools/'+slug} key={slug}><div className="lk-tool-tile"><span className="lk-tool-icon"><Icon size={18}/></span><span className="lk-tool-open" aria-hidden="true"><ArrowUpRight size={18}/></span><div className="lk-card-preview" aria-hidden="true"><CardPreview type={type}/></div></div><div className="lk-tool-copy"><h3>{name}</h3><p>{description}</p></div></Link>)}</div></div></section>
    <section className="lk-container lk-demo-grid"><div className="lk-section-copy"><div className="lk-overline"><Layers3 size={16}/>Event Hub</div><h2>One link.<br/>Your entire community event.</h2><p>Bring your countdown, poll, bracket and scores together. Share one page so everyone knows where to go and what’s next.</p><Link className="lk-button lk-button-main" href="/create"><Plus size={16}/>Create an event</Link></div><BrandHubDemo/></section>
    <section className="lk-section-muted"><div className="lk-container"><div className="lk-section-title"><h2>How LoopKit works</h2></div><div className="lk-steps">{[[WandSparkles,'Create','Choose a tool and add your event details.'],[Link2,'Share','Send a public link to your Discord, Telegram or group chat.'],[Flag,'Bring people together','Give participants one place to find event details and take part.']].map(([Icon,title,description])=>{const StepIcon=Icon as typeof Flag;return <article key={String(title)}><StepIcon size={21}/><h3>{String(title)}</h3><p>{String(description)}</p></article>})}</div><nav aria-label="Tool categories" className="lk-categories">{[['Event planning','community-event-page-maker'],['Games & tournaments','tournament-bracket-maker'],['Community identity','gaming-profile-card-maker'],['Images & stickers','telegram-sticker-resizer']].map(([name,slug])=><Link href={'/tools/'+slug} key={name}>{name}<ArrowUpRight size={13}/></Link>)}</nav></div></section>
    <section className="lk-container lk-community"><div className="lk-community-box"><Compass/><h2>Community discovery</h2><p>Explore approved Discord communities, Telegram channels and bots.</p><Link className="lk-text-link" href="/discover">Browse communities <ArrowUpRight size={16}/></Link></div><div className="lk-community-box lk-spot"><SponsoredPlacement slot="homepage"/></div></section>
    <section className="lk-container lk-faq"><div><div className="lk-overline"><ScanLine size={15}/>Help center</div><h2>Common questions</h2></div><div>{[['Do I need an account to use LoopKit?','Basic browser tools can be used without signing in. Hosted projects use separate management access so you can share a viewing link safely.'],['What can I put in an Event Hub?','An Event Hub brings event information, community links and interactive tools into one shareable page.'],['How do sponsored listings work?','Paid placements are labeled separately. Sponsorship does not affect a community’s organic popularity ranking.'],['What does Creator Pro add?','Creator Pro is designed for organizers who need premium themes, custom branding, higher limits and advanced analytics. See pricing for current availability.']].map(([q,a])=><details key={q}><summary>{q}<ChevronDown size={17}/></summary><p>{a}</p></details>)}<Link className="lk-text-link" href="/pricing">View Creator Pro features <ArrowUpRight size={16}/></Link></div></section>
    <section className="lk-final"><div className="lk-container"><Sparkles size={24}/><h2>Create your community’s next event.</h2><Link className="lk-button lk-button-main" href="/create">Get started <Plus size={16}/></Link></div></section>
  </div>;
}
