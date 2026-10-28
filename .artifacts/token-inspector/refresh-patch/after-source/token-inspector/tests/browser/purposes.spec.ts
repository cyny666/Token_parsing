import { test, expect } from '@playwright/test';
import { base64url, exportJWK, generateKeyPair, SignJWT } from 'jose';

const jwt = (claims: unknown = { sub: 'synthetic-purpose-user', exp: 1 }) =>
  `${base64url.encode('{"alg":"RS256"}')}.${base64url.encode(JSON.stringify(claims))}.AA`;

test('defaults to Access and supports accessible keyboard navigation without storage', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveCount(3);
  const access = page.getByRole('tab', { name: 'Access Token', exact: true });
  await expect(access).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-access');
  await access.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'ID Token', exact: true })).toBeFocused();
  await expect(page.locator('#purpose-title')).toHaveText('ID Token');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-id');
  await expect(page.locator('#details')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('#refresh-details')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(access).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tab-refresh')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(access).toHaveAttribute('tabindex', '0');
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('ID retains manual signature validation and switching clears credentials and results', async ({ page }) => {
  const secret = 'purpose-fixture-secret-at-least-32-bytes';
  const token = await new SignJWT({ sub: 'synthetic-id-user' }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(secret));
  await page.goto('/');
  await page.locator('#tab-id').click();
  await page.locator('#key-source').selectOption('manual');
  await page.locator('#signature-algorithm').selectOption('HS256');
  await page.locator('#verification-key').fill(secret);
  await page.locator('#token').fill(token);
  await expect(page.locator('#signature-status')).toContainText('Signature Verified');
  await expect(page.locator('#payload-json')).toContainText('synthetic-id-user');
  await page.locator('#tab-access').click();
  await expect(page.locator('#token')).toHaveValue('');
  await expect(page.locator('#verification-key')).toHaveValue('');
  await expect(page.locator('#payload-fields')).toHaveText('');
  await expect(page.locator('#copy-payload')).toBeDisabled();
  await expect(page.locator('#byte-count')).toHaveText('0 B');
  await expect(page.locator('#signature-status')).toHaveText('签名未验证');
  await expect(page.locator('#signature-source')).toHaveText('');
  await expect(page.locator('#signature-time')).toHaveText('');
  await page.locator('#tab-id').click();
  await expect(page.locator('#token')).toHaveValue('');
  await expect(page.locator('#signature-algorithm')).toHaveValue('HS256');
  await page.locator('#token').fill('opaque-example');
  await expect(page.locator('#status')).toContainText('不透明');
  const jwe = `${base64url.encode('{"alg":"dir","enc":"A256GCM"}')}..AA.AA.AA`;
  await page.locator('#token').fill(jwe);
  await expect(page.locator('#status')).toContainText('JWE');
  await expect(page.locator('#payload-json')).toContainText('载荷已加密');
});

test('Refresh exposes formats and limits, never claims, copying or public-key requests', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://**/*', route => { requests.push(route.request().url()); return route.abort(); });
  await page.goto('/');
  await page.locator('#tab-refresh').click();
  const entra = jwt({ iss: 'https://sts.windows.net/11111111-1111-1111-1111-111111111111/', sub: '<img src=x onerror=alert(1)>', scp: 'User.Read', exp: 1 });
  await page.locator('#token').fill(entra);
  await expect(page.locator('#status')).toContainText('格式：JWT');
  await expect(page.locator('#details')).toBeHidden();
  await expect(page.locator('#copy-header')).toBeHidden();
  await expect(page.locator('#copy-payload')).toBeHidden();
  await expect(page.locator('#signature-badge')).toBeHidden();
  await expect(page.locator('#payload-fields')).toHaveText('');
  await expect(page.locator('#header-fields')).toHaveText('');
  await expect(page.locator('#payload-json')).not.toContainText('User.Read');
  await expect(page.locator('#summary')).not.toContainText('exp');
  const jwe = `${base64url.encode('{"alg":"dir","enc":"A256GCM"}')}..AA.AA.AA`;
  await page.locator('#token').fill(jwe);
  await expect(page.locator('#status')).toContainText('格式：JWE');
  await page.locator('#token').fill('opaque-example');
  await expect(page.locator('#status')).toContainText('Opaque / Unknown');
  await page.locator('#token').fill('abc.def.ghi');
  await expect(page.locator('#status')).toContainText('未能解析');
  await page.locator('#token').fill('x'.repeat(65537));
  await expect(page.locator('#warnings')).toContainText('64 KiB');
  await page.waitForTimeout(400);
  expect(requests).toEqual([]);
  await page.screenshot({ path: 'test-results/refresh-desktop.png', fullPage: true });
  await page.locator('#clear').click();
  await expect(page.locator('#token')).toHaveValue('');
  await expect(page.locator('#diagnostics')).toBeHidden();
});

test('switching cancels pending parsing and clears JWKS cache after automatic ID verification', async ({ page }) => {
  const pair = await generateKeyPair('RS256');
  const key = { ...await exportJWK(pair.publicKey), kid: 'purpose-test', alg: 'RS256', use: 'sig' };
  const token = await new SignJWT({ sub: 'synthetic-purpose-user' })
    .setIssuer('https://sts.windows.net/11111111-1111-1111-1111-111111111111/')
    .setProtectedHeader({ alg: 'RS256', kid: key.kid }).sign(pair.privateKey);
  let requests = 0;
  await page.route('https://login.microsoftonline.com/**', route => {
    requests++;
    return route.fulfill({ json: { keys: [key] }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/');
  await page.evaluate(value => {
    const input = document.getElementById('token') as HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    document.getElementById('tab-id')!.click();
  }, token);
  await page.waitForTimeout(450);
  await expect(page.locator('#status')).toHaveText('等待输入');
  await expect(page.locator('#token')).toHaveValue('');
  expect(requests).toBe(0);
  await page.locator('#token').fill(token);
  await expect(page.locator('#signature-status')).toContainText('Signature Verified');
  expect(requests).toBe(1);
  await page.locator('#tab-access').click();
  await page.locator('#token').fill(token);
  await expect(page.locator('#signature-status')).toContainText('Signature Verified');
  expect(requests).toBe(2);
});

test('switching during a key request blocks late results in Refresh and the next decoder', async ({ page }) => {
  const pair = await generateKeyPair('RS256');
  const key = { ...await exportJWK(pair.publicKey), kid: 'delayed-purpose-key', alg: 'RS256' };
  const token = await new SignJWT({ sub: 'late-user' })
    .setIssuer('https://sts.windows.net/11111111-1111-1111-1111-111111111111/')
    .setProtectedHeader({ alg: 'RS256', kid: key.kid }).sign(pair.privateKey);
  let release: () => void = () => {};
  const released = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route('https://login.microsoftonline.com/**', async route => {
    requested = true;
    await released;
    await route.fulfill({ json: { keys: [key] }, headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
  });
  await page.goto('/');
  await page.locator('#token').fill(token);
  await expect.poll(() => requested).toBe(true);
  await page.locator('#tab-refresh').click();
  await expect(page.locator('#token')).toHaveValue('');
  release();
  await page.waitForTimeout(450);
  await expect(page.locator('#status')).toHaveText('等待输入');
  await expect(page.locator('#signature-status')).toHaveText('签名未验证');
  await page.locator('#tab-id').click();
  await expect(page.locator('#payload-json')).not.toContainText('late-user');
  await expect(page.locator('#signature-status')).toHaveText('签名未验证');
});

test('all purpose entries fit narrow mobile screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  for (const purpose of ['access', 'id', 'refresh']) {
    await page.locator(`#tab-${purpose}`).click();
    await expect(page.locator(`#tab-${purpose}`)).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/refresh-mobile.png', fullPage: true });
});
