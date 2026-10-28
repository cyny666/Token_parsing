import { createServer } from '../token-inspector/node_modules/vite/dist/node/index.js';
import { chromium } from '../token-inspector/node_modules/playwright/index.mjs';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const token = Buffer.from('{"alg":"RS256"}').toString('base64url') + '.' +
  Buffer.from('{"iss":"https://sts.windows.net/11111111-1111-1111-1111-111111111111/","aud":"c44b4083-3bb0-49c1-b47d-974e53cbdf3c","exp":4102444800}').toString('base64url') + '.AA';
const server = await createServer({ root, configFile: false, server: { host: '127.0.0.1', port: 4187, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:4187');
  await page.locator('#token').fill(token);
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('已解码'));
  await page.locator('[data-part="payload"][data-view="claims"]').click();
  const aud = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^aud$/ }) });
  console.log('INPUT=' + token);
  console.log('AUD_VALUE=' + await aud.locator('code').textContent());
  console.log('AUD_MATCHES=' + JSON.stringify(await aud.locator('.value-match').allTextContents()));
  console.log('AUD_EXPLANATION=' + await aud.locator('td').nth(1).textContent());
  console.log('PAYLOAD_JSON_PRESERVED=' + (JSON.parse(await page.locator('#payload-json').textContent()).aud === 'c44b4083-3bb0-49c1-b47d-974e53cbdf3c'));
} finally {
  await browser?.close();
  await server.close();
}
