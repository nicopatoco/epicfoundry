import { normalizedEpicSchema, NormalizedEpic } from './normalized-epic';

export interface EpicNormalizationQualityCheck {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateNormalizedEpic(raw: unknown): NormalizedEpic {
  const parsed = normalizedEpicSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(
      `Normalized epic schema validation failed: ${parsed.error.issues
        .map((issue) => issue.message)
        .join('; ')}`,
    );
  }

  return parsed.data;
}

export function runNormalizedEpicQualityChecks(
  epic: NormalizedEpic,
  rawDescription: string,
): EpicNormalizationQualityCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (epic.title.split(/\s+/).length > 12) {
    warnings.push('title is still too long');
  }

  if (epic.scope.some((item) => item.length > 180 || item.split(/\s+/).length > 28)) {
    warnings.push('scope is too coarse');
  }

  if (epic.acceptance.length === 0) {
    errors.push('acceptance is empty');
  }

  if (
    epic.acceptance.some((item) =>
      /(flow works|flow validated|works end-to-end|primary user flow)/i.test(item),
    )
  ) {
    errors.push('acceptance contains generic non-verifiable criteria');
  }

  const normalizedRaw = rawDescription.toLowerCase().replace(/\s+/g, ' ').trim();
  const copiedScopeCount = epic.scope.filter((item) => {
    const normalizedItem = item.toLowerCase().replace(/\s+/g, ' ').trim();
    return normalizedItem.length > 0 && normalizedRaw.includes(normalizedItem);
  }).length;

  if (epic.scope.length > 0 && copiedScopeCount / epic.scope.length >= 0.8) {
    warnings.push('normalized output appears to copy raw text without structuring');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
