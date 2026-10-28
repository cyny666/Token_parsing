import { base64url } from 'jose';
import { MAX_INPUT_BYTES } from './core';

export interface RefreshStructure {
  version: '1';
  descriptorBytes: 40;
  prefixHex: string;
  tenantId: string;
  clientId: string;
  trailerHex: string;
  opaqueBytes: number;
}

export type RefreshStructureResult =
  | { kind: 'matched'; metadata: RefreshStructure }
  | { kind: 'unsupported' | 'invalid'; message: string }
  | { kind: 'unrecognized' };

function decodeSegment(value: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return;
  try {
    const bytes = base64url.decode(value);
    return base64url.encode(bytes) === value ? bytes : undefined;
  } catch { return; }
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

// .NET GUIDs store the first 4/2/2-byte groups little-endian, not all 16 bytes reversed.
function dotNetGuid(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [
    view.getUint32(0, true).toString(16).padStart(8, '0'),
    view.getUint16(4, true).toString(16).padStart(4, '0'),
    view.getUint16(6, true).toString(16).padStart(4, '0'),
    hex(bytes.subarray(8, 10)),
    hex(bytes.subarray(10, 16)),
  ].join('-');
}

// Experimental sample layout, NOT a Microsoft-guaranteed RT/PRT protocol:
// https://insinuator.net/2026/10/token-theft-in-microsoft-entra-id-part-3-of-4-token-protection/
export function parseRefreshStructure(input: string): RefreshStructureResult {
  if (new TextEncoder().encode(input).length > MAX_INPUT_BYTES) {
    return { kind: 'invalid', message: '输入超过 64 KiB，请缩短输入。' };
  }
  const token = input.trim().replace(/^Bearer(?:\s+|$)/i, '').trim();
  if (!token) return { kind: 'unrecognized' };
  if (/\s/.test(token)) return { kind: 'invalid', message: 'Token 内部含空白，请仅输入单个完整 Token。' };
  const parts = token.split('.');
  if (parts.length === 1 || !/^\d+$/.test(parts[0])) return { kind: 'unrecognized' };
  if (parts.length !== 3) return { kind: 'invalid', message: '候选 RT/PRT 应包含版本、描述段和不透明载荷三段；已停止解释。' };
  if (parts[0] !== '1') return { kind: 'unsupported', message: '未支持此版本；只按研究样例解释版本 1，已停止解释。' };
  const descriptor = decodeSegment(parts[1]);
  if (!descriptor) return { kind: 'invalid', message: '描述段不是规范 Base64URL 编码；已停止解释。' };
  if (descriptor.length !== 40) return { kind: 'unsupported', message: '描述段长度不为 40 字节，与研究样例布局不符；已停止解释。' };
  const opaque = decodeSegment(parts[2]);
  if (!opaque) return { kind: 'invalid', message: '不透明载荷为空或不是规范 Base64URL 编码；已停止解释。' };
  return {
    kind: 'matched',
    metadata: {
      version: '1', descriptorBytes: 40,
      prefixHex: hex(descriptor.subarray(0, 3)),
      tenantId: dotNetGuid(descriptor.subarray(3, 19)),
      clientId: dotNetGuid(descriptor.subarray(19, 35)),
      trailerHex: hex(descriptor.subarray(35, 40)),
      opaqueBytes: opaque.length,
    },
  };
}
