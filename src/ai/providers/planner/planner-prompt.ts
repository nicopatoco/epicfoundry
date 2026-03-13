import { RefinedEpic } from '../../ai.types';

export function buildPlannerPrompt(refinedEpic: RefinedEpic): string {
  const scopeIn = refinedEpic.scopeIn.map((item) => `- ${item}`).join('\n');
  const scopeOut = refinedEpic.scopeOut.map((item) => `- ${item}`).join('\n');

  return [
    'Given the following refined software epic, generate a list of development tasks.',
    'Return JSON with shape: { "tasks": PlannedTask[] }.',
    '',
    `Title: ${refinedEpic.title}`,
    '',
    'Summary:',
    refinedEpic.summary,
    '',
    'Scope In:',
    scopeIn,
    '',
    'Scope Out:',
    scopeOut,
    '',
    'Recommended Approach:',
    refinedEpic.recommendedApproach,
  ].join('\n');
}
