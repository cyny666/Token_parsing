import { test, expect } from '@playwright/test';
import { SignJWT, generateKeyPair, exportJWK, base64url } from 'jose';

const issuer = 'https://sts.windows.net/11111111-1111-1111-1111-111111111111/';
async function fixture() {
  const pair = await generateKeyPair('RS256');
  const key = { ...await exportJWK(pair.publicKey), alg: 'RS256', kid: 'test-only-key', use: 'sig' };
  const token = await new SignJWT({ sub: 'synthetic-user', exp: 1 }).setIssuer(issuer).setProtectedHeader({ alg: 'RS256', kid: key.kid, jku: 'https://evil.example/key', x5u: 'http://127.0.0.1/private' }).sign(pair.privateKey);
  return { key, token };
}

test('automatically validates Entra signature, keeps expiry separate and sends only a public-key GET', async ({ page }) => {
  const { key, token } = await fixture();
  const requests: Array<{ url: string; method: string; body: string | null; auth: string | undefined }> = [];
  await page.route('https://login.microsoftonline.com/**', route => {
    const req = route.request();
    requests.push({ url: req.url(), method: req.method(), body: req.postData(), auth: req.headers().authorization });
    return route.fulfill({ json: { keys: [key] }, headers: { 'access-control-allow-origin': '*' } });
  });
  const unexpected: string[] = [];
  page.on('request', req => { if (!['127.0.0.1', 'login.microsoftonline.com'].includes(new URL(req.url()).hostname)) unexpected.push(req.url()); });
  await page.goto('/');
  await page.locator('#token').fill(token);
  await expect(page.locator('#signature-status')).toContainText('Signature Verified');
  await expect(page.locator('#signature-badge')).toHaveText('签名匹配');
  await expect(page.locator('#signature-time')).toContainText('已过期');
  expect(requests).toEqual([{ url: 'https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/discovery/keys', method: 'GET', body: null, auth: undefined }]);
  await page.screenshot({ path: 'test-results/signature-verified.png', fullPage: true });
  const parts = token.split('.'); parts[1] = base64url.encode('{"iss":"' + issuer + '","sub":"tampered"}');
  await page.locator('#token').fill(parts.join('.'));
  await expect(page.locator('#signature-status')).toContainText('Invalid Signature');
  await expect(page.locator('#signature-badge')).toHaveText('签名不匹配');
  expect(requests.length).toBe(1);
  expect(unexpected).toEqual([]);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  await page.locator('#clear').click();
  await expect(page.locator('#signature-status')).toHaveText('签名未验证');
});

test('manual mode revalidates on secret and algorithm changes without any network', async ({ page }) => {
  const secret = 'fixture-secret-at-least-32-bytes-long';
  const token = await new SignJWT({ sub: 'synthetic-user' }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(secret));
  await page.goto('/');
  await page.locator('#key-source').selectOption('manual');
  await page.context().setOffline(true);
  await page.locator('#signature-algorithm').selectOption('HS256');
  await page.locator('#token').fill(token);
  await expect(page.locator('#signature-status')).toContainText('等待输入');
  await page.locator('#verification-key').fill(secret);
  await expect(page.locator('#signature-status')).toContainText('Signature Verified');
  await page.locator('#verification-key').fill(secret + '-wrong');
  await expect(page.locator('#signature-status')).toContainText('Invalid Signature');
  await page.locator('#verification-key').fill(base64url.encode(secret));
  await page.locator('#secret-base64').check();
  await expect(page.locator('#signature-status')).toContainText('Signature Verified');
  await page.locator('#signature-algorithm').selectOption('RS256');
  await expect(page.locator('#signature-status')).toContainText('算法不匹配');
  await page.locator('#clear').click();
  await expect(page.locator('#verification-key')).toHaveValue('');
  await expect(page.locator('#signature-status')).toHaveText('签名未验证');
});

test('network errors and unavailable keys are not reported as invalid signatures', async ({ page }) => {
  const { token } = await fixture();
  await page.route('https://login.microsoftonline.com/**', route => route.abort());
  await page.goto('/');
  await page.locator('#token').fill(token);
  await expect(page.locator('#signature-status')).toContainText('无法获取微软公钥');
  await expect(page.locator('#signature-badge')).toHaveText('签名未验证');
});

test('clearing during a pending key request cannot restore an old verified state', async ({ page }) => {
  const { key, token } = await fixture();
  let unblock: () => void = () => {};
  const released = new Promise<void>(resolve => { unblock = resolve; });
  await page.route('https://login.microsoftonline.com/**', async route => {
    await released;
    await route.fulfill({ json: { keys: [key] }, headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
  });
  await page.goto('/');
  const request = page.waitForRequest('https://login.microsoftonline.com/**');
  await page.locator('#token').fill(token);
  await request;
  await page.locator('#clear').click();
  unblock();
  await page.waitForTimeout(500);
  await expect(page.locator('#signature-status')).toHaveText('签名未验证');
  await expect(page.locator('#signature-source')).toHaveText('');
  await expect(page.locator('#token')).toHaveValue('');
});
