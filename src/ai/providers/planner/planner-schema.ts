import { z } from 'zod';

export const plannedTaskSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['backend', 'frontend', 'fullstack', 'qa', 'contract']),
  goal: z.string().min(1),
  scope: z.array(z.string().min(1)).min(1),
  acceptance: z.array(z.string().min(1)).min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
});

export const plannerResponseSchema = z.object({
  tasks: z.array(plannedTaskSchema).min(1),
});

export type PlannerResponse = z.infer<typeof plannerResponseSchema>;
