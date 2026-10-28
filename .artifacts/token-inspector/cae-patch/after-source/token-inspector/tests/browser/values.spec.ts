import { test, expect } from '@playwright/test';
import { base64url } from 'jose';

const token = (claims: unknown) => `${base64url.encode(JSON.stringify({ alg: 'RS256' }))}.${base64url.encode(JSON.stringify(claims))}.AA`;

test('Graph delegated scopes are explained while user roles stay application-role values', async ({ page }) => {
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
  await expect(page.locator('#payload-fields .perm-chip')).toHaveCount(3);
  await expect(page.locator('#payload-fields .perm-chip', { hasText: 'Mail.Read' })).toBeVisible();
  await expect(page.locator('#payload-fields .perm-critical')).toHaveCount(1);
  await expect(page.locator('#payload-fields .perm-critical', { hasText: 'Directory.Read.All' })).toBeVisible();
  await expect(page.locator('#payload-fields .value-match', { hasText: 'Microsoft Azure CLI' })).toBeVisible();
  await expect(page.locator('#payload-fields .value-match.value-critical', { hasText: 'ADIbizaUX' })).toBeVisible();
  await expect(page.locator('#payload-fields .value-match', { hasText: 'Microsoft Graph' })).toBeVisible();
  await expect(page.locator('#payload-fields')).toContainText('值匹配：User.Read=允许用户登录应用');
  const roles = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^roles$/ }) });
  await expect(roles).toContainText('应用角色');
  await expect(roles.locator('.perm-chip')).toHaveCount(0);
  await expect(page.locator('#payload-fields')).toContainText('共 3 项委托权限');
});

test('unknown audiences keep raw scopes while independent client name matching is preserved', async ({ page }) => {
  await page.goto('/');
  await page.locator('#token').fill(token({
    scp: 'User.Read made_up_scope',
    azp: '11111111-1111-1111-1111-111111111111',
    aud: 'example-api',
    exp: 4102444800,
  }));
  await expect(page.locator('#status')).toContainText('已解码');
  await expect(page.locator('#payload-fields .perm-chip')).toHaveCount(0);
  await expect(page.locator('#payload-fields .perm-critical')).toHaveCount(0);
  await expect(page.locator('#payload-fields .value-match')).toHaveCount(0);
  await expect(page.locator('#payload-fields')).toContainText('"User.Read made_up_scope"');
  await expect(page.locator('#payload-fields')).not.toContainText('允许用户登录应用');
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

test('Graph application permissions use their own dictionary, not delegated descriptions or prefix guesses', async ({ page }) => {
  await page.goto('/');
  const claims = {
    aud: '00000003-0000-0000-c000-000000000000', idtyp: 'app',
    roles: ['Mail.Read', 'User.Read', 'RoleManagement.ReadWrite.Directory', 'Directory.Read.MadeUp'],
  };
  await page.locator('#token').fill(token(claims));
  await page.locator('[data-part="payload"][data-view="claims"]').click();
  const roles = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^roles$/ }) });
  await expect(roles).toContainText('应用权限（idtyp=app 线索，未验证）');
  await expect(roles.locator('.perm-chip')).toHaveCount(4);
  await expect(roles.locator('.perm-critical')).toHaveCount(1);
  await expect(roles.locator('.perm-chip', { hasText: /^Mail\.Read$/ })).toHaveAttribute('title', /应用权限.*所有邮箱/);
  await expect(roles.locator('.perm-chip', { hasText: /^User\.Read$/ })).toHaveAttribute('title', /未收录/);
  await expect(roles.locator('.perm-chip', { hasText: /^Directory\.Read\.MadeUp$/ })).toHaveAttribute('title', /未收录/);
  await expect(roles).not.toContainText('读取当前用户邮箱');
  expect(JSON.parse(await page.locator('#payload-json').textContent() ?? '')).toEqual(claims);
  await page.screenshot({ path: 'test-results/resource-permissions-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/resource-permissions-mobile.png', fullPage: true });
  await page.locator('#token').fill(token({ ...claims, aud: 'api://custom-api' }));
  await expect(roles.locator('.perm-chip')).toHaveCount(0);
  await expect(roles).toContainText('未匹配已收录的单一资源权限字典');
  await expect(roles).not.toContainText('所有邮箱');
  expect(JSON.parse(await roles.locator('code').textContent() ?? '')).toEqual(claims.roles);
});

test('unregistered, missing and ambiguous audiences retain exact permission values without Graph inference', async ({ page }) => {
  await page.goto('/');
  for (const aud of [
    'api://custom-api', 'https://management.azure.com/', 'c44b4083-3bb0-49c1-b47d-974e53cbdf3c',
    undefined, null, 42, ['00000003-0000-0000-c000-000000000000', 'api://custom'],
    ['00000003-0000-0000-c000-000000000000'], 'https://graph.microsoft.com.evil',
  ]) {
    const claims = { aud, scp: 'User.Read   Directory.Read.All', roles: ['RoleManagement.ReadWrite.Directory', 7, 'Mail.Read'] };
    await page.locator('#token').fill(token(claims));
    await page.locator('[data-part="payload"][data-view="claims"]').click();
    const scp = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^scp$/ }) });
    const roles = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^roles$/ }) });
    await expect(page.locator('#payload-fields .perm-chip')).toHaveCount(0);
    await expect(page.locator('#payload-fields .perm-critical')).toHaveCount(0);
    await expect(scp.locator('code')).toHaveText(JSON.stringify(claims.scp));
    expect(JSON.parse(await roles.locator('code').textContent() ?? '')).toEqual(claims.roles);
    await expect(scp).toContainText('未匹配已收录的单一资源权限字典');
    await expect(roles).toContainText('字段类型异常');
    await expect(page.locator('#payload-fields')).not.toContainText('值匹配：User.Read=');
  }
});

test('roles need explicit app-only evidence and wids remains a distinct directory-role claim', async ({ page }) => {
  await page.goto('/');
  for (const extra of [{}, { scp: 'User.Read' }, { idtyp: 'app', scp: 'User.Read' }, { idtyp: 'app', scp: '' }, { idtyp: 'app', scp: null }]) {
    await page.locator('#token').fill(token({
      aud: '00000003-0000-0000-c000-000000000000', ...extra,
      roles: ['RoleManagement.ReadWrite.Directory'],
      wids: ['62e90394-69f5-4237-9190-012177145e10', 'Directory.Read.All'],
    }));
    await page.locator('[data-part="payload"][data-view="claims"]').click();
    const roles = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^roles$/ }) });
    const directory = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^wids$/ }) });
    await expect(roles).toContainText('应用角色');
    await expect(roles.locator('.perm-chip')).toHaveCount(0);
    await expect(roles.locator('code')).toHaveText(JSON.stringify(['RoleManagement.ReadWrite.Directory'], null, 2));
    await expect(directory).toContainText('目录角色（wids / RoleTemplateID）');
    await expect(directory.locator('.perm-chip')).toHaveCount(0);
    await expect(directory).not.toContainText('值匹配：');
    if ('idtyp' in extra) {
      await expect(roles).toContainText('主体线索冲突');
      await expect(page.locator('#payload-fields .perm-chip')).toHaveCount(0);
    }
  }
});

test('ID entry and malformed claim types never acquire API permission labels or lose raw values', async ({ page }) => {
  await page.goto('/');
  const claims = { aud: '00000003-0000-0000-c000-000000000000', idtyp: 'app', roles: ['Mail.Read'] };
  await page.locator('#tab-id').click();
  await page.locator('#token').fill(token(claims));
  await page.locator('[data-part="payload"][data-view="claims"]').click();
  await expect(page.locator('#payload-fields .perm-chip')).toHaveCount(0);
  await expect(page.locator('#payload-fields')).toContainText('应用角色');
  await expect(page.locator('#payload-fields')).not.toContainText('值匹配：Mail.Read=');
  await page.locator('#tab-access').click();
  await page.locator('#token').fill(token({ ...claims, roles: ['Mail.Read', 42], scp: 5, wids: 'Directory.Read.All' }));
  await page.locator('[data-part="payload"][data-view="claims"]').click();
  await expect(page.locator('#payload-fields .perm-chip')).toHaveCount(0);
  await expect(page.locator('#payload-fields')).toContainText('字段类型异常');
  const roles = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^roles$/ }) });
  expect(JSON.parse(await roles.locator('code').textContent() ?? '')).toEqual(['Mail.Read', 42]);
  await page.locator('#token').fill(token({ aud: claims.aud, scp: 'constructor __proto__ Directory.Read.MadeUp' }));
  await expect(page.locator('#payload-fields .perm-chip')).toHaveCount(3);
  await expect(page.locator('#payload-fields .perm-critical')).toHaveCount(0);
  const scopes = page.locator('#payload-fields tr').filter({ has: page.locator('strong', { hasText: /^scp$/ }) });
  await expect(scopes).not.toContainText('值匹配：');
});
