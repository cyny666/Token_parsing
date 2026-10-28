import type { InspectionResult } from '../core';

export type TokenPurpose = 'access' | 'id' | 'refresh';
export interface TokenMode {
  label: string;
  description: string;
  canDecode: boolean;
  inspect(input: string): InspectionResult;
}
