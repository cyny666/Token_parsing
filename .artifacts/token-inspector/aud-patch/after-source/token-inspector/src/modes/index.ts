import { accessMode } from './access';
import { idMode } from './id';
import { refreshMode } from './refresh';
import type { TokenMode, TokenPurpose } from './types';

export type { TokenPurpose } from './types';
export const modes: Record<TokenPurpose, TokenMode> = {
  access: accessMode,
  id: idMode,
  refresh: refreshMode,
};
