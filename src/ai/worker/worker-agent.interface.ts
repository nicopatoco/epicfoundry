import { TaskExecutionInput, TaskExecutionResult } from '../ai.types';

export interface WorkerAgent {
  executeTask(input: TaskExecutionInput): Promise<TaskExecutionResult>;
}
