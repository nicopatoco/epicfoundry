import { E2EInput, E2EResult } from '../ai.types';

export interface E2EAgent {
  runE2E(input: E2EInput): Promise<E2EResult>;
}
