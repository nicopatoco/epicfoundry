import { z } from 'zod';

export interface NormalizedEpic {
  title: string;
  goal: string;
  context: string[];
  scope: string[];
  outOfScope: string[];
  constraints: string[];
  acceptance: string[];
}

export const normalizedEpicSchema: z.ZodType<NormalizedEpic> = z.object({
  title: z.string().min(1),
  goal: z.string().min(1),
  context: z.array(z.string().min(1)),
  scope: z.array(z.string().min(1)).min(1),
  outOfScope: z.array(z.string().min(1)),
  constraints: z.array(z.string().min(1)),
  acceptance: z.array(z.string().min(1)).min(1),
});

export const NORMALIZED_EPIC_MARKER = 'EpicFoundry: epic normalized';
