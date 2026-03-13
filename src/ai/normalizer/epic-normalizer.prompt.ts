export interface EpicNormalizerPromptInput {
  rawTitle: string;
  rawDescription: string;
}

export function buildEpicNormalizerPrompt(input: EpicNormalizerPromptInput): string {
  return [
    'You are an epic normalization engine.',
    'Normalize the raw epic into a structured, implementation-ready JSON object.',
    'Return JSON only. Do not include markdown or explanations.',
    '',
    'Schema:',
    '{',
    '  "title": string,',
    '  "goal": string,',
    '  "context": string[],',
    '  "scope": string[],',
    '  "outOfScope": string[],',
    '  "constraints": string[],',
    '  "acceptance": string[]',
    '}',
    '',
    'Rules:',
    '- title must be short and normalized',
    '- split scope into granular capabilities',
    '- split multi-action sentences into separate scope items',
    '- acceptance must be specific, testable, and not generic',
    '- avoid copying one large paragraph into scope',
    '- avoid generic acceptance such as "flow works"',
    '',
    'Raw Epic Title:',
    input.rawTitle.trim(),
    '',
    'Raw Epic Description:',
    input.rawDescription.trim() || '(empty)',
  ].join('\n');
}
