import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, exportSPKI, base64url, type JWK } from 'jose';
import { ALGORITHMS, clearVerificationCache, entraJwksUrl, verifySignature } from '../src/verification';

const issuer = 'https://sts.windows.net/11111111-1111-1111-1111-111111111111/';
let token: string, pem: string, jwk: JWK;
const manual = (key: string, algorithm = 'RS256') => ({ mode: 'manual' as const, algorithm, key });
const auto = { mode: 'entra' as const, algorithm: 'RS256', key: '' };
beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  jwk = { ...await exportJWK(pair.publicKey), kid: 'fixture-key', alg: 'RS256', use: 'sig' };
  pem = await exportSPKI(pair.publicKey);
  token = await new SignJWT({ sub: 'fixture-user', exp: 1 }).setIssuer(issuer).setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).sign(pair.privateKey);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); clearVerificationCache(); });

describe('local signature validation', () => {
  it.each(ALGORITHMS)('supports explicitly selected %s without relying on token-controlled policy', async alg => {
    if (alg.startsWith('HS')) {
      const secret = 's'.repeat(Number(alg.slice(2)) / 8);
      const signed = await new SignJWT({}).setProtectedHeader({ alg }).sign(new TextEncoder().encode(secret));
      expect((await verifySignature(signed, manual(secret, alg))).state).toBe('verified');
    } else {
      const pair = await generateKeyPair(alg);
      const signed = await new SignJWT({}).setProtectedHeader({ alg }).sign(pair.privateKey);
      expect((await verifySignature(signed, manual(await exportSPKI(pair.publicKey), alg))).state).toBe('verified');
    }
  });
  it('verifies RSA PEM independently of expiry', async () => {
    expect((await verifySignature(token, manual(pem))).state).toBe('verified');
  });
  it('verifies a public JWK and JWKS', async () => {
    for (const key of [jwk, { keys: [jwk] }]) expect((await verifySignature(token, manual(JSON.stringify(key)))).state).toBe('verified');
  });
  it('rejects altered payload and a wrong RSA key', async () => {
    const parts = token.split('.'); parts[1] = base64url.encode('{"sub":"altered"}');
    expect((await verifySignature(parts.join('.'), manual(pem))).state).toBe('invalid');
    const wrong = await generateKeyPair('RS256');
    expect((await verifySignature(token, manual(await exportSPKI(wrong.publicKey)))).state).toBe('invalid');
  });
  it('validates HMAC automatically from an explicitly selected algorithm, preserving secret whitespace', async () => {
    const secret = '  fixture-secret-at-least-32-bytes  ';
    const hs = await new SignJWT({ exp: 1 }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(secret));
    expect((await verifySignature(hs, manual(secret, 'HS256'))).state).toBe('verified');
    expect((await verifySignature(hs, manual(secret.trim(), 'HS256'))).state).toBe('invalid');
    expect((await verifySignature(hs, { ...manual(base64url.encode(secret), 'HS256'), base64Secret: true })).state).toBe('verified');
  });
  it('rejects algorithm confusion, missing or weak keys, private JWKs, and malformed keys', async () => {
    expect((await verifySignature(token, manual(pem, 'HS256'))).state).toBe('unsupported');
    expect((await verifySignature(token, manual(''))).state).toBe('missing-key');
    expect((await verifySignature(token, manual('bad pem'))).state).toBe('error');
    expect((await verifySignature(token, manual(JSON.stringify({ ...jwk, d: 'private-material' })))).state).toBe('error');
    expect((await verifySignature(token, manual(JSON.stringify({ keys: [] })))).state).toBe('error');
    expect((await verifySignature(token, manual('x'.repeat(65537)))).state).toBe('error');
    const hs = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode('valid-secret-at-least-32-bytes-long'));
    expect((await verifySignature(hs, manual('short', 'HS256'))).state).toBe('error');
    expect((await verifySignature(hs, manual(pem, 'HS256'))).state).toBe('error');
  });
  it.each(['opaque', 'a.b.c', `${base64url.encode('{"alg":"none"}')}.${base64url.encode('{}')}.`, `${base64url.encode('{"alg":"dir","enc":"A256GCM"}')}..AA.AA.AA`])('never verifies unsigned, malformed or encrypted input', async input => {
    expect((await verifySignature(input, manual(pem))).state).toBe('unsupported');
  });
});

describe('Entra public key discovery', () => {
  it('uses a fixed Microsoft URL and no credential, token, referrer or redirect', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] })));
    vi.stubGlobal('fetch', fetcher);
    expect((await verifySignature(token, auto)).state).toBe('verified');
    expect((await verifySignature(token, auto)).state).toBe('verified');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/discovery/keys');
    expect(options).toMatchObject({ method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
    expect(options.body).toBeUndefined(); expect(options.headers).toBeUndefined();
    clearVerificationCache();
    await verifySignature(token, auto);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('handles network/CORS errors without claiming invalid signature', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    expect((await verifySignature(token, auto)).state).toBe('error');
  });
  it('times out an unresponsive public-key request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const pending = verifySignature(token, auto);
    await vi.advanceTimersByTimeAsync(8100);
    expect((await pending).state).toBe('error');
  });
  it('rejects oversized, invalid, private, or empty JWKS responses', async () => {
    for (const response of ['x'.repeat(1024 * 1024 + 1), '{}', JSON.stringify({ keys: [{ ...jwk, d: 'private' }] }), JSON.stringify({ keys: [] })]) {
      clearVerificationCache();
      vi.stubGlobal('fetch', vi.fn(async () => new Response(response)));
      expect((await verifySignature(token, auto)).state).toBe('error');
    }
  });
  it('reports no matching kid rather than claiming invalid signature', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'other-key' }] }))));
    expect((await verifySignature(token, auto)).state).toBe('missing-key');
  });
  it.each(['https://evil.example/a', 'http://sts.windows.net/11111111-1111-1111-1111-111111111111/', 'https://login.microsoftonline.com.evil.example/11111111-1111-1111-1111-111111111111/v2.0', 'https://login.microsoftonline.com@127.0.0.1/a', 'https://login.microsoftonline.com/common/v2.0', 'https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0?url=x', 'https://sts.windows.net/../../'])('does not turn an untrusted issuer into a request: %s', value => {
    expect(entraJwksUrl(value)).toBeUndefined();
  });
  it('maps the v2 issuer without fetching token-supplied key links', () => {
    expect(entraJwksUrl('https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0')).toBe('https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/discovery/v2.0/keys');
  });
});
