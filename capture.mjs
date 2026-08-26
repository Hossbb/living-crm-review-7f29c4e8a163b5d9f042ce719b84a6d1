import { chromium } from 'playwright';
import fs from 'node:fs';

const reviewUrl = 'https://hossbb.github.io/living-crm-review-7f29c4e8a163b5d9f042ce719b84a6d1/';
const appUrl = 'https://script.google.com/macros/s/AKfycbyAbfQz8QH8nj8tFzmitHnO3I5Kb1QowZDIa47v1UwsrModv2CZXqvTd_UJx97faXiNXg/exec?lab=1';
fs.mkdirSync('review', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const logs = [];
page.on('console', msg => logs.push(`[console:${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));
page.on('requestfailed', req => logs.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText || ''}`));

await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(12000);

await page.screenshot({ path: 'review/latest.png', fullPage: true });
await page.pdf({
  path: 'review/latest.pdf',
  width: '1440px',
  height: '1000px',
  printBackground: true,
  margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
});

const frames = page.frames();
const candidates = [];
for (const frame of frames) {
  let text = '';
  let html = '';
  try { text = await frame.locator('body').innerText(); } catch {}
  try { html = await frame.content(); } catch {}
  candidates.push({ text, html, url: frame.url() });
}

const appCandidate =
  candidates.find(item => /SDR Design Lab|Next-Best-Action|Power Dialer|Kanban|Living CRM|Ava Carter/i.test(item.text)) ||
  candidates.sort((a, b) => b.text.length - a.text.length)[0] ||
  null;

const appText = appCandidate?.text || '';
const appHtml = appCandidate?.html || '';
const renderedUrl = page.url();

fs.writeFileSync('review/latest.txt', appText, 'utf8');
fs.writeFileSync('review/latest-app.html', appHtml, 'utf8');
fs.writeFileSync('review/console.txt', logs.join('\n'), 'utf8');
fs.writeFileSync('review/meta.json', JSON.stringify({
  capturedAt: new Date().toISOString(),
  reviewUrl,
  appUrl,
  renderedUrl,
  frameCount: frames.length,
  matchedLivingCrm: /SDR Design Lab|Next-Best-Action|Power Dialer|Kanban|Living CRM|Ava Carter/i.test(appText)
}, null, 2), 'utf8');

await browser.close();

// Review capture version 10 — verify SDR design lab route.
