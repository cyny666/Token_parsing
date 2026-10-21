import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '../token-inspector/node_modules/@playwright/test/index.mjs';
import { generateKeyPair, exportJWK, SignJWT, base64url } from '../token-inspector/node_modules/jose/dist/webapi/index.js';

const root = resolve(process.argv[2]);
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const fixturePath = new URL('./signature-fixture.json', import.meta.url);
  let fixture;
  try { fixture = JSON.parse(await readFile(fixturePath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const key = { ...await exportJWK(publicKey), kid: 'synthetic-key', alg: 'RS256', use: 'sig' };
    const jwt = await new SignJWT({ sub: 'synthetic-user', exp: 1 }).setIssuer('https://sts.windows.net/11111111-1111-1111-1111-111111111111/').setProtectedHeader({ alg: 'RS256', kid: key.kid }).sign(privateKey);
    fixture = { key, jwt };
    await writeFile(fixturePath, JSON.stringify(fixture), { flag: 'wx' });
  }
  const { key, jwt } = fixture;
  browser = await chromium.launch();
  const page = await browser.newPage();
  let requests = 0;
  await page.route('https://login.microsoftonline.com/**', route => { requests++; return route.fulfill({ json: { keys: [key] }, headers: { 'access-control-allow-origin': '*' } }); });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const status = async () => await page.locator('#signature-status').count() ? await page.locator('#signature-status').textContent() : await page.locator('.unverified').textContent();
  await page.locator('#token').fill(jwt);
  await page.waitForTimeout(800);
  console.log(JSON.stringify({ input: 'synthetic RS256 / expired claim', inputSHA256: createHash('sha256').update(jwt).digest('hex'), signature: await status(), publicKeyRequests: requests }));
  const segments = jwt.split('.');
  const tampered = JSON.parse(new TextDecoder().decode(base64url.decode(segments[1])));
  tampered.sub = 'tampered-user';
  segments[1] = base64url.encode(JSON.stringify(tampered));
  await page.locator('#token').fill(segments.join('.'));
  await page.waitForTimeout(500);
  console.log(JSON.stringify({ input: 'same JWT with tampered payload', signature: await status() }));
  await page.locator('#clear').click();
  console.log(JSON.stringify({ cleared: await page.locator('#token').inputValue() === '', signature: await status() }));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
