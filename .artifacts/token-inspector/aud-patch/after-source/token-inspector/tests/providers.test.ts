import { describe, expect, it } from 'vitest';
import { base64url } from 'jose';
import { inspectToken } from '../src/core';

const encode = (value: unknown) => base64url.encode(JSON.stringify(value));
const jwt = (claims: Record<string, unknown>) => `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(claims)}.AA`;
const v2Issuer = 'https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0';
const description = (claims: Record<string, unknown>, key: string) =>
  inspectToken(jwt({ iss: v2Issuer, ver: '2.0', ...claims })).fields.find(field => field.name === `payload.${key}`)?.description;

describe('Entra access-token claim meanings', () => {
  it('documents the standard payload claims', () => {
    expect(description({ oid: '11111111-1111-1111-1111-111111111111' }, 'oid')).toContain('不可变');
    expect(description({ sub: 'synthetic' }, 'sub')).toContain('pairwise');
    expect(description({ scp: 'User.Read' }, 'scp')).toContain('委托权限');
    expect(description({ roles: ['Reader'] }, 'roles')).toContain('应用权限');
    expect(description({ uti: 'abc' }, 'uti')).toContain('jti');
    expect(description({ rh: 'opaque' }, 'rh')).toContain('资源方不应使用');
    expect(description({ aio: 'opaque' }, 'aio')).toContain('内部');
  });

  it('matches amr method codes to meanings', () => {
    const text = description({ amr: ['pwd', 'mfa'] }, 'amr')!;
    expect(text).toContain('pwd=密码或客户端密钥');
    expect(text).toContain('mfa=多因素认证');
    expect(description({ amr: ['custom_method'] }, 'amr')).toContain('custom_method');
  });

  it('matches client authentication method codes', () => {
    expect(description({ azpacr: '2' }, 'azpacr')).toContain('客户端证书');
    expect(description({ appidacr: 0 }, 'appidacr')).toContain('公共客户端');
    expect(description({ appidacr: 9 }, 'appidacr')).toContain('0 公共客户端');
  });

  it('matches token version, issuer format and consumer tenant', () => {
    expect(description({ ver: '2.0' }, 'ver')).toContain('v2.0 访问 Token');
    expect(description({}, 'iss')).toContain('v2.0 发行方格式');
    expect(description({ iss: 'https://sts.windows.net/712e49b4-2095-4560-8d67-8c6d9fba8506/' }, 'iss')).toContain('v1.0 发行方格式');
    expect(description({ tid: '9188040d-6c67-4c5b-b112-36a304b66dad' }, 'tid')).toContain('个人 Microsoft 账户');
  });

  it('matches CAE capability and groups overage pointers', () => {
    expect(description({ xms_cc: ['cp1'] }, 'xms_cc')).toContain('取值匹配：包含 cp1');
    expect(description({ xms_cc: ['other'] }, 'xms_cc')).not.toContain('取值匹配');
    expect(description({ _claim_names: { groups: 'src1' } }, '_claim_names')).toContain('overage');
    expect(description({ hasgroups: true }, 'hasgroups')).toContain('Graph');
  });

  it('counts scopes, roles, groups and matches audience shape', () => {
    expect(description({ scp: 'User.Read Mail.Send' }, 'scp')).toContain('共 2 项委托权限');
    expect(description({ roles: ['A', 'B', 'C'] }, 'roles')).toContain('共 3 项');
    expect(description({ aud: '00000003-0000-0000-c000-000000000000' }, 'aud')).toContain('GUID 形式受众');
    expect(description({ aud: 'api://00000003-0000-0000-c000-000000000000' }, 'aud')).toContain('Application ID URI');
  });

  it('keeps unknown claims generic and non-Entra tokens unmatched', () => {
    expect(description({ made_up_claim: 1 }, 'made_up_claim')).toContain('未知');
    const other = inspectToken(`${encode({ alg: 'RS256' })}.${encode({ sub: 'x', ver: '2.0' })}.AA`);
    expect(other.provider).toBe('未知 / 未识别');
    expect(other.fields.find(field => field.name === 'payload.ver')?.description).not.toContain('取值匹配');
  });
});
