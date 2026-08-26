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

const frames = page.frames();
let labFrame = null;
for (const frame of frames) {
  try {
    const text = await frame.locator('body').innerText();
    if (/SDR Design Lab/i.test(text)) {
      labFrame = frame;
      break;
    }
  } catch {}
}

const modelChecks = [];
if (labFrame) {
  for (let i = 1; i <= 10; i++) {
    const button = labFrame.locator(`[data-model="${i}"]`);
    if (await button.count()) {
      await button.click();
      await labFrame.waitForTimeout(250);
      const title = await labFrame.locator('#model-title').innerText().catch(() => '');
      const prototypeText = await labFrame.locator('#prototype-root').innerText().catch(() => '');
      modelChecks.push({
        id: i,
        title,
        rendered: prototypeText.trim().length > 20,
        preview: prototypeText.trim().slice(0, 180)
      });
    } else {
      modelChecks.push({ id: i, title: '', rendered: false, preview: 'model button missing' });
    }
  }
  await labFrame.locator('[data-model="1"]').click().catch(() => {});
  await labFrame.waitForTimeout(200);
}

await page.screenshot({ path: 'review/latest.png', fullPage: true });
await page.pdf({
  path: 'review/latest.pdf',
  width: '1440px',
  height: '1000px',
  printBackground: true,
  margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
});

const candidates = [];
for (const frame of page.frames()) {
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
fs.writeFileSync('review/lab-check.json', JSON.stringify({
  allModelsPassed: modelChecks.length === 10 && modelChecks.every(x => x.rendered && x.title),
  models: modelChecks
}, null, 2), 'utf8');
fs.writeFileSync('review/meta.json', JSON.stringify({
  capturedAt: new Date().toISOString(),
  reviewUrl,
  appUrl,
  renderedUrl,
  frameCount: page.frames().length,
  matchedLivingCrm: /SDR Design Lab|Next-Best-Action|Power Dialer|Kanban|Living CRM|Ava Carter/i.test(appText)
}, null, 2), 'utf8');

await browser.close();

// Review capture version 11 — test all 10 SDR design lab models.
