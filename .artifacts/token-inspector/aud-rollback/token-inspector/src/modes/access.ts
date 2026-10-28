import { inspectToken } from '../core';
import type { TokenMode } from './types';

export const accessMode: TokenMode = {
  label: 'Access Token',
  description: '用于访问 API 的凭据。查看可解码声明与签名匹配结果，不代表 API 实际授权成功。',
  canDecode: true,
  inspect: inspectToken,
};
