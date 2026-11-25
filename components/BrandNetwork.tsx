'use client';

import Image from 'next/image';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { brand } from '../lib/brand';
import { useEffect, useRef, useState } from 'react';
import { Activity, ChartNoAxesColumnIncreasing, Check, Clock3, Flag, Link2, Radio, Shield, Trophy, Users, Vote } from 'lucide-react';

function useInView(){
  const ref=useRef<HTMLDivElement>(null);const [visible,setVisible]=useState(false);
  useEffect(()=>{const node=ref.current;if(!node)return;
    if(!('IntersectionObserver' in window))return;
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));observer.observe(node);return ()=>observer.disconnect();
  },[]);
  return {ref,visible};
}
export function BrandNetwork(){
  const {ref,visible}=useInView();
  return <div ref={ref} className="lk-network" data-active={visible} role="img" aria-label="An Event Hub connects a countdown, poll, tournament, leaderboard and community links">
    <div className="lk-network-plane">
      <svg className="lk-orbit-art" viewBox="0 0 540 410" aria-hidden="true">
        <defs><radialGradient id="lk-nebula"><stop stopColor="#81b43e" stopOpacity=".24"/><stop offset="1" stopColor="#81b43e" stopOpacity="0"/></radialGradient><pattern id="lk-dots" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".9" fill="#8aab74" opacity=".48"/></pattern><mask id="lk-fade"><ellipse cx="270" cy="209" rx="262" ry="191" fill="white"/></mask></defs>
        <ellipse cx="266" cy="210" rx="255" ry="190" fill="url(#lk-nebula)"/><rect width="540" height="410" fill="url(#lk-dots)" mask="url(#lk-fade)" opacity=".65"/>
        <g transform="translate(267 211) rotate(-26)" fill="none" stroke="currentColor"><ellipse rx="245" ry="105"/><ellipse rx="208" ry="85" strokeDasharray="2 7"/><ellipse rx="175" ry="151" strokeOpacity=".5"/><ellipse rx="82" ry="177" strokeOpacity=".74"/></g>
        <g className="lk-connect" fill="none" stroke="#91bd50" strokeWidth="1.2" strokeDasharray="3 8"><path d="M98 105 266 214l132-139M72 268l194-54 156 79M266 214l-31 126"/></g>
        <g fill="#adf253"><circle cx="150" cy="144" r="3"/><circle cx="354" cy="121" r="3"/><circle cx="370" cy="268" r="3"/><circle cx="244" cy="301" r="2.4"/><circle cx="167" cy="240" r="2.5"/></g>
      </svg>
      <div className="lk-node lk-node-poll"><div className="lk-node-label"><Vote/>Poll</div><div className="lk-mini-bars"><i/><i/><i/></div></div>
      <div className="lk-node lk-node-time"><div className="lk-node-label"><Clock3/>Countdown</div><span className="lk-mini-time">02<span>:</span>14<span>:</span>36</span></div>
      <div className="lk-node lk-node-hub"><div className="lk-hub-logo"><Image unoptimized src={brand.logo} alt="" width="33" height="33"/></div><b>Event Hub</b><span className="lk-hub-socket"/></div>
      <div className="lk-node lk-node-bracket"><div className="lk-node-label"><Trophy/>Tournament</div><svg viewBox="0 0 85 25" width="70" height="22" fill="none" stroke="#b09beb" aria-hidden="true"><path d="M2 4h20v8H2m20-5h13v10h12M2 18h20v7H2m20-4h13m12-5h20"/><circle cx="74" cy="16" r="4"/></svg></div>
      <div className="lk-node lk-node-board"><div className="lk-node-label"><ChartNoAxesColumnIncreasing/>Leaderboard</div><div className="lk-podium"><i/><i/><i/></div></div>
      <div className="lk-satellite lk-sat-links"><Link2 size={15}/></div><div className="lk-satellite lk-sat-people"><Users size={15}/></div>
    </div>
  </div>;
}
const demos=['Overview','Poll','Leaderboard'] as const;
const demoVotes = [{name:'Neon Harbor',votes:3}, {name:'Dust Valley',votes:3}] as const;

function DemoPoll({choice,onVote}:{choice:string|null;onVote:(value:string)=>void}){
  const reduced=useReducedMotion();
  return <div className="lk-demo-vote">
    <b>Which map should we play?</b>
    <div>{demoVotes.map(option=>{
      const selected=choice===option.name;
      const share=Math.round((option.votes+Number(selected))*100/(6+Number(Boolean(choice))));
      return <button key={option.name} aria-pressed={selected} onClick={()=>onVote(option.name)}>
        {choice&&<m.span className="lk-vote-fill" aria-hidden="true"
          initial={{scaleX:0}} animate={{scaleX:share/100}}
          transition={{duration:reduced?0:.2}}/>}
        <span>{option.name}{choice?' · '+share+'%':''}</span>{selected&&<Check size={13}/>}
      </button>;
    })}</div>
  </div>;
}
export function BrandHubDemo(){
  const [tab,setTab]=useState<typeof demos[number]>('Overview');const [rsvp,setRsvp]=useState(false);const [vote,setVote]=useState<string|null>(null);
  return <LazyMotion features={domAnimation}><div className="lk-demo"><div className="lk-demo-top"><span><Radio size={14}/> Event Hub</span><small>Demo data</small></div><div className="lk-demo-content"><div className="lk-demo-title"><div className="lk-demo-symbol"><Flag size={22}/></div><div><h3>Friday Night Arena</h3><span>Community game night</span></div></div>
    <div className="lk-demo-tabs" aria-label="Preview sections">{demos.map(t=><button key={t} aria-pressed={t===tab} onClick={()=>setTab(t)}>{t}</button>)}</div>
    {tab==='Overview'?<div className="lk-demo-panel"><div><span className="lk-demo-kicker"><Users size={15}/>Guest list</span><p>{rsvp?'You’re on the list.':'Join the next game night.'}</p></div><button className="lk-button lk-button-soft" aria-pressed={rsvp} onClick={()=>setRsvp(!rsvp)}>{rsvp?<><Check size={15}/>Going</>:'RSVP'}</button></div>:tab==='Poll'?<DemoPoll choice={vote} onVote={setVote}/>:<ol className="lk-demo-ranking">{[['Orbit Five',24],['Echo Squad',18],['Northstar',12]].map(([name,score])=><li key={name}><Shield size={13}/><span>{name}</span><b>{score} pts</b></li>)}</ol>}
    </div><div className="lk-demo-foot"><Activity size={12}/> Interactive preview</div></div></LazyMotion>;
}
