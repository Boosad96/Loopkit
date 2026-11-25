import { ImageResponse } from 'next/og';
import { brand } from '../lib/brand';

export const alt = brand.name + ' — ' + brand.positioning;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';

export default function ShareImage() {
  return new ImageResponse(
    <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', width:'100%', height:'100%', padding:70, background:'#0c1017', color:'#f8fafc', fontFamily:'sans-serif' }}>
      <div style={{ display:'flex', color:brand.accent, fontSize:44, fontWeight:700 }}>{brand.name}</div>
      <div style={{ display:'flex', flexDirection:'column', fontSize:92, fontWeight:700, letterSpacing:-5, lineHeight:1.05 }}>
        <span>Create together.</span>
        <span style={{ color:brand.accent }}>Grow together.</span>
      </div>
      <div style={{ display:'flex', fontSize:30, color:'#a0aabc' }}>{brand.positioning}</div>
    </div>,size
  );
}
