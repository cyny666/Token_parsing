export interface PermissionInfo { description: string; critical?: boolean }
export interface ClientAppInfo { name: string; note?: string; foci?: boolean; broci?: boolean; critical?: boolean }

// Curated from the GraphPreConsentExplorer dataset (top frequency values) plus the Microsoft
// Graph permission reference. `critical` marks tenant-wide / admin-consent / privilege
// escalation scopes; isCriticalPermission adds prefix rules for values not listed here.
export const GRAPH_PERMISSIONS: Record<string, PermissionInfo> = {
  openid: { description: 'OpenID Connect 基本范围' },
  profile: { description: '基本个人信息' },
  email: { description: '邮箱地址' },
  offline_access: { description: '获取刷新 Token，可持续获取新访问 Token' },
  user_impersonation: { description: '以登录用户身份调用目标 API（Azure 资源管理器等常见）' },
  full_access_as_app: { description: '应用身份完全访问，无用户上下文（应用权限）', critical: true },
  'User.Read': { description: '读取当前登录用户基本信息' },
  'User.Read.All': { description: '读取所有用户基本信息' },
  'User.ReadBasic.All': { description: '读取所有用户基本目录信息' },
  'User.ReadWrite': { description: '更新当前登录用户资料' },
  'User.ReadWrite.All': { description: '创建和更新所有用户（高权限）', critical: true },
  'User.Invite.All': { description: '邀请外部来宾用户' },
  'User.Export.All': { description: '按 DLP 策略导出用户数据' },
  'User.ManageIdentities.All': { description: '管理用户身份链接与合并' },
  'Application.Read.All': { description: '读取所有应用与服务主体' },
  'Application.ReadWrite.All': { description: '创建、删除、修改应用与服务主体（高权限）', critical: true },
  'AppRoleAssignment.ReadWrite.All': { description: '为任意应用/服务主体分配角色（可提权）', critical: true },
  'DelegatedPermissionGrant.ReadWrite.All': { description: '代表任意用户授予委托权限（可提权）', critical: true },
  'ServicePrincipalEndpoint.Read.All': { description: '读取服务主体终结点' },
  'Organization.Read.All': { description: '读取组织信息' },
  'Domain.Read.All': { description: '读取域名信息' },
  'Domain.ReadWrite.All': { description: '管理域名与域名验证（高权限）', critical: true },
  'Group.Read.All': { description: '读取所有组' },
  'Group.ReadWrite.All': { description: '创建和更新组' },
  'GroupMember.Read.All': { description: '读取所有组的成员' },
  'Directory.Read.All': { description: '读取目录中几乎全部数据（高权限）', critical: true },
  'Directory.ReadWrite.All': { description: '创建和修改目录对象（高权限）', critical: true },
  'Directory.AccessAsUser.All': { description: '以租户中任意用户身份访问目录（高权限）', critical: true },
  'Directory.Write.Restricted': { description: '受限的目录写入（高权限）', critical: true },
  'People.Read': { description: '读取常用联系人（People API）' },
  'People.Read.All': { description: '读取组织中人员信息' },
  'Files.Read': { description: '读取当前用户可访问的文件' },
  'Files.Read.All': { description: '读取当前用户可访问的全部文件' },
  'Files.ReadWrite': { description: '读写当前用户可访问的文件' },
  'Files.ReadWrite.All': { description: '读写当前用户可访问的全部文件（含共享）' },
  'FileStorageContainer.Selected': { description: '访问选定的文件存储容器' },
  'Sites.Read.All': { description: '读取所有站点' },
  'Sites.ReadWrite.All': { description: '读写所有站点' },
  'Sites.FullControl.All': { description: '完全控制所有站点（高权限）', critical: true },
  'Calendars.Read': { description: '读取当前用户日历' },
  'Calendars.Read.Shared': { description: '读取共享给当前用户的日历' },
  'Calendars.ReadWrite': { description: '读写当前用户日历' },
  'Calendars.ReadWrite.Shared': { description: '读写共享给当前用户的日历' },
  'Mail.Read': { description: '读取当前用户邮箱' },
  'Mail.ReadWrite': { description: '读写当前用户邮箱' },
  'Mail.ReadWrite.All': { description: '读写租户中所有邮箱（高权限）', critical: true },
  'Mail.Send': { description: '以当前用户身份发送邮件' },
  'MailboxSettings.Read': { description: '读取邮箱设置' },
  'MailboxSettings.ReadWrite': { description: '修改邮箱设置（时区、自动回复等）' },
  'Contacts.Read': { description: '读取当前用户联系人' },
  'Contacts.ReadWrite': { description: '读写当前用户联系人' },
  'Tasks.ReadWrite': { description: '读写任务（Microsoft To Do）' },
  'Notes.ReadWrite.All': { description: '读写 OneNote 笔记本' },
  'Notes.Create': { description: '创建 OneNote 笔记本' },
  'Chat.Read': { description: '读取用户聊天' },
  'Chat.ReadBasic': { description: '读取聊天基本信息' },
  'Chat.ReadWrite': { description: '读写用户聊天' },
  'Chat.Create': { description: '为当前用户发起聊天' },
  'ChatMessage.Send': { description: '发送聊天消息' },
  'Channel.ReadBasic.All': { description: '读取频道基本信息' },
  'Channel.Create': { description: '创建频道' },
  'ChannelMessage.Send': { description: '向频道发送消息' },
  'Team.ReadBasic.All': { description: '读取团队基本信息' },
  'TeamMember.ReadWrite.All': { description: '管理团队成员与所有者' },
  'TeamsAppInstallation.ReadForTeam': { description: '读取团队已安装应用' },
  'TeamsAppInstallation.ReadWriteForTeam': { description: '管理团队已安装应用' },
  'TeamsTab.Create': { description: '创建团队标签页' },
  'AppCatalog.Read.All': { description: '读取应用目录（Teams 应用商店）' },
  'AppCatalog.ReadWrite.All': { description: '管理应用目录' },
  'Presence.Read.All': { description: '读取所有用户在线状态' },
  'InformationProtectionPolicy.Read': { description: '读取信息保护策略' },
  'SensitivityLabel.Read': { description: '读取敏感度标签' },
  'AuditLog.Read.All': { description: '读取审计日志与签入日志' },
  'Reports.Read.All': { description: '读取 Microsoft 365 使用情况报告' },
  'Policy.Read.All': { description: '读取所有租户策略' },
  'Policy.Read.IdentityProtection': { description: '读取身份保护策略' },
  'Policy.ReadWrite.ConditionalAccess': { description: '修改条件访问策略（高权限）', critical: true },
  'Policy.ReadWrite.AuthenticationFlows': { description: '修改身份验证流策略（高权限）', critical: true },
  'Policy.ReadWrite.AuthenticationMethod': { description: '修改身份验证方法策略（高权限）', critical: true },
  'Policy.ReadWrite.Authorization': { description: '修改授权策略（高权限）', critical: true },
  'Policy.ReadWrite.ApplicationConfiguration': { description: '修改应用配置策略（高权限）', critical: true },
  'Policy.ReadWrite.IdentityProtection': { description: '修改身份保护策略（高权限）', critical: true },
  'Policy.ReadWrite.MobilityManagement': { description: '修改设备移动性（MDM/MAM）策略（高权限）', critical: true },
  'Policy.ReadWrite.ExternalIdentities': { description: '修改外部标识策略（高权限）', critical: true },
  'RoleManagement.Read.Directory': { description: '读取目录角色分配与资格' },
  'RoleManagement.ReadWrite.Directory': { description: '修改目录角色分配，可直接提权（高权限）', critical: true },
  'AccessReview.ReadWrite.All': { description: '创建和管理访问评审（高权限）', critical: true },
  'EntitlementManagement.Read.All': { description: '读取 Entitlement Management' },
  'EntitlementManagement.ReadWrite.All': { description: '管理 Entitlement Management（高权限）', critical: true },
  'ConsentRequest.Create': { description: '创建管理员同意请求' },
  'ConsentRequest.ReadApprove.All': { description: '审批管理员同意请求（高权限）', critical: true },
  'ConsentRequest.ReadWrite.All': { description: '管理同意请求' },
  'Device.Read.All': { description: '读取设备对象' },
  'DeviceManagementConfiguration.Read.All': { description: '读取 Intune 设备配置' },
  'DeviceManagementConfiguration.ReadWrite.All': { description: '修改 Intune 设备配置（高权限）', critical: true },
  'DeviceManagementManagedDevices.Read.All': { description: '读取 Intune 托管设备' },
  'CloudPC.Read.All': { description: '读取 Windows 365 云 PC' },
  'UserAuthenticationMethod.Read': { description: '读取当前用户认证方法' },
  'UserAuthenticationMethod.ReadWrite': { description: '修改当前用户认证方法' },
  'UserAuthenticationMethod.ReadWrite.All': { description: '修改所有用户认证方法，可重置 MFA（高权限）', critical: true },
  'IdentityProvider.ReadWrite.All': { description: '管理身份提供方（联合/密码重置）（高权限）', critical: true },
  'IdentityRiskEvent.ReadWrite.All': { description: '读取并处理身份风险事件' },
  'IdentityRiskyUser.ReadWrite.All': { description: '读取并处置风险用户' },
  'CrossTenantInformation.ReadBasic.All': { description: '读取跨租户合作伙伴信息' },
  'EduRoster.ReadBasic': { description: '读取教育名册基本信息' },
  'PrinterShare.ReadBasic.All': { description: '读取打印机共享基本信息' },
  'Family.Read': { description: '读取 Microsoft 家庭组数据' },
  'SecurityEvents.ReadWrite.All': { description: '读取并处理安全事件（高权限）', critical: true },
};

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

export function permissionInfo(value: string): PermissionInfo | undefined {
  const known = GRAPH_PERMISSIONS[value];
  if (known) return known.critical ? known : isCriticalPermission(value) ? { ...known, critical: true } : known;
  if (isCriticalPermission(value)) return { description: '按命名规则匹配为高权限范围（未收录详细说明）', critical: true };
  return;
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
