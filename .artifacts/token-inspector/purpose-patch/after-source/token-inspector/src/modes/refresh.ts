import { inspectToken, type InspectionResult } from '../core';
import type { TokenMode } from './types';

function inspectRefresh(input: string): InspectionResult {
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
  description: '用于请求新 Token 的凭据。此入口只识别格式，不执行刷新、换票、解密或验签。',
  canDecode: false,
  inspect: inspectRefresh,
};
