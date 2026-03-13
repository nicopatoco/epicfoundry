import { RefinedEpic } from '../../models/refined-epic';
import {
  REFINED_EPIC_JSON_HEADER,
  REFINEMENT_GENERATED_MARKER,
} from './refinement.constants';

export function formatRefinementComment(refinedEpic: RefinedEpic): string {
  const inScope = refinedEpic.scopeIn.map((item) => `- ${item}`).join('\n');
  const outOfScope = refinedEpic.scopeOut.map((item) => `- ${item}`).join('\n');
  const assumptions = refinedEpic.assumptions.map((item) => `- ${item}`).join('\n');
  const openQuestions = refinedEpic.openQuestions.map((item) => `- ${item}`).join('\n');
  const acceptance = refinedEpic.acceptanceCriteria
    .map((item) => `- ${item}`)
    .join('\n');

  return [
    'EpicFoundry refinement proposal',
    '',
    'Summary:',
    refinedEpic.summary,
    '',
    'Suggested scope (V1):',
    inScope,
    '',
    'Out of scope:',
    outOfScope,
    '',
    'Assumptions:',
    assumptions,
    '',
    'Open questions:',
    openQuestions,
    '',
    'Acceptance criteria:',
    acceptance,
    '',
    'Recommended approach:',
    refinedEpic.recommendedApproach,
    '',
    `Ready to plan: ${refinedEpic.readyToPlan ? 'yes' : 'no'}`,
    '',
    REFINED_EPIC_JSON_HEADER,
    '',
    '```json',
    JSON.stringify(refinedEpic, null, 2),
    '```',
    '',
    REFINEMENT_GENERATED_MARKER,
  ].join('\n');
}
