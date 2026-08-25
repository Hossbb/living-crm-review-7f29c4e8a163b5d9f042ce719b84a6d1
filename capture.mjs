import { chromium } from 'playwright';
import fs from 'node:fs';

const reviewUrl = 'https://hossbb.github.io/living-crm-review-7f29c4e8a163b5d9f042ce719b84a6d1/';
fs.mkdirSync('review', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const logs = [];
page.on('console', msg => logs.push(`[console:${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));
page.on('requestfailed', req => logs.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText || ''}`));

await page.goto(reviewUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);

await page.screenshot({ path: 'review/latest.png', fullPage: true });
await page.pdf({
  path: 'review/latest.pdf',
  width: '1440px',
  height: '1000px',
  printBackground: true,
  margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
});

const frames = page.frames();
const appFrame = frames.find(frame => frame !== page.mainFrame() && frame.url() !== 'about:blank');

let appText = '';
let appHtml = '';
let appUrl = '';
if (appFrame) {
  appUrl = appFrame.url();
  try { appText = await appFrame.locator('body').innerText(); } catch {}
  try { appHtml = await appFrame.content(); } catch {}
}

fs.writeFileSync('review/latest.txt', appText, 'utf8');
fs.writeFileSync('review/latest-app.html', appHtml, 'utf8');
fs.writeFileSync('review/console.txt', logs.join('\n'), 'utf8');
fs.writeFileSync('review/meta.json', JSON.stringify({
  capturedAt: new Date().toISOString(),
  reviewUrl,
  appUrl,
  frameCount: frames.length
}, null, 2), 'utf8');

await browser.close();

// Review capture version 3 — refresh after Living CRM deployment @4.
