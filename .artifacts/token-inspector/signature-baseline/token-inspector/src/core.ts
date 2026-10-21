import { decodeJwt, decodeProtectedHeader, base64url } from 'jose';
import { identifyProvider } from './providers';

export const MAX_INPUT_BYTES = 64 * 1024;
export interface Field { name: string; value: unknown; description: string }
export interface InspectionResult {
  format: 'JWT' | 'JWE' | 'Opaque / Unknown' | 'Invalid';
  status: 'decoded' | 'encrypted' | 'opaque' | 'error';
  verification: 'not-performed';
  header?: Record<string, unknown>;
  claims?: Record<string, unknown>;
  provider: string;
  evidence: string[];
  fields: Field[];
  times: Record<string, string>;
  warnings: string[];
}
const common: Record<string, string> = {
  iss: '签发者声明；未经验证，不能作为可信来源。', sub: '主体标识，其含义取决于签发者。',
  aud: '目标受众，可能是字符串或字符串数组；不是本工具实际验证的受众。',
  exp: '声明的过期时间，Unix 秒。', nbf: '声明的最早生效时间，Unix 秒。', iat: '声明的签发时间，Unix 秒。',
  jti: 'Token 标识，不代表服务端尚未撤销。', scope: '声明的权限范围，不代表实际授权结果。',
};
const headerDescriptions: Record<string, string> = {
  alg: '声明的算法；本工具不使用它验证签名。', typ: '声明的媒体类型，不足以确定 Access / Refresh 用途。',
  kid: '密钥标识；本工具不获取密钥。', enc: '声明的内容加密算法。', cty: '声明的内容类型。',
  jku: '声明的密钥集地址；本工具不会访问。', x5u: '声明的证书地址；本工具不会访问。', crit: '关键扩展；本工具不验证扩展语义。',
};
function ownDescription(map: Record<string, string>, key: string): string | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}
function segmentValid(segment: string, empty = false): boolean {
  if (!segment) return empty;
  if (!/^[A-Za-z0-9_-]+$/.test(segment) || segment.length % 4 === 1) return false;
  try { return base64url.encode(base64url.decode(segment)) === segment; } catch { return false; }
}
export function inspectToken(input: string, now = Date.now()): InspectionResult {
  const result: InspectionResult = { format: 'Invalid', status: 'error', verification: 'not-performed', provider: '未知 / 未识别', evidence: [], fields: [], times: {}, warnings: ['仅解码与解释：未验证签名、签发者或受众，也未检查撤销状态及实际可用性。'] };
  const fail = (message: string) => { result.warnings.push(message); return result; };
  if (new TextEncoder().encode(input).length > MAX_INPUT_BYTES) return fail('输入超过 64 KiB，请缩短输入。');
  const token = input.trim().replace(/^Bearer(?:\s+|$)/i, '').trim();
  if (!token) return fail('请输入一个 Token。');
  if (/\s/.test(token)) return fail('Token 内部含空白，请仅输入单个完整 Token。');
  const parts = token.split('.');
  if (parts.length !== 3 && parts.length !== 5) {
    result.format = 'Opaque / Unknown'; result.status = 'opaque';
    result.warnings.push('无法识别为受支持的紧凑 JWT/JWE，可能是不透明 Token 或其他格式；无法读取身份、权限和有效期。', 'Entra ID Refresh Token 由平台加密，不能在此解密。不能仅凭字符串确定其用途。');
    return result;
  }
  try {
    const isJwe = parts.length === 5;
    if (!parts.every((part, i) => segmentValid(part, isJwe ? i === 1 || i === 3 : i === 2))) return fail('疑似 JWT/JWE，但包含非法或非规范 Base64URL 分段。');
    const header = decodeProtectedHeader(token) as Record<string, unknown>;
    if (typeof header.alg !== 'string' || !header.alg) return fail('疑似 JWT/JWE，但缺少有效的 alg 头部。');
    if (isJwe) {
      if (typeof header.enc !== 'string' || !header.enc) return fail('疑似 JWE，但缺少有效的 enc 头部。');
      result.format = 'JWE'; result.status = 'encrypted'; result.header = header;
      result.warnings.push('仅识别 JWE 紧凑结构，未验证加密参数或完整性。载荷已加密，本工具不解密，也不推断内部声明。');
    } else {
      const claims = decodeJwt(token) as Record<string, unknown>;
      result.format = 'JWT'; result.status = 'decoded'; result.header = header; result.claims = claims;
      if (header.alg === 'none' || parts[2] === '') result.warnings.push('Token 声明无签名或签名段为空；不可将其视为可信凭据。');
      const provider = identifyProvider(claims);
      if (provider) { result.provider = provider.name; result.evidence = provider.evidence; }
      for (const key of ['exp', 'nbf', 'iat']) {
        if (!Object.hasOwn(claims, key)) continue;
        const value = claims[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(new Date(value * 1000).getTime())) {
          result.warnings.push(`${key} 不是可显示的 Unix 秒时间。`); continue;
        }
        result.times[key] = new Date(value * 1000).toISOString();
        if (key === 'exp' && now >= value * 1000) result.warnings.push('按 exp 声明已过期（使用本机时钟，非有效性验证）。');
        if (key === 'nbf' && now < value * 1000) result.warnings.push('按 nbf 声明尚未生效（使用本机时钟）。');
        if (key === 'iat' && now < value * 1000) result.warnings.push('iat 声明位于未来，请检查本机时钟及声明内容。');
      }
      if (!Object.hasOwn(claims, 'exp')) result.warnings.push('缺少 exp 声明，无法展示声明的过期时间。');
      if (Object.hasOwn(claims, 'aud') && !(typeof claims.aud === 'string' || (Array.isArray(claims.aud) && claims.aud.every(v => typeof v === 'string')))) result.warnings.push('aud 类型异常，通常应为字符串或字符串数组。');
      result.fields = Object.entries(claims).map(([key, value]) => ({ name: `payload.${key}`, value, description: ownDescription(provider?.descriptions ?? {}, key) ?? ownDescription(common, key) ?? '未知或平台自定义声明，保留原值，不推断含义。' }));
    }
    result.fields.unshift(...Object.entries(header).map(([key, value]) => ({ name: `header.${key}`, value, description: ownDescription(headerDescriptions, key) ?? '未解释的公开头部字段，保留原值。' })));
    return result;
  } catch { return fail('疑似 JWT/JWE，但头部或载荷无法解码为受支持的 JSON 对象。'); }
}
