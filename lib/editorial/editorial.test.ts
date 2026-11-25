import { afterEach, describe, expect, it, vi } from 'vitest'
import { guides, releaseCandidates } from './guides'
import { tools } from '../tools'
import { adSettings } from './ads'

const { readSetting } = vi.hoisted(() => ({readSetting:vi.fn()}))
vi.mock('../account/server',()=>({
  serviceClient:() => ({from:()=>({select:()=>({eq:()=>({maybeSingle:readSetting})})})}),
}))

afterEach(()=>{vi.unstubAllEnvs(); readSetting.mockReset()})

describe('editorial release',()=>{
  it('keeps all ten drafts private by default',()=>{
    vi.stubEnv('EDITORIAL_PUBLISHED_SLUGS','')
    expect(guides).toHaveLength(10)
    expect(releaseCandidates()).toEqual([])
  })
  it('exposes only explicitly approved slugs with working canonical tool destinations',()=>{
    vi.stubEnv('EDITORIAL_PUBLISHED_SLUGS',' discord-timestamps ,other')
    expect(releaseCandidates().map(guide=>guide.slug)).toEqual(['discord-timestamps'])
    for(const guide of guides) expect(tools.some(tool=>tool.slug===guide.tool)).toBe(true)
  })
})

describe('advertising eligibility',()=>{
  function configure() {
    vi.stubEnv('ADSENSE_ENABLED','true')
    vi.stubEnv('ADSENSE_APPROVED','true')
    vi.stubEnv('ADSENSE_PUBLISHER_ID','pub-1234567890123456')
    vi.stubEnv('ADSENSE_GUIDE_SLOT','1234567890')
  }
  it('stays disabled without deployment approval and avoids a database call',async()=>{
    configure()
    vi.stubEnv('ADSENSE_APPROVED','false')
    expect(await adSettings()).toBeNull()
    expect(readSetting).not.toHaveBeenCalled()
  })
  it('requires explicit admin approval even with valid configuration',async()=>{
    configure()
    readSetting.mockResolvedValue({data:{value:false}})
    expect(await adSettings()).toBeNull()
    readSetting.mockResolvedValue({data:{value:true}})
    expect(await adSettings()).toEqual({publisher:'pub-1234567890123456',slot:'1234567890'})
  })
  it('fails closed on a network or credential error',async()=>{
    configure()
    readSetting.mockRejectedValue(new Error('unavailable'))
    expect(await adSettings()).toBeNull()
  })
})
