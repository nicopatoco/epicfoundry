import { PlanEpicInput, PlannedTask } from '../ai.types';

export interface PlannerAgent {
  planEpic(input: PlanEpicInput): Promise<PlannedTask[]>;
}
