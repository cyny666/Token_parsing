import { describe, expect, it } from 'vitest';
import { AUDIENCES, CLIENT_APPS, GRAPH_PERMISSIONS, audienceNames, clientApp, permissionContext, permissionInfo, roleValues, splitScopes } from '../src/permissions';

describe('value matching data', () => {
  const graph = '00000003-0000-0000-c000-000000000000';
  const delegated = permissionContext({ aud: graph, scp: 'User.Read' }, 'access', 'scp');
  const application = permissionContext({ aud: graph, idtyp: 'app' }, 'access', 'roles');

  it('keeps the scoped Graph dictionary separated by permission type', () => {
    expect(Object.keys(GRAPH_PERMISSIONS).length).toBeGreaterThan(50);
    for (const definition of Object.values(GRAPH_PERMISSIONS)) {
      for (const info of Object.values(definition)) expect(info.description).toBeTruthy();
    }
    expect(GRAPH_PERMISSIONS['User.Read'].delegated).toBeDefined();
    expect(GRAPH_PERMISSIONS['User.Read'].application).toBeUndefined();
    expect(GRAPH_PERMISSIONS['Mail.Read'].delegated?.description).toContain('已登录');
    expect(GRAPH_PERMISSIONS['Mail.Read'].application?.description).toContain('所有邮箱');
    expect(permissionInfo('full_access_as_app', delegated)).toBeUndefined();
    expect(permissionInfo('user_impersonation', delegated)).toBeUndefined();
  });

  it('marks only exact known Graph permissions, never unknown prefix lookalikes', () => {
    expect(permissionInfo('Directory.Read.All', delegated)?.critical).toBe(true);
    expect(permissionInfo('RoleManagement.ReadWrite.Directory', application)?.critical).toBe(true);
    expect(permissionInfo('Policy.ReadWrite.ConditionalAccess', delegated)?.critical).toBe(true);
    expect(permissionInfo('User.Read', delegated)?.critical).toBe(false);
    expect(permissionInfo('Policy.Read.All', delegated)?.critical).toBe(false);
    for (const name of ['PrivilegedAccess.ReadWrite.AzureADGroup', 'Directory.Read.MadeUp', 'unknown_custom_scope', 'constructor', '__proto__', 'toString']) {
      expect(permissionInfo(name, delegated)).toBeUndefined();
    }
    expect(permissionInfo('User.Read', application)).toBeUndefined();
    expect(permissionInfo('Directory.AccessAsUser.All', application)).toBeUndefined();
    expect(permissionInfo('User.Read.All', application)?.description).not.toBe(permissionInfo('User.Read.All', delegated)?.description);
  });

  it.each([graph, '00000003-0000-0000-C000-000000000000', 'https://graph.microsoft.com', 'https://graph.microsoft.com/'])('recognizes exact Graph audience %s', aud => {
    const context = permissionContext({ aud }, 'access', 'scp');
    expect(context.resource).toBe('graph');
    expect(permissionInfo('User.Read', context)).toBeDefined();
  });

  it.each([
    undefined, null, 42, {}, [], [graph], [graph, 'api://custom'], ['api://custom', graph],
    'api://custom', 'c44b4083-3bb0-49c1-b47d-974e53cbdf3c', '797f4846-ba00-4fd7-ba43-dac1f8f63013',
    'https://graph.microsoft.com.evil', 'https://graph.microsoft.com/v1.0', 'https://graph.microsoft.com?x=1',
    ' https://graph.microsoft.com', 'https://management.azure.com/', 'constructor',
  ])('does not infer permissions for unsupported audience %#', aud => {
    const context = permissionContext({ aud }, 'access', 'scp');
    expect(context.resource).toBeUndefined();
    expect(permissionInfo('Directory.Read.All', context)).toBeUndefined();
    const app = permissionContext({ aud, idtyp: 'app' }, 'access', 'roles');
    expect(app.resource).toBeUndefined();
    expect(permissionInfo('Mail.Read', app)).toBeUndefined();
  });

  it('does not classify roles without positive app-only evidence as application permissions', () => {
    for (const claims of [{ aud: graph }, { aud: graph, scp: 'User.Read' }, { aud: graph, idtyp: 'user' }]) {
      const context = permissionContext(claims, 'access', 'roles');
      expect(context.kind).toBe('app-role');
      expect(permissionInfo('RoleManagement.ReadWrite.Directory', context)).toBeUndefined();
    }
    expect(application.kind).toBe('application');
    for (const scp of ['', null, 42, 'User.Read', undefined]) {
      const context = permissionContext({ aud: graph, idtyp: 'app', scp }, 'access', 'roles');
      expect(context.kind).toBe('app-role');
      expect(context.notice).toContain('冲突');
      expect(permissionInfo('Mail.Read', context)).toBeUndefined();
      const scope = permissionContext({ aud: graph, idtyp: 'app', scp }, 'access', 'scp');
      expect(scope.resource).toBeUndefined();
      expect(scope.notice).toContain('冲突');
      expect(permissionInfo('User.Read', scope)).toBeUndefined();
    }
  });

  it('keeps directory roles and ID/Refresh entry claims out of API permission dictionaries', () => {
    const directory = permissionContext({ aud: graph }, 'access', 'wids');
    expect(directory.kind).toBe('directory-role');
    expect(directory.label).toContain('目录角色');
    expect(permissionInfo('Directory.Read.All', directory)).toBeUndefined();
    for (const purpose of ['id', 'refresh'] as const) {
      for (const claim of ['scp', 'roles'] as const) {
        const context = permissionContext({ aud: graph, idtyp: 'app' }, purpose, claim);
        expect(context.resource).toBeUndefined();
        expect(permissionInfo('User.Read.All', context)).toBeUndefined();
      }
    }
  });

  it('splits scope strings and role arrays defensively', () => {
    expect(splitScopes('User.Read  Mail.Send')).toEqual(['User.Read', 'Mail.Send']);
    expect(splitScopes('   ')).toEqual([]);
    expect(splitScopes(42)).toEqual([]);
    expect(roleValues(['a', 1, 'b'])).toEqual(['a', 'b']);
    expect(roleValues('nope')).toEqual([]);
  });

  it('maps verified first-party client IDs to names and red-marks FOCI/BroCi clients', () => {
    expect(CLIENT_APPS['04b07795-8ddb-461a-bbee-02f9e1bf7b46']?.name).toBe('Microsoft Azure CLI');
    expect(CLIENT_APPS['1fec8e78-bce4-4aaf-ab1b-5451cc387264']?.foci).toBe(true);
    expect(CLIENT_APPS['9ba1a5c7-f17a-4de9-a1f1-6178c8d51223']?.note).toContain('条件访问');
    expect(clientApp('74658136-14ec-4630-ad9b-26e160ff0fc6')?.critical).toBe(true);
    expect(clientApp('1fec8e78-bce4-4aaf-ab1b-5451cc387264')?.critical).toBe(true);
    expect(clientApp('c44b4083-3bb0-49c1-b47d-974e53cbdf3c')?.critical).toBe(true);
    expect(clientApp('04b07795-8ddb-461a-bbee-02f9e1bf7b46')?.critical).toBeFalsy();
    expect(clientApp('1950a258-227b-4e31-a9cf-717495945fc2')?.critical).toBeFalsy();
    expect(clientApp('00000000-0000-0000-0000-000000000000')).toBeUndefined();
    for (const [id, app] of Object.entries(CLIENT_APPS)) {
      expect(id, app.name).toMatch(/^[0-9a-f-]{36}$/);
      if (app.foci || app.broci) expect(clientApp(id)?.critical, app.name).toBe(true);
    }
  });

  it('maps audience GUIDs and URLs to API names', () => {
    expect(AUDIENCES['00000003-0000-0000-c000-000000000000']).toBe('Microsoft Graph');
    expect(audienceNames('00000003-0000-0000-c000-000000000000')).toEqual(['Microsoft Graph']);
    expect(audienceNames(['https://management.azure.com/', 'unknown'])).toEqual(['Azure 资源管理器']);
    expect(audienceNames({})).toEqual([]);
  });

  it('maps known application audiences without copying client risk labels', () => {
    expect(audienceNames('c44b4083-3bb0-49c1-b47d-974e53cbdf3c')).toEqual(['Azure Portal']);
    expect(audienceNames('C44B4083-3BB0-49C1-B47D-974E53CBDF3C')).toEqual(['Azure Portal']);
    expect(audienceNames(['00000003-0000-0000-c000-000000000000', 'c44b4083-3bb0-49c1-b47d-974e53cbdf3c', 'unknown', null]))
      .toEqual(['Microsoft Graph', 'Azure Portal']);
  });

  it('does not resolve unknown or inherited audience keys', () => {
    expect(audienceNames(['constructor', '__proto__', 'toString', '11111111-1111-1111-1111-111111111111'])).toEqual([]);
    expect(audienceNames('https://graph.microsoft.com/unknown')).toEqual([]);
  });
});
