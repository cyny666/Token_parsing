export interface ProviderMatch {
  name: string;
  evidence: string[];
  descriptions: Record<string, string>;
  hint?: (key: string, value: unknown) => string | undefined;
}

const entraDescriptions: Record<string, string> = {
  ver: '访问 Token 版本声明（1.0 或 2.0）。',
  iss: '签发 Token 的 STS 地址与租户；以 /v2.0 结尾为 v2.0 发行方。声明未验证，可信度依赖验签与校验。',
  aud: '预期受众；v2 中通常为 API 的客户端 ID，v1 中可为客户端 ID 或资源 URI。资源方必须校验，本工具不校验。',
  idp: '认证主体的身份提供方；跨租户来宾或联合场景下可能与 iss 不同，缺失时通常与 iss 相同。',
  aio: 'Entra ID 内部用于 Token 重用记录的不透明串，资源方不应使用。',
  acr: '认证上下文类（仅 v1）；0 表示认证未满足 ISO/IEC 29115 强度要求。',
  amr: '认证方法数组，如 pwd / rsa / mfa 等，标识主体的认证方式。',
  appid: '客户端应用 ID（仅 v1）；应用代表自身或代表用户行事。',
  azp: '获授权的客户端应用 ID（仅 v2），是 appid 的替代声明。',
  appidacr: '客户端认证方式（仅 v1）：0 公共客户端，1 客户端密钥，2 客户端证书。',
  azpacr: '客户端认证方式（仅 v2），appidacr 的替代声明：0 / 1 / 2 含义相同。',
  preferred_username: '主要用户名（仅 v2，需 profile scope）；可变，不能用于授权判断。',
  name: '主体的可读显示名；可变，仅供展示，不能用于授权判断。',
  scp: '声明的委托权限范围，空格分隔，仅出现在用户 Token；资源方应校验其确为 API 暴露的范围。',
  roles: '应用权限/角色数组；应用 Token 以它替代 scp，用户 Token 中为目标应用分配的角色。',
  wids: '租户级目录角色（RoleTemplateID GUID）数组，由应用清单的 groupMembershipClaims 配置控制。',
  groups: '组对象 ID 数组，由应用清单配置；成员组数超限时改用 overage 声明。',
  hasgroups: '恒为 true 表示用户至少属于一个组；组列表超限时需调用 Microsoft Graph 获取完整列表。',
  'groups:src1': '组列表 overage 的分布式声明占位（src1），完整组列表需按 _claim_sources 的端点获取。',
  _claim_names: '声明分发指针：指出哪些声明因体积超限被外置（如 groups overage）。',
  _claim_sources: '声明数据来源：包含获取外置声明完整内容的端点。',
  sub: '与 Token 关联的主体；按应用两两成对（pairwise），同一用户在不同应用会得到不同值。',
  oid: '请求方的不可变对象 ID；同一租户内跨应用一致，即 Graph 中的 id 属性。',
  tid: '登录租户 ID；个人 Microsoft 账户固定为 9188040d-6c67-4c5b-b112-36a304b66dad。',
  sid: '会话唯一标识，建立新会话时生成。',
  unique_name: '主体的可读唯一名称（仅 v1）；仅用于展示。',
  uti: 'Token 唯一标识（等同 JWT 规范的 jti），大小写敏感、逐 Token 唯一。',
  rh: 'Azure 内部用于 Token 重验证的不透明串，资源方不应使用。',
  xms_cc: '客户端能力数组；cp1 表示客户端可处理 claims challenge（条件访问 / CAE 场景）。',
  acrs: '认证上下文引用声明，标记持有者可执行操作的认证上下文，常与 xms_cc 搭配触发升级认证。',
  idtyp: '标识主体类型的可选声明（应用或用户）。',
  ipaddr: '用户认证来源 IP（v1 可选声明）。',
  onprem_sid: '本地 Active Directory 的用户 SID（混合部署场景）。',
  pwd_exp: '密码过期时间（Unix 秒，可选声明）。',
  pwd_url: '用户重置密码的 URL。',
  in_corp: '布尔值，提示客户端是否从企业网络登录。',
  nickname: '用户的其他名字（可选，仅供展示）。',
  family_name: '用户姓氏（用户对象上的显示属性，仅供展示）。',
  given_name: '用户名字（用户对象上的显示属性，仅供展示）。',
  upn: '用户主体名；仅用于展示与重新认证提示，不能用于授权判断。',
  email: '用户邮箱地址（可选声明）。',
};

const amrMeanings: Record<string, string> = {
  pwd: '密码或客户端密钥',
  rsa: 'RSA 密钥证明（如 Authenticator）',
  otp: '邮件或短信一次性验证码',
  fed: '联合身份断言（SAML/JWT）',
  wia: 'Windows 集成身份验证',
  mfa: '多因素认证',
  ngcmfa: '下一代凭据 MFA',
  wiaormfa: 'Windows 或 MFA 凭据',
  none: '未完成认证',
};
const clientAuthMeanings: Record<string, string> = { '0': '公共客户端', '1': '客户端密钥', '2': '客户端证书' };
const consumerTenant = '9188040d-6c67-4c5b-b112-36a304b66dad';
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function entraHint(key: string, value: unknown): string | undefined {
  switch (key) {
    case 'amr':
      if (Array.isArray(value)) {
        const matched = value.filter((item): item is string => typeof item === 'string')
          .map(item => (amrMeanings[item] ? `${item}=${amrMeanings[item]}` : item));
        if (matched.length) return `方法匹配：${matched.join('、')}。`;
      }
      return;
    case 'appidacr':
    case 'azpacr': {
      const meaning = clientAuthMeanings[String(value)];
      return meaning ? `取值匹配：${meaning}。` : undefined;
    }
    case 'acr':
      return String(value) === '0' ? '取值匹配：认证未满足 ISO/IEC 29115 强度要求。' : undefined;
    case 'ver':
      if (value === '1.0') return '取值匹配：v1.0 访问 Token。';
      if (value === '2.0') return '取值匹配：v2.0 访问 Token。';
      return;
    case 'iss':
      if (typeof value !== 'string') return;
      if (value.includes(consumerTenant)) return '取值匹配：签发自个人 Microsoft 账户（消费者）租户。';
      if (value.endsWith('/v2.0')) return '取值匹配：v2.0 发行方格式。';
      if (/^https:\/\/sts\.windows\.net\//i.test(value)) return '取值匹配：v1.0 发行方格式。';
      return;
    case 'tid':
      return typeof value === 'string' && value.toLowerCase() === consumerTenant
        ? '取值匹配：个人 Microsoft 账户（消费者）租户。' : undefined;
    case 'aud':
      if (typeof value === 'string' && guidPattern.test(value)) return '取值匹配：GUID 形式受众，v2 中通常是 API 的客户端 ID。';
      if (typeof value === 'string' && value.startsWith('api://')) return '取值匹配：Application ID URI 形式受众。';
      return;
    case 'scp':
      if (typeof value === 'string' && value.trim()) return `取值匹配：共 ${value.trim().split(/\s+/).length} 项委托权限。`;
      return;
    case 'roles':
    case 'wids':
    case 'groups':
      return Array.isArray(value) ? `取值匹配：共 ${value.length} 项。` : undefined;
    case 'hasgroups':
      return value === true ? '取值匹配：仅表示至少属于一个组；完整列表需在超限时调用 Graph 获取。' : undefined;
    case '_claim_names':
    case '_claim_sources':
      return '取值匹配：声明因体积超限已外置（overage），需按来源端点获取完整内容。';
    case 'xms_cc':
      return Array.isArray(value) && value.includes('cp1') ? '取值匹配：包含 cp1，客户端支持 claims challenge。' : undefined;
    default:
      return;
  }
}

function entra(claims: Record<string, unknown>): ProviderMatch | undefined {
  if (typeof claims.iss !== 'string') return;
  try {
    const url = new URL(claims.iss);
    const hosts = ['sts.windows.net', 'login.microsoftonline.com', 'login.microsoftonline.us', 'login.chinacloudapi.cn'];
    if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port) return;
    return { name: '可能为 Microsoft Entra ID', evidence: ['iss 主机名匹配已知 Entra 发行域名（声明未验证）。'], descriptions: entraDescriptions, hint: entraHint };
  } catch { return; }
}

const providers = [entra];
export function identifyProvider(claims: Record<string, unknown>): ProviderMatch | undefined {
  return providers.map(provider => provider(claims)).find(Boolean);
}
