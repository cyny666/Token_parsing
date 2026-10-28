import { createServer } from '../token-inspector/node_modules/vite/dist/node/index.js';
import { chromium } from '../token-inspector/node_modules/playwright/index.mjs';
import path from 'node:path';

const descriptor = Buffer.from('010100a4c5e81c2d78ef4bb3a56e7e51a795f983404bc4b03bc149b47d974e53cbdf3c0000000000', 'hex');
const token = `1.${descriptor.toString('base64url')}.${Buffer.from('SYNTHETIC_OPAQUE_NOT_REAL').toString('base64url')}`;
const server = await createServer({ root: path.resolve(process.argv[2]), configFile: false, server: { host: '127.0.0.1', port: 4187, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  let external = 0;
  await page.route('**/*', route => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
    external++;
    return route.abort();
  });
  await page.goto('http://127.0.0.1:4187');
  await page.locator('#tab-refresh').click();
  await page.locator('#token').fill(token);
  await page.waitForFunction(() => !['等待输入', '正在解析…'].includes(document.getElementById('status').textContent));
  console.log('INPUT=' + token);
  console.log('STATUS=' + await page.locator('#status').textContent());
  console.log('METADATA_ROWS=' + await page.locator('#refresh-metadata-fields tr').count());
  const row = page.locator('#refresh-metadata-fields [data-field="client_id"]');
  console.log('CLIENT_LABEL=' + await row.locator('strong').textContent());
  console.log('CLIENT_VALUE=' + await row.locator('code').textContent());
  console.log('CLIENT_NAME_ROWS=' + await page.locator('#refresh-metadata-fields [data-field="client_name"]').count());
  console.log('SIGNATURE_VISIBLE=' + await page.locator('#signature-status').isVisible());
  console.log('EXTERNAL_REQUESTS=' + external);
} finally {
  await browser?.close();
  await server.close();
}
