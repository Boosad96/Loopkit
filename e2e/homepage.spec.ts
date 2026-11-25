import { expect, test } from '@playwright/test';

for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
  test('Homepage fits viewport at ' + width + 'px',async ({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await expect(page.getByRole('heading',{level:1})).toHaveText('Create together.Grow together.');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const [device,width,height] of [['desktop',1440,960],['mobile',390,844]] as const) {
  for (const theme of ['dark','light'] as const) {
    test('Homepage screenshot, '+device+' '+theme,async ({page})=>{
      await page.setViewportSize({width,height});
      await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:'qa/home-'+device+'-'+theme+'.png',fullPage:true,animations:'disabled'});
    });
  }
}

test('Mobile navigation supports keyboard close and directory search',async ({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.goto('/');
  const toggle=page.getByRole('button',{name:'Open navigation'});
  await toggle.click();
  const menu=page.getByRole('navigation',{name:'Mobile'});
  await expect(menu.getByRole('link',{name:'Discover'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await page.getByRole('searchbox').fill('timestamp');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByRole('link',{name:/Discord Timestamp Generator/}).first()).toBeVisible();
});

test('Event Hub demo tabs and reduced-motion fallback',async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByRole('button',{name:'RSVP',exact:true}).click();
  await expect(page.getByRole('button',{name:'Going'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Poll',exact:true}).click();
  await page.getByRole('button',{name:'Dust Valley'}).click();
  await expect(page.getByRole('button',{name:/Dust Valley/})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
  await expect(page.getByText('Orbit Five')).toBeVisible();
  const seconds=await page.locator('.lk-connect').evaluate(e=>parseFloat(getComputedStyle(e).animationDuration));
  expect(seconds).toBeLessThan(.001);
});

test('Theme selection persists across reloads',async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Select color theme'}).click();
  await page.getByRole('button',{name:'Light',exact:true}).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
