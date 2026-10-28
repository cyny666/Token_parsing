import { GRAPH_PERMISSIONS } from './graph-permissions';
import type { TokenPurpose } from './modes/types';
export { GRAPH_PERMISSIONS } from './graph-permissions';

export interface PermissionInfo { description: string; critical?: boolean }
export interface ClientAppInfo { name: string; note?: string; foci?: boolean; broci?: boolean; critical?: boolean }

function isCriticalPermission(name: string): boolean {
  return name === 'full_access_as_app' ||
    name === 'Sites.FullControl.All' ||
    name === 'User.ReadWrite.All' ||
    name.startsWith('Directory.Read') ||
    name.startsWith('Directory.Write') ||
    name.startsWith('Directory.Access') ||
    name.startsWith('RoleManagement.ReadWrite') ||
    name === 'RoleManagement.Read.Directory' ||
    name.startsWith('Application.ReadWrite') ||
    name.startsWith('AppRoleAssignment.ReadWrite') ||
    name.startsWith('DelegatedPermissionGrant.ReadWrite') ||
    name.startsWith('UserAuthenticationMethod.ReadWrite') ||
    name.startsWith('IdentityProvider.ReadWrite') ||
    name.startsWith('Policy.ReadWrite') ||
    name.startsWith('Privileged') ||
    name.startsWith('AccessReview.ReadWrite') ||
    name.startsWith('EntitlementManagement.ReadWrite') ||
    name.startsWith('ConsentRequest.ReadApprove') ||
    name.startsWith('ConsentRequest.ReadWrite') ||
    name.startsWith('Mail.ReadWrite.All') ||
    name.startsWith('DeviceManagementConfiguration.ReadWrite') ||
    name.startsWith('SecurityEvents.ReadWrite');
}

export type PermissionClaim = 'scp' | 'roles' | 'wids';
export type PermissionKind = 'delegated' | 'application' | 'app-role' | 'directory-role';
export interface PermissionContext {
  resource?: 'graph';
  kind: PermissionKind;
  label: string;
  notice: string;
}

export function permissionContext(claims: Record<string, unknown>, purpose: TokenPurpose, claim: PermissionClaim): PermissionContext {
  // Only exact single-resource aliases select a dictionary; display-name matching is not enough.
  const aud = typeof claims.aud === 'string' ? claims.aud : undefined;
  const graph = aud !== undefined && (
    aud.toLowerCase() === '00000003-0000-0000-c000-000000000000' ||
    aud === 'https://graph.microsoft.com' || aud === 'https://graph.microsoft.com/'
  );
  const hasScopes = Object.hasOwn(claims, 'scp');
  const conflicting = claims.idtyp === 'app' && hasScopes;
  const resource = purpose === 'access' && graph && !conflicting ? 'graph' as const : undefined;
  const appOnly = purpose === 'access' && claims.idtyp === 'app' && !hasScopes;
  const kind: PermissionKind = claim === 'scp' ? 'delegated' : claim === 'wids' ? 'directory-role' : appOnly ? 'application' : 'app-role';
  const label = {
    delegated: '委托权限范围（scp）',
    application: '应用权限（idtyp=app 线索，未验证）',
    'app-role': '应用角色（roles，未判定为应用权限）',
    'directory-role': '目录角色（wids / RoleTemplateID）',
  }[kind];
  let notice: string;
  if (kind === 'directory-role') notice = '保留目录角色原值；目录角色不是 API 的 scope 或应用权限，不套用 Graph 权限字典。';
  else if (conflicting) notice = 'idtyp=app 与 scp 同时出现，主体线索冲突；保留原值，不套用 Graph 权限字典。';
  else if (kind === 'app-role') notice = 'roles 也可表示用户在目标应用的角色；缺少明确的应用权限上下文，保留原值，不套用 Graph 应用权限字典。';
  else if (purpose !== 'access') notice = '当前不是 Access Token 入口，不将声明值解释为 API 权限；保留原值。';
  else if (!resource) notice = '当前 aud 未匹配已收录的单一资源权限字典；保留原值，不套用 Microsoft Graph 说明或推断高危。';
  else notice = `按 aud 声明匹配 Microsoft Graph ${kind === 'delegated' ? '委托' : '应用'}权限字典；仅静态解释，不验证实际授权或可用性。`;
  return { resource, kind, label, notice };
}

export function permissionInfo(value: string, context: PermissionContext): PermissionInfo | undefined {
  if (context.resource !== 'graph' || (context.kind !== 'delegated' && context.kind !== 'application')) return;
  if (!Object.hasOwn(GRAPH_PERMISSIONS, value)) return;
  const known = GRAPH_PERMISSIONS[value][context.kind];
  if (!known) return;
  return { ...known, critical: isCriticalPermission(value) };
}

// First-party client IDs verified against the GraphPreConsentExplorer dataset
// (name / foci / broci / notes) plus two widely documented Microsoft Graph tool clients.
export const CLIENT_APPS: Record<string, ClientAppInfo> = {
  // MS-OAPXBC Appendix A, note 4: Windows broker client identifier.
  '38aa3b87-a06d-4817-b275-7a316988d93b': { name: 'Microsoft Authentication Broker' },
  '04b07795-8ddb-461a-bbee-02f9e1bf7b46': { name: 'Microsoft Azure CLI', note: '常用默认客户端；Graph 预授权权限较多' },
  '1950a258-227b-4e31-a9cf-717495945fc2': { name: 'Microsoft Azure PowerShell' },
  '14d82eec-204b-4c2f-b7e8-296a70dab67f': { name: 'Microsoft Graph PowerShell', note: 'Graph 官方 PowerShell SDK 客户端' },
  'de8bc8b5-d9f9-48b1-a8ad-b748da72f014': { name: 'Microsoft Graph Explorer', note: '官方 Graph 调试工具' },
  'c44b4083-3bb0-49c1-b47d-974e53cbdf3c': { name: 'Azure Portal', note: '可作为 BroCi 经纪客户端换票', broci: true },
  'b677c290-cf4b-4a8e-a60e-91ba650a4abe': { name: 'AzurePortal Console App', note: '支持 BroCi 换票', broci: true },
  '74658136-14ec-4630-ad9b-26e160ff0fc6': { name: 'ADIbizaUX', note: '门户 UX 组件；预授权大量目录高权限，可经 BroCi 换票', broci: true },
  '50aaa389-5a33-4f1a-91d7-2c45ecd8dac8': { name: 'Microsoft_Azure_PIMCommon', note: 'PIM 组件；预授权特权角色管理，可经 BroCi 换票', broci: true },
  'd3590ed6-52b3-4102-aeff-aad2292ab01c': { name: 'Microsoft Office', foci: true },
  '1fec8e78-bce4-4aaf-ab1b-5451cc387264': { name: 'Microsoft Teams', foci: true },
  '4813382a-8fa7-425e-ab75-3b753aab3abb': { name: 'Microsoft Authenticator App', foci: true },
  'b26aadf8-566f-4478-926f-589f601d9c74': { name: 'OneDrive', foci: true },
  'c0d2a505-13b8-4ae0-aa9e-cddd5eab0b12': { name: 'Microsoft Power BI', foci: true },
  '9ba1a5c7-f17a-4de9-a1f1-6178c8d51223': { name: 'Microsoft Intune Company Portal', note: 'FOCI；可用于绕过要求合规设备的条件访问', foci: true },
  '872cd9fa-d31f-45e0-9eab-6e460a02d1f1': { name: 'Visual Studio - Legacy', foci: true },
  '0ec893e0-5785-4de6-99da-4ed124e5296c': { name: 'Office UWP PWA', foci: true },
  '26a7ee05-5602-4d76-a7ba-eae8b7b67941': { name: 'Windows Search', foci: true },
};

// FOCI and BroCi first-party clients are always highlighted as critical: their refresh
// tokens can be redeemed across sibling clients, which widens token-theft blast radius.
export function clientApp(id: string): ClientAppInfo | undefined {
  const app = CLIENT_APPS[id];
  if (!app) return;
  return app.critical || app.foci || app.broci ? { ...app, critical: true } : app;
}

export const AUDIENCES: Record<string, string> = {
  '00000003-0000-0000-c000-000000000000': 'Microsoft Graph',
  '00000002-0000-0000-c000-000000000000': 'Azure AD Graph（已弃用）',
  '797f4846-ba00-4fd7-ba43-dac1f8f63013': 'Azure 资源管理器 (ARM)',
  '00000003-0000-0ff1-ce00-000000000000': 'SharePoint / OneDrive',
  '00000009-0000-0000-c000-000000000000': 'Power BI 服务',
  '00000007-0000-0000-c000-000000000000': 'Dynamics CRM',
  'cc15fd57-2c6c-4117-a88c-83b1d56b4bb7': 'Microsoft Teams',
  'c5393580-f805-4401-95e8-94b7a6ef2fc2': 'Office 365 管理 API',
  'https://management.core.windows.net/': 'Azure 资源管理器（经典端点）',
  'https://management.azure.com/': 'Azure 资源管理器',
  'https://graph.microsoft.com': 'Microsoft Graph',
  'https://outlook.office365.com/': 'Exchange Online',
  'https://vault.azure.net': 'Azure Key Vault',
  'https://storage.azure.com/': 'Azure Storage 数据面',
};

export function splitScopes(value: unknown): string[] {
  return typeof value === 'string' && value.trim() ? value.trim().split(/\s+/) : [];
}

export function roleValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function audienceNames(value: unknown): string[] {
  const values = typeof value === 'string' ? [value]
    : Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string')
    : [];
  return values.map(item => {
    const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item) ? item.toLowerCase() : item;
    if (Object.hasOwn(AUDIENCES, id)) return AUDIENCES[id];
    // An audience can also be a known application ID (e.g. an ID Token's client).
    // A name match does not confirm token purpose, trust, or actual authorization.
    if (Object.hasOwn(CLIENT_APPS, id)) return CLIENT_APPS[id].name;
    return undefined;
  }).filter((name): name is string => typeof name === 'string');
}
