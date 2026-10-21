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
  await expect(page.getByRole('heading', { name: '读懂 Token，不传出 Token。' })).toBeVisible();
  const initialRequests = requests.length;
  await page.context().setOffline(true);
  await page.locator('#token').fill(token({ iss: 'https://login.microsoftonline.com/example/v2.0', scp: 'User.Read', exp: 1, html: '<img src=x onerror=alert(1)>', jku: 'https://example.com/key' }));
  await page.locator('#inspect').click();
  await expect(page.locator('#status')).toHaveText('已解码 · 内容未经验证');
  await expect(page.locator('#summary')).toContainText('Microsoft Entra ID');
  await expect(page.locator('#warnings')).toContainText('按 exp 声明已过期');
  await expect(page.locator('#fields')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#details img')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.locator('#token').fill('abc.def.ghi');
  await expect(page.locator('#details')).toBeHidden();
  await expect(page.locator('#fields')).toHaveText('');
  await page.locator('#inspect').click();
  await expect(page.locator('#status')).toContainText('未能解析');
  await expect(page.locator('#details')).toBeHidden();
  await page.locator('#token').fill('opaque-example');
  await page.locator('#inspect').click();
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
  await page.locator('#inspect').click();
  await expect(page.locator('#details')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});
