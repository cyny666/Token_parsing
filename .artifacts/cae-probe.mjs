import { createServer } from '../token-inspector/node_modules/vite/dist/node/index.js';
import { chromium } from '../token-inspector/node_modules/playwright/index.mjs';
import path from 'node:path';
const server = await createServer({ root: path.resolve(process.argv[2]), configFile: false, server: { host: '127.0.0.1', port: 4187, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('https://**/*', route => route.abort());
  await page.goto('http://127.0.0.1:4187');
  for (const [label, extra] of [['CP1', { xms_cc: ['cp1'] }], ['MISSING', {}], ['OTHER', { xms_cc: ['cp2'] }], ['STRING', { xms_cc: 'cp1' }]]) {
    await page.locator('#clear').click();
    const claims = { iss: 'https://login.microsoftonline.com/example/v2.0', ...extra };
    const token = `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.AA`;
    await page.locator('#token').fill(token);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('已解码'));
    const rows = await page.locator('#summary .summary-row').allTextContents();
    console.log(label + '_INPUT=' + token);
    console.log(label + '=' + (rows.find(x => x.startsWith('CAE')) || 'NO_CAE_ROW'));
  }
} finally { await browser?.close(); await server.close(); }
