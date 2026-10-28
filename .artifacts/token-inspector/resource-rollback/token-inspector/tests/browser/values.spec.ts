import { test, expect } from '@playwright/test';
import { base64url } from 'jose';

const token = (claims: unknown) => `${base64url.encode(JSON.stringify({ alg: 'RS256' }))}.${base64url.encode(JSON.stringify(claims))}.AA`;

test('scp and roles render value chips with critical scopes highlighted', async ({ page }) => {
  // Block non-loopback requests: signature verification may probe Entra JWKS endpoints.
  await page.route('**/*', route =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  await page.locator('#token').fill(token({
    iss: 'https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0',
    scp: 'User.Read Mail.Read Directory.Read.All',
    roles: ['User.Read.All', 'RoleManagement.ReadWrite.Directory'],
    azp: '04b07795-8ddb-461a-bbee-02f9e1bf7b46',
    appid: '74658136-14ec-4630-ad9b-26e160ff0fc6',
    aud: '00000003-0000-0000-c000-000000000000',
    exp: 4102444800,
  }));
  await expect(page.locator('#status')).toContainText('已解码');
  await page.locator('[data-part="payload"][data-view="claims"]').click();
  await expect(page.locator('#payload-fields .perm-chip')).toHaveCount(5);
  await expect(page.locator('#payload-fields .perm-chip', { hasText: 'Mail.Read' })).toBeVisible();
  await expect(page.locator('#payload-fields .perm-critical')).toHaveCount(2);
  await expect(page.locator('#payload-fields .perm-critical', { hasText: 'Directory.Read.All' })).toBeVisible();
  await expect(page.locator('#payload-fields .value-match', { hasText: 'Microsoft Azure CLI' })).toBeVisible();
  await expect(page.locator('#payload-fields .value-match.value-critical', { hasText: 'ADIbizaUX' })).toBeVisible();
  await expect(page.locator('#payload-fields .value-match', { hasText: 'Microsoft Graph' })).toBeVisible();
  await expect(page.locator('#payload-fields')).toContainText('值匹配：User.Read=读取当前登录用户基本信息');
  await expect(page.locator('#payload-fields')).toContainText('共 3 项委托权限');
});

test('unknown clients and audiences stay plain while chip titles carry descriptions', async ({ page }) => {
  await page.goto('/');
  await page.locator('#token').fill(token({
    scp: 'User.Read made_up_scope',
    azp: '11111111-1111-1111-1111-111111111111',
    aud: 'example-api',
    exp: 4102444800,
  }));
  await expect(page.locator('#payload-fields .perm-chip')).toHaveCount(2);
  await expect(page.locator('#payload-fields .perm-critical')).toHaveCount(0);
  await expect(page.locator('#payload-fields .value-match')).toHaveCount(0);
  await expect(page.locator('#payload-fields .perm-chip', { hasText: 'User.Read' })).toHaveAttribute('title', '读取当前登录用户基本信息');
  await page.locator('#token').fill(token({ azp: '1fec8e78-bce4-4aaf-ab1b-5451cc387264', exp: 4102444800 }));
  await page.locator('[data-part="payload"][data-view="claims"]').click();
  const teams = page.locator('#payload-fields .value-match.value-critical', { hasText: 'Microsoft Teams' });
  await expect(teams).toBeVisible();
  await expect(teams).toHaveAttribute('title', 'FOCI 客户端：刷新 Token 可在同一家族客户端间换取新 Token');
  await page.locator('#token').fill(token({ roles: [], exp: 4102444800 }));
  await expect(page.locator('#payload-fields')).toContainText('[]');
});

test('aud shows the concrete recipient beside the original ID and in its explanation', async ({ page }) => {
  await page.route('**/*', route =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  const id = 'c44b4083-3bb0-49c1-b47d-974e53cbdf3c';
  for (const purpose of ['access', 'id']) {
    await page.locator(`#tab-${purpose}`).click();
    await page.locator('#token').fill(token({
      iss: 'https://sts.windows.net/11111111-1111-1111-1111-111111111111/', aud: id, exp: 4102444800,
    }));
    await page.locator('[data-part="payload"][data-view="claims"]').click();
    const aud = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^aud$/ }) });
    await expect(aud.locator('code')).toHaveText(JSON.stringify(id));
    await expect(aud.locator('.value-match')).toHaveText('受众：Azure Portal');
    await expect(aud.locator('.value-critical')).toHaveCount(0);
    await expect(aud.locator('td').nth(1)).toContainText('值匹配：受众=Azure Portal（静态名称匹配，未验证）');
    await expect(page.locator('#payload-json')).toContainText(id);
    await expect(page.locator('#payload-json')).not.toContainText('Azure Portal');
  }
  await page.locator('#token').fill(token({ aud: ['00000003-0000-0000-c000-000000000000', id, 'unknown'] }));
  await page.locator('[data-part="payload"][data-view="claims"]').click();
  await expect(page.locator('#payload-fields .value-match')).toHaveText(['受众：Microsoft Graph', '受众：Azure Portal']);
  await page.locator('#token').fill(token({ aud: 'constructor' }));
  await expect(page.locator('#payload-fields .value-match')).toHaveCount(0);
});
