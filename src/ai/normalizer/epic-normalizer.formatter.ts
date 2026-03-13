import { NORMALIZED_EPIC_MARKER, NormalizedEpic } from './normalized-epic';

function bullet(items: string[]): string {
  if (items.length === 0) {
    return '- none';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

export function formatNormalizedEpicDescription(epic: NormalizedEpic): string {
  return [
    'Goal:',
    epic.goal,
    '',
    'Context:',
    bullet(epic.context),
    '',
    'Scope:',
    bullet(epic.scope),
    '',
    'Out of scope:',
    bullet(epic.outOfScope),
    '',
    'Constraints:',
    bullet(epic.constraints),
    '',
    'Acceptance:',
    bullet(epic.acceptance),
    '',
    NORMALIZED_EPIC_MARKER,
  ].join('\n');
}
