import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '../token-inspector/node_modules/@playwright/test/index.mjs';

const root = resolve(process.argv[2]);
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ?? 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.context().setOffline(true);
  const enc = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  await page.locator('#token').fill(`${enc({ alg: 'RS256' })}.${enc({ sub: 'synthetic-user', exp: 1 })}.AA`);
  await page.waitForTimeout(350);
  console.log(JSON.stringify({ status: await page.locator('#status').textContent(), decodedWithoutClick: (await page.locator('#header-json').textContent()).includes('RS256'), coloredSegments: await page.locator('#token-colors .token-segment').count() }));
  await page.locator('#clear').click();
  console.log(JSON.stringify({ cleared: await page.locator('#token').inputValue() === '' }));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
