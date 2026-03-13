import { EpicRefinementResult } from '../ai.types';
import {
  REFINED_EPIC_JSON_HEADER,
  REFINEMENT_GENERATED_MARKER,
} from './refinement.constants';

export function formatRefinementComment(result: EpicRefinementResult): string {
  const inScope = result.suggestedScope.in.map((item) => `- ${item}`).join('\n');
  const outOfScope = result.suggestedScope.out
    .map((item) => `- ${item}`)
    .join('\n');
  const openQuestions = result.openQuestions
    .map((item) => `- ${item}`)
    .join('\n');

  return [
    'EpicFoundry refinement proposal',
    '',
    'Summary:',
    result.summary,
    '',
    'Suggested scope (V1):',
    inScope,
    '',
    'Out of scope for V1:',
    outOfScope,
    '',
    'Open questions:',
    openQuestions,
    '',
    'Recommended V1 approach:',
    result.recommendedApproach,
    '',
    REFINED_EPIC_JSON_HEADER,
    '',
    '```json',
    JSON.stringify(result.refinedEpic, null, 2),
    '```',
    '',
    REFINEMENT_GENERATED_MARKER,
  ].join('\n');
}
