import { defineConfig } from '@playwright/test'
const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL||'http://127.0.0.1:3000')
if(origin.hostname!=='127.0.0.1')throw Error('A disposable loopback server is required.')
export default defineConfig({
 timeout:90000,testDir:'.',testMatch:'*.spec.ts',workers:1,
 use:{baseURL:origin.href,colorScheme:'dark',reducedMotion:'reduce',launchOptions:{executablePath:process.env.CHROMIUM_PATH}},
 webServer:{command:(process.env.INTEGRATION_DEV==='1'?'npm run dev -- --webpack':'npm run start --')+' --hostname 127.0.0.1 --port '+origin.port,cwd:process.cwd(),url:origin.href,timeout:120000}
})
