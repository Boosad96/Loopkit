"use client";
import { useEffect, useState } from "react";
import { zonedInstants } from "./algorithms";
import { Copy, downloadBlob } from "./common";
const formats:Record<string,Intl.DateTimeFormatOptions>={t:{timeStyle:"short"},T:{timeStyle:"medium"},d:{dateStyle:"short"},D:{dateStyle:"long"},f:{dateStyle:"long",timeStyle:"short"},F:{dateStyle:"full",timeStyle:"short"},s:{dateStyle:"short",timeStyle:"short"},S:{dateStyle:"short",timeStyle:"medium"}};
function relative(ms:number) {const sec=ms/1000;const units:[Intl.RelativeTimeFormatUnit,number][]=[["year",31536000],["month",2592000],["day",86400],["hour",3600],["minute",60],["second",1]];const [unit,n]=units.find(([,n])=>Math.abs(sec)>=n)||units[5];return new Intl.RelativeTimeFormat(undefined,{numeric:"auto"}).format(Math.round(sec/n),unit);}
export function Timestamp() {
  const [zone,setZone]=useState(()=>Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [zones]=useState(()=>[...new Set(["UTC",zone,...Intl.supportedValuesOf("timeZone")])]);
  const [value,setValue]=useState(()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
  const [later,setLater]=useState(false),[now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  const times=zonedInstants(value,zone), instant=times[later&&times.length>1?1:0];
  return <section><label>Event date and time<input type="datetime-local" value={value} onChange={e=>setValue(e.target.value)}/></label><label>Event time zone<select value={zone} onChange={e=>setZone(e.target.value)}>{zones.map(z=><option key={z}>{z}</option>)}</select></label>
  {times.length===2&&<label>Repeated clock time<select value={later?"later":"earlier"} onChange={e=>setLater(e.target.value==="later")}><option value="earlier">First occurrence</option><option value="later">Second occurrence</option></select></label>}
  {instant===undefined?<p role="status">Select a valid local time. A daylight-saving transition can skip a clock time.</p>:<><p>Unix timestamp <strong>{Math.floor(instant/1000)}</strong></p><p>Previews use your device’s time zone. Discord displays each timestamp in the reader’s local time.</p>{[...Object.keys(formats),"R"].map(style=>{const markdown="<t:"+Math.floor(instant/1000)+":"+style+">";return <div className="lk-result-row" key={style}><code>{markdown}</code><span>{style==="R"?relative(instant-now):new Intl.DateTimeFormat(undefined,formats[style]).format(instant)}</span><Copy value={markdown} label={"Copy "+style}/></div>;})}</>}
  <a href="https://docs.discord.com/developers/reference#message-formatting">Discord timestamp reference</a></section>;
}
const templates={
  Discord:["Post in the channel that matches your topic.","Ask before sending direct messages or tagging a role.","Report harassment to the moderation team privately."],
  Telegram:["Keep group messages relevant to the current topic.","Ask an admin before posting promotions or invite links.","Respect privacy. Get permission before forwarding personal messages."],
  Gaming:["Play fairly and follow the event rules.","Treat teammates and opponents with respect.","Send disputed match results to an organizer with the match details."]
};
export function Rules() {
  const [template,setTemplate]=useState<keyof typeof templates>("Discord"),[rules,setRules]=useState([...templates.Discord]),[title,setTitle]=useState("Community rules");
  const output=title.trim()+"\n\n"+rules.filter(s=>s.trim()).map((s,i)=>(i+1)+". "+s.trim()).join("\n");
  function move(index:number,delta:number){const next=[...rules];[next[index],next[index+delta]]=[next[index+delta],next[index]];setRules(next);}
  return <section><label>Title<input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Template<select value={template} onChange={e=>{const key=e.target.value as keyof typeof templates;setTemplate(key);setRules([...templates[key]]);}}>{Object.keys(templates).map(t=><option key={t}>{t}</option>)}</select></label><small>Choosing a template replaces the current rules.</small>
  {rules.map((r,i)=><div key={i}><label>Rule {i+1}<textarea maxLength={500} rows={2} value={r} onChange={e=>setRules(rules.map((s,j)=>j===i?e.target.value:s))}/></label><button disabled={!i} onClick={()=>move(i,-1)}>Move up</button> <button disabled={i===rules.length-1} onClick={()=>move(i,1)}>Move down</button> <button onClick={()=>setRules(rules.filter((_,j)=>j!==i))}>Remove rule {i+1}</button></div>)}
  <button disabled={rules.length>=30} onClick={()=>setRules([...rules,""])}>Add rule</button><pre>{output}</pre><Copy value={output} label="Copy rules"/> <button onClick={()=>downloadBlob(new Blob([output],{type:"text/plain"}),"community-rules.txt")}>Export TXT</button></section>;
}

