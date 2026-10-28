import { createServer } from '../token-inspector/node_modules/vite/dist/node/index.js';
import { chromium } from '../token-inspector/node_modules/playwright/index.mjs';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const token = Buffer.from('{"alg":"RS256"}').toString('base64url') + '.' +
  Buffer.from('{"sub":"synthetic-purpose-probe","exp":1}').toString('base64url') + '.AA';
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
  const tabs = await page.getByRole('tab').count();
  console.log('INPUT=' + token);
  console.log('TABS=' + tabs);
  console.log('INITIAL_STATUS=' + await page.locator('#status').textContent());
  console.log('INITIAL_PAYLOAD_VISIBLE=' + await page.locator('#payload-json').isVisible());
  if (tabs) {
    await page.getByRole('tab', { name: 'Refresh Token', exact: true }).click();
    console.log('SWITCH_CLEARED=' + (await page.locator('#token').inputValue() === ''));
    await page.locator('#token').fill(token);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('格式：JWT'));
    console.log('REFRESH_STATUS=' + await page.locator('#status').textContent());
    console.log('REFRESH_PAYLOAD_VISIBLE=' + await page.locator('#payload-json').isVisible());
    console.log('REFRESH_SIGNATURE_VISIBLE=' + await page.locator('#signature-status').isVisible());
  } else {
    console.log('REFRESH_ENTRY=absent');
  }
} finally {
  await browser?.close();
  await server.close();
}
