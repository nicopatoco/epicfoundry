import { z } from 'zod';

export type TaskType =
  | 'backend'
  | 'frontend'
  | 'fullstack'
  | 'qa'
  | 'contract'
  | 'bugfix';

export interface Task {
  title: string;
  type: TaskType;
  goal: string;
  scope: string[];
  acceptance: string[];
  sourceRefs: string[];
  project?: string;
  epicTitle: string;
  sourceEpicCardId?: string;
}

export const taskSchema: z.ZodType<Task> = z.object({
  title: z.string().min(1),
  type: z.enum(['backend', 'frontend', 'fullstack', 'qa', 'contract', 'bugfix']),
  goal: z.string().min(1),
  scope: z.array(z.string().min(1)),
  acceptance: z.array(z.string().min(1)).min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
  project: z.string().optional(),
  epicTitle: z.string().min(1),
  sourceEpicCardId: z.string().optional(),
});
