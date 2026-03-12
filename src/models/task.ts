export type TaskType =
  | 'api-contract'
  | 'backend-endpoint'
  | 'frontend-form'
  | 'e2e-verification'
  | 'generic';

export interface Task {
  title: string;
  type: TaskType;
  goal: string;
  acceptance: string[];
  epicTitle: string;
}
