import { compactVerify, createLocalJWKSet, importSPKI, importX509, base64url, type JSONWebKeySet, type JWK } from 'jose';
import { inspectToken, MAX_INPUT_BYTES } from './core';

export const ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512', 'EdDSA', 'HS256', 'HS384', 'HS512'] as const;
export type SignatureState = 'verified' | 'invalid' | 'missing-key' | 'unsupported' | 'error';
export interface SignatureResult { state: SignatureState; message: string; source?: string }
export interface VerifyInput {
  mode: 'entra' | 'manual';
  algorithm: string;
  key: string;
  base64Secret?: boolean;
  signal?: AbortSignal;
}
const cache = new Map<string, { expires: number; keys: JSONWebKeySet }>();
export function clearVerificationCache() { cache.clear(); }

// Issuer data never becomes an arbitrary URL. Only two exact global Entra issuer shapes are accepted.
export function entraJwksUrl(issuer: unknown): string | undefined {
  if (typeof issuer !== 'string' || /\s/.test(issuer)) return;
  const guid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const v1 = issuer.match(new RegExp(`^https://sts\\.windows\\.net/(${guid})/$`, 'i'));
  if (v1) return `https://login.microsoftonline.com/${v1[1].toLowerCase()}/discovery/keys`;
  const v2 = issuer.match(new RegExp(`^https://login\\.microsoftonline\\.com/(${guid})/v2\\.0$`, 'i'));
  if (v2) return `https://login.microsoftonline.com/${v2[1].toLowerCase()}/discovery/v2.0/keys`;
}

function publicSet(value: unknown): JSONWebKeySet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('key');
  const document = value as Record<string, unknown>;
  const keys = Object.hasOwn(document, 'keys') ? document.keys : [document];
  if (!Array.isArray(keys) || !keys.length || keys.length > 128) throw new Error('key');
  for (const key of keys) {
    if (!key || typeof key !== 'object' || Array.isArray(key) || !['RSA', 'EC', 'OKP'].includes(key.kty)) throw new Error('key');
    if (['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'].some(field => Object.hasOwn(key, field))) throw new Error('private');
  }
  return { keys: keys as JWK[] };
}

async function remoteKeys(url: string, signal?: AbortSignal): Promise<JSONWebKeySet> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.keys;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetch(url, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store', signal: controller.signal });
    if (!response.ok || !response.body) throw new Error('network');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '', bytes = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 1024 * 1024) throw new Error('size');
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    const keys = publicSet(JSON.parse(text));
    controller.signal.throwIfAborted();
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(url, { keys, expires: Date.now() + 5 * 60_000 });
    return keys;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function verifySignature(input: string, options: VerifyInput): Promise<SignatureResult> {
  const result = inspectToken(input);
  if (result.status !== 'decoded') return { state: 'unsupported', message: '仅对可解码的签名 JWT 验签；JWE / 不透明 Token 不适用。' };
  const token = input.trim().replace(/^Bearer(?:\s+|$)/i, '').trim();
  if (result.header?.alg === 'none' || !token.split('.')[2]) return { state: 'unsupported', message: '无签名 Token，不能通过签名验证。' };
  const alg = options.mode === 'entra' ? 'RS256' : options.algorithm;
  if (!ALGORITHMS.includes(alg as typeof ALGORITHMS[number])) return { state: 'unsupported', message: '不支持该验签算法。' };
  if (result.header?.alg !== alg) return { state: 'unsupported', message: `算法不匹配：当前验签策略仅允许 ${alg}，未执行签名验证。请切换手动密钥并选择预期算法。` };
  let source: string;
  let key: Parameters<typeof compactVerify>[1];
  if (options.mode === 'entra') {
    const url = entraJwksUrl(result.claims?.iss);
    if (!url) return { state: 'missing-key', message: '没有受支持的 Entra 发行方。请切换手动密钥，提供可信公钥或共享密钥。' };
    if (typeof result.header?.kid !== 'string' || !result.header.kid) return { state: 'missing-key', message: '缺少 kid，不能自动选择微软签名公钥。' };
    source = url;
    try { key = createLocalJWKSet(await remoteKeys(url, options.signal)); }
    catch { return { state: 'error', message: '无法获取微软公钥（网络、CORS、超时或响应异常）；签名未验证。可切换手动密钥离线验签。', source }; }
  } else {
    source = '用户提供的密钥（来源可信性由用户确认）';
    if (!options.key.length) return { state: 'missing-key', message: '等待输入公钥或共享密钥，输入后自动验签。', source };
    if (new TextEncoder().encode(options.key).length > MAX_INPUT_BYTES) return { state: 'error', message: '密钥输入超过 64 KiB。', source };
    try {
      if (alg.startsWith('HS')) {
        if (/^\s*(?:-----BEGIN|\{)/.test(options.key)) throw new Error('key');
        const secret = options.base64Secret ? base64url.decode(options.key.trim()) : new TextEncoder().encode(options.key);
        const min = Number(alg.slice(2)) / 8;
        if (secret.byteLength < min) return { state: 'error', message: `${alg} 共享密钥至少需要 ${min} 字节。`, source };
        key = secret;
      } else if (options.key.trim().startsWith('{')) key = createLocalJWKSet(publicSet(JSON.parse(options.key)));
      else if (options.key.trim().startsWith('-----BEGIN CERTIFICATE-----')) key = await importX509(options.key.trim(), alg);
      else key = await importSPKI(options.key.trim(), alg);
    } catch { return { state: 'error', message: '密钥格式错误或不适用于所选算法；只接受公钥/证书/JWK(S)，不要输入私钥。', source }; }
  }
  try {
    options.signal?.throwIfAborted();
    await compactVerify(token, key, { algorithms: [alg] });
    options.signal?.throwIfAborted();
    return { state: 'verified', message: '签名匹配（Signature Verified）', source };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'ERR_JWKS_NO_MATCHING_KEY') return { state: 'missing-key', message: '未找到与 kid / 算法匹配的公钥；可能发生密钥轮换。请切换手动密钥或清空后重试。', source };
    if (code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return { state: 'invalid', message: '签名不匹配（Invalid Signature）', source };
    return { state: 'error', message: '无法验签：密钥参数、关键扩展或算法不受支持；签名未验证。', source };
  }
}
