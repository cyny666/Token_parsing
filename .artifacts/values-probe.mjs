import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '../token-inspector/node_modules/@playwright/test/index.mjs';
import { generateKeyPair, exportJWK, SignJWT } from '../token-inspector/node_modules/jose/dist/webapi/index.js';

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
  // Deterministic fixture: generated once, reused by every probe run so rollback
  // outputs can be compared byte-for-byte.
  const fixturePath = new URL('./values-fixture.json', import.meta.url);
  let fixture;
  try { fixture = JSON.parse(await readFile(fixturePath, 'utf8')); } catch {}
  if (!fixture) {
    const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = 'values-probe';
    const jwt = await new SignJWT({
      scp: 'User.Read Mail.Read Directory.Read.All',
      roles: ['User.Read.All', 'RoleManagement.ReadWrite.Directory'],
      azp: '04b07795-8ddb-461a-bbee-02f9e1bf7b46',
      appid: '74658136-14ec-4630-ad9b-26e160ff0fc6',
      aud: '00000003-0000-0000-c000-000000000000',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: 'values-probe' })
      .setIssuer('https://sts.windows.net/11111111-1111-1111-1111-111111111111/')
      .setSubject('synthetic-user')
      .setIssuedAt(1735689600) // 2025-01-01T00:00:00Z
      .setExpirationTime(4102444800) // 2100-01-01T00:00:00Z
      .sign(privateKey);
    fixture = { publicJwk, jwt };
    await writeFile(fixturePath, JSON.stringify(fixture));
  }
  const { publicJwk, jwt } = fixture;
  browser = await chromium.launch();
  const page = await browser.newPage();
  let requests = 0;
  const mockKeys = route => { requests++; return route.fulfill({ json: { keys: [publicJwk] }, headers: { 'access-control-allow-origin': '*' } }); };
  await page.route('https://sts.windows.net/**', mockKeys);
  await page.route('https://login.microsoftonline.com/**', mockKeys);
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const status = async () => await page.locator('#signature-status').count() ? await page.locator('#signature-status').textContent() : await page.locator('.unverified').textContent();
  await page.locator('#token').fill(jwt);
  await page.waitForTimeout(800);
  await page.locator('[data-part="payload"][data-view="claims"]').click();
  const fields = async () => (await page.locator('#payload-fields').innerText()).replace(/\s+/g, ' ').trim();
  console.log(JSON.stringify({
    input: 'synthetic RS256 Entra v1 token with scp/roles/azp/appid/aud',
    inputSHA256: createHash('sha256').update(jwt).digest('hex'),
    signature: await status(),
    publicKeyRequests: requests,
    chips: await page.locator('#payload-fields .perm-chip').allTextContents(),
    critical: await page.locator('#payload-fields .perm-critical').allTextContents(),
    valueMatches: await page.locator('#payload-fields .value-match').allTextContents(),
    payloadFields: await fields(),
  }));
  await page.locator('#clear').click();
  await page.waitForTimeout(300);
  console.log(JSON.stringify({ cleared: await page.locator('#token').inputValue() === '', chips: await page.locator('#payload-fields .perm-chip').count(), signature: await status() }));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
