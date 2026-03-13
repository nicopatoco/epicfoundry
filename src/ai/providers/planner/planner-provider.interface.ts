import { PlannedTask, ProviderName, RefinedEpic } from '../../ai.types';

export interface PlannerProvider {
  readonly name: ProviderName;
  planEpic(refinedEpic: RefinedEpic): Promise<PlannedTask[]>;
}
