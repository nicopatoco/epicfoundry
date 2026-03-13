import { RefinedEpic } from '../../ai.types';

export function buildPlannerPrompt(refinedEpic: RefinedEpic): string {
  const scopeIn = refinedEpic.scopeIn.map((item) => `- ${item}`).join('\n');
  const scopeOut = refinedEpic.scopeOut.map((item) => `- ${item}`).join('\n');
  const acceptance = refinedEpic.acceptanceCriteria.map((item) => `- ${item}`).join('\n');
  const openQuestions = refinedEpic.openQuestions.map((item) => `- ${item}`).join('\n');

  return [
    'Given the following refined software epic, generate a list of development tasks.',
    'Return JSON with shape: { "tasks": PlannedTask[] }.',
    'Each task must include title, type, goal, scope, acceptance, and sourceRefs.',
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
    'Acceptance Criteria:',
    acceptance,
    '',
    'Open Questions:',
    openQuestions,
    '',
    'Recommended Approach:',
    refinedEpic.recommendedApproach,
    '',
    `Ready To Plan: ${refinedEpic.readyToPlan ? 'yes' : 'no'}`,
  ].join('\n');
}
