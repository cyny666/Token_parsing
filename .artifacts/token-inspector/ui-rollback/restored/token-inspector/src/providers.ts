export interface ProviderMatch { name: string; evidence: string[]; descriptions: Record<string, string> }

const entraDescriptions: Record<string, string> = {
  ver: '声明的 Token 版本（通常为 1.0 或 2.0）。',
  tid: '租户标识；这是未验证的声明。',
  oid: '对象标识，通常用于标识租户中的用户或服务主体。',
  appid: '客户端应用 ID（常见于 v1 Token）。',
  azp: '获授权的客户端应用 ID（常见于 v2 Token）。',
  scp: '声明的委托权限范围，通常由空格分隔；不代表实际调用必然获准。',
  roles: '声明的角色或应用权限；不能仅凭该字段确定 Token 用途或授权结果。',
};

function entra(claims: Record<string, unknown>): ProviderMatch | undefined {
  if (typeof claims.iss !== 'string') return;
  try {
    const url = new URL(claims.iss);
    const hosts = ['sts.windows.net', 'login.microsoftonline.com', 'login.microsoftonline.us', 'login.chinacloudapi.cn'];
    if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port) return;
    return { name: '可能为 Microsoft Entra ID', evidence: ['iss 主机名匹配已知 Entra 发行域名（声明未验证）。'], descriptions: entraDescriptions };
  } catch { return; }
}

const providers = [entra];
export function identifyProvider(claims: Record<string, unknown>): ProviderMatch | undefined {
  return providers.map(provider => provider(claims)).find(Boolean);
}
