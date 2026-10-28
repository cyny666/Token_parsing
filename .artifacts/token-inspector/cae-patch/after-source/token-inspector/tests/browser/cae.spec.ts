import { test, expect } from '@playwright/test';
import { base64url } from 'jose';

const jwt = (claims: unknown) => `${base64url.encode('{"alg":"RS256"}')}.${base64url.encode(JSON.stringify(claims))}.AA`;

test('CAE summary describes capabilities only and clears across inputs and modes', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/');
  const row = page.locator('#summary .summary-row').filter({ has: page.locator('span', { hasText: /^CAE$/ }) });
  for (const [claims, expected] of [
    [{ xms_cc: ['cp1'] }, '有能力声明'],
    [{}, '未发现能力声明'],
    [{ xms_cc: ['cp2'] }, '未发现能力声明'],
    [{ xms_cc: 'cp1' }, '未发现能力声明'],
    [{ xms_cc: null }, '未发现能力声明'],
    [{ xms_cc: ['CP1'] }, '未发现能力声明'],
  ] as const) {
    await page.locator('#clear').click();
    await page.locator('#token').fill(jwt(claims));
    await expect(row).toHaveCount(1);
    await expect(row.locator('strong')).toHaveText(expected);
    await expect(page.locator('#summary small')).toHaveText('仅表示客户端处理 claims challenge 的能力，不代表 CAE 实际生效。');
  }
  for (const token of ['opaque-example', 'abc.def.ghi', `${base64url.encode('{"alg":"dir","enc":"A256GCM"}')}..AA.AA.AA`]) {
    await page.locator('#token').fill(token);
    await expect(row).toHaveCount(0);
  }
  for (const mode of ['id', 'refresh']) {
    await page.locator(`#tab-${mode}`).click();
    await page.locator('#token').fill(jwt({ xms_cc: ['cp1'] }));
    await expect(page.locator('#status')).not.toHaveText('等待输入');
    await expect(row).toHaveCount(0);
  }
  await page.locator('#clear').click();
  await expect(page.locator('#summary')).toHaveText('');
});
