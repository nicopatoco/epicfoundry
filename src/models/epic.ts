import { z } from 'zod';

export interface Epic {
  id?: string;
  sourceCardId?: string;
  rawTitle: string;
  rawDescription: string;
  title: string;
  goal?: string;
  context?: string[];
  scope?: string[];
  outOfScope?: string[];
  constraints?: string[];
  acceptance?: string[];
  project?: string;
  status?: string;
  parsingMode?: 'structured' | 'heuristic';
}

export const epicSchema: z.ZodType<Epic> = z.object({
  id: z.string().optional(),
  sourceCardId: z.string().optional(),
  rawTitle: z.string().min(1),
  rawDescription: z.string(),
  title: z.string().min(1),
  goal: z.string().optional(),
  context: z.array(z.string().min(1)).optional(),
  scope: z.array(z.string().min(1)).optional(),
  outOfScope: z.array(z.string().min(1)).optional(),
  constraints: z.array(z.string().min(1)).optional(),
  acceptance: z.array(z.string().min(1)).optional(),
  project: z.string().optional(),
  status: z.string().optional(),
  parsingMode: z.enum(['structured', 'heuristic']).optional(),
});
