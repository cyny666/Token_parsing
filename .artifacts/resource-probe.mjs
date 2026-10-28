import { createServer } from '../token-inspector/node_modules/vite/dist/node/index.js';
import { chromium } from '../token-inspector/node_modules/playwright/index.mjs';
import path from 'node:path';

const fixtures = [
  ['CUSTOM', { aud: 'api://synthetic-custom-api', scp: 'User.Read Directory.Read.All', roles: ['User.Read.All', 'RoleManagement.ReadWrite.Directory'] }],
  ['GRAPH_USER', { aud: '00000003-0000-0000-c000-000000000000', scp: 'User.Read', roles: ['RoleManagement.ReadWrite.Directory'] }],
  ['GRAPH_APP', { aud: '00000003-0000-0000-c000-000000000000', idtyp: 'app', roles: ['Mail.Read', 'RoleManagement.ReadWrite.Directory'] }],
];
const token = claims => `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...claims, exp: 4102444800 })).toString('base64url')}.AA`;
const server = await createServer({ root: path.resolve(process.argv[2]), configFile: false, server: { host: '127.0.0.1', port: 4187, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:4187');
  for (const [label, claims] of fixtures) {
    await page.locator('#token').fill(token(claims));
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('已解码'));
    await page.locator('[data-part="payload"][data-view="claims"]').click();
    const field = name => page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: new RegExp('^' + name + '$') }) });
    console.log(label + '_INPUT=' + token(claims));
    console.log(label + '_CRITICAL=' + await page.locator('#payload-fields .perm-critical').count());
    console.log(label + '_ROLES=' + await field('roles').innerText());
    if ('scp' in claims) console.log(label + '_SCP=' + await field('scp').innerText());
    console.log(label + '_TITLES=' + JSON.stringify(await page.locator('#payload-fields .perm-chip').evaluateAll(nodes => nodes.map(node => node.title))));
    console.log(label + '_RAW_PRESERVED=' + (JSON.parse(await page.locator('#payload-json').textContent()).aud === claims.aud));
  }
} finally { await browser?.close(); await server.close(); }
