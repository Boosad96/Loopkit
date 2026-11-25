'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, Check, Menu, Monitor, Moon, Sun, X } from 'lucide-react';
import { brand } from '../lib/brand';

const destinations = [['Tools','/tools'],['Discover','/discover'],['Create','/create'],['Pricing','/pricing']] as const;
export function BrandLogo() {
  return <Link prefetch={false} href="/" className="lk-logo" aria-label={brand.name + ' home'}><Image unoptimized src={brand.logo} width="34" height="34" alt=""/>{brand.name}</Link>;
}
type Theme = 'system'|'dark'|'light';
function applyTheme(theme:Theme) {
  document.documentElement.dataset.theme = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light':'dark') : theme;
}
function readTheme(): Theme {
  try {
    const saved = localStorage.getItem('loopkit-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* Restricted storage uses system theme. */ }
  return 'system';
}
function subscribeTheme(notify:()=>void) {
  window.addEventListener('storage',notify);
  window.addEventListener('loopkit-theme-change',notify);
  return ()=>{window.removeEventListener('storage',notify);window.removeEventListener('loopkit-theme-change',notify)};
}
function ThemePicker(){
  const theme=useSyncExternalStore(subscribeTheme,readTheme,()=>'system' as const);
  const [open,setOpen]=useState(false);
  const box=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    applyTheme(theme);
    const media=window.matchMedia('(prefers-color-scheme: light)');
    const update=()=>{if(theme==='system')applyTheme(theme)};
    media.addEventListener('change',update);return ()=>media.removeEventListener('change',update);
  },[theme]);
  useEffect(()=>{
    if(!open)return;
    function close(e:PointerEvent){if(!box.current?.contains(e.target as Node))setOpen(false)}
    function escape(e:KeyboardEvent){if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}}
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)};
  },[open]);
  const Icon=theme==='system'?Monitor:theme==='light'?Sun:Moon;
  return <div ref={box} className="lk-theme"><button ref={trigger} className="lk-icon-button" aria-label="Select color theme" aria-expanded={open} onClick={()=>setOpen(!open)}><Icon size={17}/></button>{open&&<div className="lk-theme-list" aria-label="Color theme">{(['system','dark','light'] as const).map(item=><button key={item} aria-pressed={theme===item} onClick={()=>{try{localStorage.setItem('loopkit-theme',item)}catch{}applyTheme(item);window.dispatchEvent(new Event('loopkit-theme-change'));setOpen(false);trigger.current?.focus()}}>{item[0].toUpperCase()+item.slice(1)}{theme===item&&<Check size={14}/>}</button>)}</div>}</div>;
}
export function BrandHeader(){
  const [open,setOpen]=useState(false);
  const button=useRef<HTMLButtonElement>(null);
  return <header className="lk-header" onKeyDown={e=>{if(open&&e.key==='Escape'){setOpen(false);button.current?.focus()}}}><div className="lk-nav-wrap"><BrandLogo/><nav aria-label="Main" className="lk-desktop-nav">{destinations.map(([label,url])=><Link prefetch={false} key={url} href={url}>{label}</Link>)}</nav><div className="lk-nav-actions"><ThemePicker/><Link prefetch={false} className="lk-login" href="/login">Sign in</Link><Link prefetch={false} className="lk-button lk-button-main lk-header-start" href="/create">Get started</Link><button ref={button} className="lk-icon-button lk-menu" aria-label={open?'Close navigation':'Open navigation'} aria-controls="lk-mobile-menu" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X size={20}/>:<Menu size={20}/>}</button></div></div>{open&&<nav id="lk-mobile-menu" aria-label="Mobile" className="lk-mobile-nav">{[...destinations,['Sign in','/login']].map(([label,url])=><Link prefetch={false} key={url} href={url} onClick={()=>setOpen(false)}>{label}<ArrowUpRight size={15}/></Link>)}</nav>}</header>;
}
export function BrandFooter(){
  return <footer className="lk-footer"><div className="lk-container lk-footer-inner"><div><BrandLogo/><p>{brand.positioning}</p></div><nav aria-label="Footer">{[['Tools','/tools'],['Community','/discover'],['About','/about'],['Contact','/contact'],['Privacy','/privacy'],['Terms','/terms']].map(([name,url])=><Link prefetch={false} href={url} key={url}>{name}</Link>)}</nav></div></footer>;
}
