import { z } from 'zod';

export interface RefinedEpic {
  title: string;
  summary: string;
  scopeIn: string[];
  scopeOut: string[];
  assumptions: string[];
  openQuestions: string[];
  acceptanceCriteria: string[];
  recommendedApproach: string;
  readyToPlan: boolean;
}

export const refinedEpicSchema: z.ZodType<RefinedEpic> = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  scopeIn: z.array(z.string().min(1)),
  scopeOut: z.array(z.string().min(1)),
  assumptions: z.array(z.string().min(1)),
  openQuestions: z.array(z.string().min(1)),
  acceptanceCriteria: z.array(z.string().min(1)),
  recommendedApproach: z.string().min(1),
  readyToPlan: z.boolean(),
});
