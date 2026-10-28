import { describe, expect, it } from 'vitest';
import { AUDIENCES, CLIENT_APPS, GRAPH_PERMISSIONS, audienceNames, clientApp, permissionInfo, roleValues, splitScopes } from '../src/permissions';

describe('value matching data', () => {
  it('keeps curated permissions consistent', () => {
    const entries = Object.entries(GRAPH_PERMISSIONS);
    expect(entries.length).toBeGreaterThanOrEqual(100);
    for (const [name, info] of entries) {
      expect(info.description, name).toBeTruthy();
      if (info.critical) expect(info.description, name).toMatch(/权限|提权|完全控制/);
    }
    expect(GRAPH_PERMISSIONS['User.Read'].critical).toBeFalsy();
    expect(GRAPH_PERMISSIONS['Directory.Read.All'].critical).toBe(true);
    expect(GRAPH_PERMISSIONS['full_access_as_app'].critical).toBe(true);
  });

  it('marks known high-privilege values critical, including prefix rules', () => {
    expect(permissionInfo('Directory.Read.All')?.critical).toBe(true);
    expect(permissionInfo('RoleManagement.ReadWrite.Directory')?.critical).toBe(true);
    expect(permissionInfo('Policy.ReadWrite.ConditionalAccess')?.critical).toBe(true);
    expect(permissionInfo('PrivilegedAccess.ReadWrite.AzureADGroup')?.critical).toBe(true);
    expect(permissionInfo('User.Read')?.critical).toBeFalsy();
    expect(permissionInfo('Policy.Read.All')?.critical).toBeFalsy();
    expect(permissionInfo('unknown_custom_scope')).toBeUndefined();
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
