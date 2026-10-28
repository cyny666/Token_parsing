import { test, expect } from '@playwright/test';
import { base64url } from 'jose';
import { brokerId, descriptor, opaqueText, refreshFixture, tenantId } from '../fixtures/refresh-structure';

test('Refresh displays only experimental public metadata without network, claims, signature or copies', async ({ page }) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto('/');
  await page.locator('#tab-refresh').click();
  await page.context().setOffline(true);
  await page.locator('#token').fill(`Bearer ${refreshFixture()}`);
  await expect(page.locator('#status')).toHaveText('公开描述段已解码 · 实验性 / 未验证');
  await expect(page.locator('#refresh-metadata')).toBeVisible();
  await expect(page.locator('#refresh-metadata-fields tr')).toHaveCount(8);
  await expect(page.locator('[data-field="tenant_id"] code')).toHaveText(tenantId);
  await expect(page.locator('[data-field="client_id"] code')).toHaveText(brokerId);
  await expect(page.locator('[data-field="client_name"] code')).toHaveText('Microsoft Authentication Broker');
  await expect(page.locator('[data-field="prefix_hex"] code')).toHaveText('010100');
  await expect(page.locator('[data-field="trailer_hex"] code')).toHaveText('0000000000');
  await expect(page.locator('#refresh-metadata')).toContainText('未解密');
  await expect(page.locator('#refresh-metadata')).not.toContainText(opaqueText);
  await expect(page.locator('#details')).toBeHidden();
  await expect(page.locator('#signature-status')).toBeHidden();
  await expect(page.locator('#signature-status')).toHaveText('签名未验证');
  await expect(page.locator('#copy-header')).toBeHidden();
  await expect(page.locator('#copy-payload')).toBeDisabled();
  await expect(page.locator('#header-fields')).toHaveText('');
  await expect(page.locator('#payload-fields')).toHaveText('');
  await expect(page.locator('#token-colors .token-segment')).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.screenshot({ path: 'test-results/refresh-structure-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/refresh-structure-mobile.png', fullPage: true });
});

test('unsupported layouts and malformed input remove old metadata instead of guessing', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tab-refresh').click();
  for (const [value, message] of [
    [refreshFixture('2'), '未支持此版本'],
    [refreshFixture('1', descriptor.subarray(0, 39)), '长度不为 40'],
    ['1.@@@.AA', '不是规范 Base64URL'],
    ['x'.repeat(65537), '64 KiB'],
  ]) {
    await page.locator('#token').fill(refreshFixture());
    await expect(page.locator('#refresh-metadata')).toBeVisible();
    await page.locator('#token').fill(value);
    await expect(page.locator('#refresh-metadata')).toBeHidden();
    await expect(page.locator('#refresh-metadata-fields tr')).toHaveCount(0);
    await expect(page.locator('#warnings')).toContainText(message);
    await expect(page.locator('#refresh-details')).not.toContainText(tenantId);
  }
  await page.locator('#token').fill(refreshFixture());
  await expect(page.locator('#refresh-metadata')).toBeVisible();
  await page.locator('#token').fill('opaque-example');
  await expect(page.locator('#status')).toContainText('Opaque / Unknown');
  await expect(page.locator('#refresh-metadata-fields tr')).toHaveCount(0);
});

test('clear, tab switches and pending parsing never restore or leak descriptor fields', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tab-refresh').click();
  await page.locator('#token').fill(refreshFixture());
  await expect(page.locator('#refresh-metadata')).toBeVisible();
  await page.locator('#clear').click();
  await expect(page.locator('#token')).toHaveValue('');
  await expect(page.locator('#refresh-metadata-fields')).toHaveText('');
  await expect(page.locator('#refresh-metadata')).toBeHidden();
  await page.evaluate(value => {
    const input = document.getElementById('token') as HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    document.getElementById('tab-id')!.click();
  }, refreshFixture());
  await page.waitForTimeout(400);
  await expect(page.locator('#status')).toHaveText('等待输入');
  await expect(page.locator('#token')).toHaveValue('');
  await expect(page.locator('#refresh-metadata-fields')).toHaveText('');
  await page.locator('#tab-refresh').click();
  await page.locator('#token').fill(refreshFixture());
  await expect(page.locator('#refresh-metadata')).toBeVisible();
  await page.locator('#tab-access').click();
  await expect(page.locator('#refresh-metadata-fields')).toHaveText('');
  await expect(page.locator('#payload-json')).not.toContainText(tenantId);
  await page.locator('#tab-refresh').click();
  await expect(page.locator('#refresh-metadata')).toBeHidden();
});

test('unknown clients stay unknown and JWT or HTML input is not interpreted as descriptor metadata', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tab-refresh').click();
  const unknown = descriptor.slice(); unknown.fill(0, 19, 35);
  await page.locator('#token').fill(refreshFixture('1', unknown));
  await expect(page.locator('[data-field="client_name"] code')).toContainText('未收录');
  await expect(page.locator('[data-field="client_id"] code')).toHaveText('00000000-0000-0000-0000-000000000000');
  const cookie = `${base64url.encode('{"alg":"HS256","kdf_ver":2}')}.${base64url.encode(JSON.stringify({ refresh_token: refreshFixture() }))}.AA`;
  await page.locator('#token').fill(cookie);
  await expect(page.locator('#status')).toContainText('格式：JWT');
  await expect(page.locator('#refresh-metadata')).toBeHidden();
  await expect(page.locator('#payload-json')).not.toContainText(tenantId);
  await page.locator('#token').fill('1.<img src=x onerror=alert(1)>.AA');
  await expect(page.locator('#status')).toContainText('未能解析');
  await expect(page.locator('#refresh-details img')).toHaveCount(0);
  await expect(page.locator('#refresh-metadata-fields tr')).toHaveCount(0);
});
