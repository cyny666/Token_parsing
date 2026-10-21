import { test, expect } from '@playwright/test';
import { base64url } from 'jose';

const token = (claims: unknown) => `${base64url.encode(JSON.stringify({ alg: 'RS256' }))}.${base64url.encode(JSON.stringify(claims))}.AA`;

test('offline local page, no credential traffic, safe rendering and state reset', async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Block all non-loopback requests, including while loading the application.
  await page.route('**/*', route => {
    const url = route.request().url(); requests.push(url);
    return new URL(url).hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'JSON Web Token 解码器' })).toBeVisible();
  const initialRequests = requests.length;
  await page.context().setOffline(true);
  await page.locator('#token').fill(token({ iss: 'https://login.microsoftonline.com/example/v2.0', scp: 'User.Read', exp: 1, html: '<img src=x onerror=alert(1)>', jku: 'https://example.com/key' }));
  await expect(page.locator('#status')).toHaveText('已解码 · 内容未经验证');
  await expect(page.locator('#summary')).toContainText('Microsoft Entra ID');
  await expect(page.locator('#warnings')).toContainText('按 exp 声明已过期');
  await expect(page.locator('#payload-fields')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#details img')).toHaveCount(0);
  await expect(page.locator('#token-colors .token-segment')).toHaveCount(3);
  await expect(page.locator('#payload-json .json-key').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.locator('#token').fill('abc.def.ghi');
  await expect(page.locator('#copy-payload')).toBeDisabled();
  await expect(page.locator('#payload-fields')).toHaveText('');
  await expect(page.locator('#status')).toContainText('未能解析');
  await expect(page.locator('#copy-payload')).toBeDisabled();
  await page.locator('#token').fill('opaque-example');
  await expect(page.locator('#status')).toContainText('不透明');
  await page.locator('#clear').click();
  await expect(page.locator('#token')).toHaveValue('');
  await expect(page.locator('#summary')).toBeHidden();
  await expect(page.locator('#warnings')).toHaveText('');
  await expect(page.locator('#status')).toHaveText('等待输入');
  expect(requests.length).toBe(initialRequests);
  expect(errors).toEqual([]);
});

test('mobile layout fits viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#token').fill(token({ sub: 'synthetic-user', aud: 'example-api' }));
  await expect(page.locator('#status')).toContainText('已解码');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('independent JSON and claims views, explicit clipboard writes, and clear cancels pending parsing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => {
      (window as unknown as { copies: string[] }).copies.push(text);
    } } });
    (window as unknown as { copies: string[] }).copies = [];
  });
  await page.goto('/');
  const claims = { sub: 'demo', exp: 1, nested: { quote: '"\\\n测试', values: [false, null, -2.5e3] } };
  await page.locator('#token').fill(token(claims));
  await expect(page.locator('#status')).toContainText('已解码');
  expect(JSON.parse(await page.locator('#payload-json').textContent() ?? '')).toEqual(claims);
  expect(await page.evaluate(() => (window as unknown as { copies: string[] }).copies.length)).toBe(0);
  await page.locator('[data-part="payload"][data-view="claims"]').click();
  await expect(page.locator('#payload-claims')).toBeVisible();
  await expect(page.locator('#payload-json')).toBeHidden();
  await expect(page.locator('#header-json')).toBeVisible();
  await expect(page.locator('#payload-fields')).toContainText('UTC：1970-01-01');
  await page.locator('#copy-payload').click();
  await expect(page.locator('#copy-status')).toContainText('Payload 已复制');
  const copies = await page.evaluate(() => (window as unknown as { copies: string[] }).copies);
  expect(copies).toEqual([JSON.stringify(claims, null, 2)]);
  await page.locator('#copy-header').click();
  await expect(page.locator('#copy-status')).toContainText('Header 已复制');
  await page.locator('#token').fill(token({ sub: 'replace' }));
  await page.locator('#clear').click();
  await page.waitForTimeout(300);
  await expect(page.locator('#status')).toHaveText('等待输入');
  await expect(page.locator('#copy-header')).toBeDisabled();
  await expect(page.locator('#copy-payload')).toBeDisabled();
  await expect(page.locator('#token-colors')).toHaveText('');
  await expect(page.locator('#copy-status')).toHaveText('');
});

test('JWE, malformed input, clipboard denial and long input remain safe', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
    writeText: async () => { throw new Error('permission denied'); },
  } }));
  await page.goto('/');
  const header = base64url.encode(JSON.stringify({ alg: 'dir', enc: 'A256GCM' }));
  await page.locator('#token').fill(`${header}..AA.AA.AA`);
  await expect(page.locator('#status')).toContainText('JWE');
  await expect(page.locator('#header-json')).toContainText('A256GCM');
  await expect(page.locator('#payload-json')).toHaveText('载荷已加密，无法显示。');
  await expect(page.locator('#copy-payload')).toBeDisabled();
  await expect(page.locator('#token-colors .token-segment')).toHaveCount(0);
  await page.locator('#copy-header').click();
  await expect(page.locator('#copy-status')).toContainText('复制失败');
  await page.locator('#token').fill('a'.repeat(65537));
  await expect(page.locator('#status')).toContainText('未能解析');
  await expect(page.locator('#warnings')).toContainText('64 KiB');
  await page.locator('#token').fill('Bearer ' + token({ sub: 'x'.repeat(3000) }));
  await expect(page.locator('#status')).toContainText('已解码');
  expect(await page.evaluate(() => {
    const input = document.getElementById('token') as HTMLTextAreaElement;
    const mirror = document.getElementById('token-colors')!;
    return input.clientWidth === mirror.clientWidth;
  })).toBe(true);
});
