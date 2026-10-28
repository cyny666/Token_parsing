import { inspectToken, type InspectionResult } from '../core';
import { parseRefreshStructure } from '../refresh-structure';
import type { TokenMode } from './types';

function inspectRefresh(input: string): InspectionResult {
  const structure = parseRefreshStructure(input);
  if (structure.kind !== 'unrecognized') {
    const result: InspectionResult = {
      format: 'Opaque / Unknown', status: 'opaque', verification: 'not-performed',
      provider: '未知 / 未识别', evidence: [], fields: [], times: {},
      warnings: [
        '实验性结构解析：按研究样例推断，非微软稳定格式规范；不确认输入是真实 RT 或 PRT。',
        '只解码公开描述段，不解密载荷、不验签、不刷新或换票；无法据此判断用户身份、权限、有效期或实际可用性。',
      ],
    };
    if (structure.kind === 'matched') {
      result.format = 'Entra RT / PRT（候选结构）';
      result.refreshStructure = structure.metadata;
    } else {
      if (structure.kind === 'invalid') { result.format = 'Invalid'; result.status = 'error'; }
      result.warnings.unshift(structure.message);
    }
    return result;
  }
  const result = inspectToken(input);
  // Reuse format validation, but never pass decoded credentials to the view.
  return {
    format: result.format,
    status: result.status,
    verification: 'not-performed',
    provider: '未知 / 未识别',
    evidence: [],
    fields: [],
    times: {},
    warnings: result.status === 'error' ? result.warnings.slice(1) : [
      '仅识别输入格式，不展示声明、不解密、不验签，也不执行刷新或换票请求。',
      'Entra Refresh Token 只能由 Microsoft identity platform 读取；格式不能确认用途或实际可用性。',
    ],
  };
}

export const refreshMode: TokenMode = {
  label: 'Refresh Token',
  description: '实验性解码 RT/PRT 公开描述段中的租户与客户端 ID；不解密载荷，不执行刷新、换票或验签。',
  canDecode: false,
  inspect: inspectRefresh,
};
