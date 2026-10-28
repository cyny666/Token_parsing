import { describe, expect, it } from 'vitest';
import { base64url } from 'jose';
import { inspectToken, MAX_INPUT_BYTES } from '../src/core';
import { modes } from '../src/modes';

const jwt = `${base64url.encode('{"alg":"RS256"}')}.${base64url.encode('{"sub":"synthetic-secret","exp":1}')}.AA`;
const jwe = `${base64url.encode('{"alg":"dir","enc":"A256GCM"}')}..AA.AA.AA`;

describe('purpose entry boundaries', () => {
  for (const purpose of ['access', 'id'] as const) {
    for (const input of [jwt, jwe, 'opaque-example', 'abc.def.ghi']) {
      it(`${purpose} keeps existing inspection for ${input === jwt ? 'JWT' : input === jwe ? 'JWE' : input}`, () => {
        expect(modes[purpose].canDecode).toBe(true);
        expect(modes[purpose].inspect(input)).toEqual(inspectToken(input));
      });
    }
  }

  it.each([[jwt, 'JWT'], [jwe, 'JWE'], ['opaque-example', 'Opaque / Unknown']])('refresh only exposes format for %s', (input, format) => {
    const result = modes.refresh.inspect(input);
    expect(modes.refresh.canDecode).toBe(false);
    expect(result.format).toBe(format);
    expect(result.header).toBeUndefined();
    expect(result.claims).toBeUndefined();
    expect(result.fields).toEqual([]);
    expect(result.times).toEqual({});
    expect(result.evidence).toEqual([]);
    expect(result.verification).toBe('not-performed');
    expect(JSON.stringify(result)).not.toContain('synthetic-secret');
  });

  it.each([
    ['empty', ''], ['bare Bearer', 'Bearer '], ['whitespace', 'a b'],
    ['malformed JWT', 'abc.def.ghi'], ['oversize', 'x'.repeat(MAX_INPUT_BYTES + 1)],
  ])('refresh retains validation errors: %s', (_label, input) => {
    const result = modes.refresh.inspect(input);
    expect(result.status).toBe('error');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.claims).toBeUndefined();
  });
});
