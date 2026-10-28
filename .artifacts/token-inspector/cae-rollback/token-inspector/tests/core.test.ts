import { describe, expect, it } from 'vitest';
import { base64url } from 'jose';
import { inspectToken, MAX_INPUT_BYTES } from '../src/core';

const encode = (value: unknown) => base64url.encode(JSON.stringify(value));
const jwt = (claims: unknown, header: unknown = { alg: 'RS256', typ: 'JWT' }) => `${encode(header)}.${encode(claims)}.AA`;
const now = 1_700_000_000_000;

describe('offline decoding', () => {
  it('decodes generic JWT without asserting trust', () => {
    const result = inspectToken(jwt({ sub: 'synthetic', aud: ['api-a', 'api-b'], exp: now / 1000 + 60 }), now);
    expect(result.status).toBe('decoded');
    expect(result.verification).toBe('not-performed');
    expect(result.claims?.sub).toBe('synthetic');
    expect(result.provider).toBe('未知 / 未识别');
  });
  it.each(['1.0', '2.0'])('explains Entra version %s', ver => {
    const iss = ver === '1.0' ? 'https://sts.windows.net/example/' : 'https://login.microsoftonline.com/example/v2.0';
    const result = inspectToken(jwt({ iss, ver, tid: 'example', oid: 'example', appid: 'example', azp: 'example', scp: 'User.Read', roles: ['Reader'] }), now);
    expect(result.provider).toContain('Entra');
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.fields.find(f => f.name === 'payload.scp')?.description).toContain('委托权限');
  });
  it.each(['https://login.microsoftonline.com.evil.test/a', 'https://evil.test/login.microsoftonline.com', 'http://login.microsoftonline.com/a', 'https://user@login.microsoftonline.com/a'])('does not recognize misleading issuer %s', iss => {
    expect(inspectToken(jwt({ iss })).provider).toBe('未知 / 未识别');
  });
  it('accepts Bearer and surrounding whitespace', () => {
    expect(inspectToken(` \nBearer ${jwt({ sub: 'demo' })}\n`).status).toBe('decoded');
  });
  it('recognizes encrypted structure without guessing its contents', () => {
    const result = inspectToken(`${encode({ alg: 'dir', enc: 'A256GCM' })}..AA.AA.AA`);
    expect(result.status).toBe('encrypted');
    expect(result.claims).toBeUndefined();
    expect(result.header?.enc).toBe('A256GCM');
  });
  it('recognizes opaque strings without inferring refresh-token semantics', () => {
    const result = inspectToken('opaque-synthetic-credential');
    expect(result.status).toBe('opaque');
    expect(result.claims).toBeUndefined();
    expect(result.times).toEqual({});
  });
  it('retains Unicode and unknown claims', () => {
    const result = inspectToken(jwt({ custom: { name: '测试' } }));
    expect(result.claims?.custom).toEqual({ name: '测试' });
    expect(result.fields.find(f => f.name === 'payload.custom')?.description).toContain('未知');
  });
  it('handles prototype-related property names as unknown data', () => {
    const result = inspectToken(jwt(JSON.parse('{"__proto__":"data","constructor":"data","toString":"data"}')));
    expect(result.status).toBe('decoded');
    for (const name of ['__proto__', 'constructor', 'toString']) {
      expect(result.fields.find(f => f.name === `payload.${name}`)?.description).toContain('未知');
    }
  });
  it('keeps HTML payload as data', () => {
    const html = '<img src=x onerror=alert(1)>';
    expect(inspectToken(jwt({ html })).claims?.html).toBe(html);
  });
});

describe('invalid input', () => {
  it.each(['', ' ', 'Bearer ', 'first second', 'abc.def.ghi', 'a.b.c.d.e', '!!!!.e30.AA'])('rejects invalid input %j', input => {
    expect(inspectToken(input).status).toBe('error');
  });
  it('bounds raw UTF-8 bytes, including prefixes and multibyte input', () => {
    expect(inspectToken('a'.repeat(MAX_INPUT_BYTES)).status).toBe('opaque');
    expect(inspectToken('a'.repeat(MAX_INPUT_BYTES + 1)).status).toBe('error');
    expect(inspectToken('中'.repeat(22000)).status).toBe('error');
  });
  it.each([[], null, 'text', 123])('rejects non-object payload %j', claims => {
    expect(inspectToken(jwt(claims)).status).toBe('error');
  });
  it('rejects malformed JSON', () => {
    expect(inspectToken(`${encode({ alg: 'RS256' })}.${base64url.encode('{')}.AA`).status).toBe('error');
  });
  it('requires alg and enc where appropriate', () => {
    expect(inspectToken(jwt({}, {})).status).toBe('error');
    expect(inspectToken(`${encode({ alg: 'dir' })}..AA.AA.AA`).status).toBe('error');
  });
  it('reports unsigned tokens without verifying them', () => {
    const result = inspectToken(`${encode({ alg: 'none' })}.${encode({})}.`);
    expect(result.status).toBe('decoded');
    expect(result.warnings.join('')).toContain('无签名');
  });
});

describe('time and claim diagnostics', () => {
  it('uses inclusive expiry boundary and UTC output', () => {
    const result = inspectToken(jwt({ exp: now / 1000 }), now);
    expect(result.warnings.join('')).toContain('已过期');
    expect(result.times.exp).toBe(new Date(now).toISOString());
  });
  it('flags future nbf and iat', () => {
    const result = inspectToken(jwt({ nbf: now / 1000 + 1, iat: now / 1000 + 1 }), now);
    expect(result.warnings.join('')).toContain('尚未生效');
    expect(result.warnings.join('')).toContain('未来');
  });
  it.each(['tomorrow', null, {}, 1e300])('reports invalid exp %j without throwing', exp => {
    const result = inspectToken(jwt({ exp }), now);
    expect(result.status).toBe('decoded');
    expect(result.warnings.join('')).toContain('Unix 秒');
  });
  it('reports missing expiry and malformed audience', () => {
    const result = inspectToken(jwt({ aud: 123 }), now);
    expect(result.warnings.join('')).toContain('缺少 exp');
    expect(result.warnings.join('')).toContain('aud 类型异常');
  });
});
