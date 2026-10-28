import { describe, expect, it } from 'vitest';
import { base64url } from 'jose';
import { MAX_INPUT_BYTES, inspectToken } from '../src/core';
import { modes } from '../src/modes';
import { parseRefreshStructure } from '../src/refresh-structure';
import { brokerId, descriptor, opaqueText, refreshFixture, tenantId } from './fixtures/refresh-structure';

describe('experimental RT/PRT public descriptor', () => {
  it('decodes exact offsets and .NET GUID byte order, not the opaque payload', () => {
    const result = parseRefreshStructure(refreshFixture());
    expect(result).toEqual({
      kind: 'matched',
      metadata: {
        version: '1', descriptorBytes: 40, prefixHex: '010100', tenantId, clientId: brokerId,
        trailerHex: '0000000000', opaqueBytes: new TextEncoder().encode(opaqueText).length,
      },
    });
    expect(JSON.stringify(result)).not.toContain(opaqueText);
    expect(JSON.stringify(result)).not.toContain(base64url.encode(opaqueText));
  });

  it('supports trimmed inputs and Bearer without modifying or uploading them', () => {
    const value = refreshFixture();
    expect(parseRefreshStructure(` \n bEaReR ${value} \r\n`)).toEqual(parseRefreshStructure(value));
  });

  it.each(['0', '2', '01', '999'])('does not infer fields for unsupported version %s', version => {
    expect(parseRefreshStructure(refreshFixture(version))).toMatchObject({ kind: 'unsupported' });
    expect(modes.refresh.inspect(refreshFixture(version)).refreshStructure).toBeUndefined();
  });

  it.each([1, 16, 39, 41, 48])('stops interpretation for %s descriptor bytes', length => {
    const result = parseRefreshStructure(refreshFixture('1', new Uint8Array(length)));
    expect(result).toMatchObject({ kind: 'unsupported' });
    expect('metadata' in result).toBe(false);
  });

  const segment = base64url.encode(descriptor);
  it.each([
    ['empty descriptor', '1..AA'], ['illegal alphabet', '1.@@@.AA'],
    ['padded descriptor', `1.${segment}==.AA`], ['noncanonical bits', `1.${segment.slice(0, -1)}B.AA`],
    ['empty payload', `1.${segment}.`], ['illegal payload', `1.${segment}.??`],
    ['noncanonical payload', `1.${segment}.AB`], ['missing segment', `1.${segment}`],
    ['extra segment', `1.${segment}.AA.AA`], ['internal space', `1.${segment}.A A`],
  ])('rejects %s without exposing partial IDs', (_label, value) => {
    const parsed = parseRefreshStructure(value);
    expect(parsed).toMatchObject({ kind: 'invalid' });
    const result = modes.refresh.inspect(value);
    expect(result.status).toBe('error');
    expect(result.refreshStructure).toBeUndefined();
    expect(result.fields).toEqual([]);
  });

  it('enforces the UTF-8 byte limit before decoding', () => {
    for (const value of ['x'.repeat(MAX_INPUT_BYTES + 1), 'é'.repeat(MAX_INPUT_BYTES / 2 + 1)]) {
      expect(parseRefreshStructure(value)).toMatchObject({ kind: 'invalid', message: expect.stringContaining('64 KiB') });
    }
  });

  it.each(['', 'Bearer ', 'opaque-example', 'abc.def.ghi'])('leaves other inputs to existing classification: %s', value => {
    expect(parseRefreshStructure(value)).toMatchObject({ kind: 'unrecognized' });
    expect(modes.refresh.inspect(value).refreshStructure).toBeUndefined();
  });

  it('does not interpret an outer JWT/PRT Cookie or change Access/ID decoding', () => {
    const cookie = `${base64url.encode('{"alg":"HS256","kdf_ver":2}')}.${base64url.encode(JSON.stringify({ refresh_token: refreshFixture() }))}.AA`;
    expect(parseRefreshStructure(cookie)).toMatchObject({ kind: 'unrecognized' });
    expect(modes.refresh.inspect(cookie).refreshStructure).toBeUndefined();
    expect(modes.refresh.inspect(cookie).claims).toBeUndefined();
    for (const purpose of ['access', 'id'] as const) {
      expect(modes[purpose].inspect(refreshFixture())).toEqual(inspectToken(refreshFixture()));
    }
  });

  it('keeps matched structure separate from verified identity, claims and lifetime', () => {
    const result = modes.refresh.inspect(refreshFixture());
    expect(result.format).toBe('Entra RT / PRT（候选结构）');
    expect(result.status).toBe('opaque');
    expect(result.verification).toBe('not-performed');
    expect(result.refreshStructure?.tenantId).toBe(tenantId);
    expect(result.header).toBeUndefined();
    expect(result.claims).toBeUndefined();
    expect(result.fields).toEqual([]);
    expect(result.times).toEqual({});
    expect(result.warnings.join(' ')).toMatch(/实验性/);
    expect(result.warnings.join(' ')).toMatch(/不解密/);
    expect(result.warnings.join(' ')).toMatch(/不确认/);
  });
});
