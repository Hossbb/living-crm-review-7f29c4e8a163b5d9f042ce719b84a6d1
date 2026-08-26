import { chromium } from 'playwright';
import fs from 'node:fs';

const reviewUrl = 'https://hossbb.github.io/living-crm-review-7f29c4e8a163b5d9f042ce719b84a6d1/';
const appUrl = 'https://hossbb.github.io/living-crm-review-7f29c4e8a163b5d9f042ce719b84a6d1/lab.html';
fs.mkdirSync('review', { recursive: true });

const browser = await chromium.launch({ headless: true });
const logs = [];

async function testViewport(name, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('console', msg => logs.push(`[${name} console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[${name} pageerror] ${err.message}`));
  page.on('requestfailed', req => logs.push(`[${name} requestfailed] ${req.url()} :: ${req.failure()?.errorText || ''}`));

  await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 60000 });
  const checks = [];
  for (let i = 0; i < 10; i++) {
    const button = page.locator(`[data-model="${i}"]`);
    if (await button.count()) {
      await button.click();
      await page.waitForTimeout(120);
      const title = await page.locator('#title').innerText().catch(() => '');
      const prototypeText = await page.locator('#stage').innerText().catch(() => '');
      checks.push({id:i+1,title,rendered:prototypeText.trim().length>20,preview:prototypeText.trim().slice(0,160)});
    } else checks.push({id:i+1,title:'',rendered:false,preview:'model button missing'});
  }
  await page.locator('[data-model="0"]').click().catch(() => {});
  await page.waitForTimeout(100);
  await page.screenshot({ path: `review/lab-${name}.png`, fullPage: true });
  const text = await page.locator('body').innerText();
  const html = await page.content();
  const renderedUrl = page.url();
  await page.close();
  return {name,viewport,renderedUrl,matched:/SDR Design Lab|Next-Best-Action|Ava Carter/i.test(text),allModelsPassed:checks.length===10&&checks.every(x=>x.rendered&&x.title),checks,text,html};
}

const desktop = await testViewport('desktop', { width: 1440, height: 1000 });
const mobile = await testViewport('mobile', { width: 390, height: 844 });

fs.writeFileSync('review/latest.txt', desktop.text, 'utf8');
fs.writeFileSync('review/latest-app.html', desktop.html, 'utf8');
fs.writeFileSync('review/console.txt', logs.join('\n'), 'utf8');
fs.writeFileSync('review/lab-check.json', JSON.stringify({
  allModelsPassed: desktop.allModelsPassed && mobile.allModelsPassed,
  desktop: { matched: desktop.matched, renderedUrl: desktop.renderedUrl, models: desktop.checks },
  mobile: { matched: mobile.matched, renderedUrl: mobile.renderedUrl, models: mobile.checks }
}, null, 2), 'utf8');
fs.writeFileSync('review/meta.json', JSON.stringify({capturedAt:new Date().toISOString(),reviewUrl,appUrl,desktopUrl:desktop.renderedUrl,mobileUrl:mobile.renderedUrl}, null, 2), 'utf8');

await browser.close();

// Review capture version 12 — standalone GitHub Pages lab, desktop + mobile.
