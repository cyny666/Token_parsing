import { base64url } from 'jose';

// Synthetic envelope: known GUID bytes, arbitrary prefix/trailer and a NON-secret fake payload.
// IDs are fixed public sample values; no real RT/PRT or key is used.
export const tenantId = '1ce8c5a4-782d-4bef-b3a5-6e7e51a795f9';
export const brokerId = '38aa3b87-a06d-4817-b275-7a316988d93b';
export const descriptor = Uint8Array.from(
  '010100a4c5e81c2d78ef4bb3a56e7e51a795f9873baa386da01748b2757a316988d93b0000000000'.match(/../g)!,
  value => parseInt(value, 16),
);
export const opaqueText = 'SYNTHETIC_OPAQUE_NOT_REAL';
export function refreshFixture(version = '1', bytes = descriptor): string {
  return `${version}.${base64url.encode(bytes)}.${base64url.encode(opaqueText)}`;
}
