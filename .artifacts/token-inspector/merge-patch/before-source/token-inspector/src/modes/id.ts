import { inspectToken } from '../core';
import type { TokenMode } from './types';

export const idMode: TokenMode = {
  label: 'ID Token',
  description: '用于向客户端传递认证信息。复用通用字段说明与验签，不执行 ID Token 专属校验。',
  canDecode: true,
  inspect: inspectToken,
};
