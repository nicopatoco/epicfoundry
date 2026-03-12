import { ManualQaInput, ManualQaReport } from '../ai.types';

export interface ManualQaAgent {
  runManualQa(input: ManualQaInput): Promise<ManualQaReport>;
}
