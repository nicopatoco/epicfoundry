import {
  runNormalizedEpicQualityChecks,
  validateNormalizedEpic,
} from '../src/ai/normalizer/epic-normalizer.validation';

describe('Epic normalizer validation', () => {
  it('accepts a valid normalized epic payload', () => {
    const payload = {
      title: 'Booking system',
      goal: 'Allow customers to manage appointments online.',
      context: ['beauty salon', 'single professional'],
      scope: [
        'customers can view available appointment slots',
        'customers can create appointments',
      ],
      outOfScope: ['payments'],
      constraints: ['initial version supports only one professional'],
      acceptance: [
        'customers can view available appointment slots',
        'customers can create an appointment',
      ],
    };

    const normalized = validateNormalizedEpic(payload);
    const quality = runNormalizedEpicQualityChecks(
      normalized,
      'raw epic description text',
    );

    expect(normalized.title).toBe('Booking system');
    expect(quality.valid).toBe(true);
    expect(quality.errors).toHaveLength(0);
  });

  it('rejects generic non-verifiable acceptance criteria', () => {
    const payload = {
      title: 'Booking system',
      goal: 'Allow customers to manage appointments online.',
      context: ['beauty salon'],
      scope: ['customers can create appointments'],
      outOfScope: [],
      constraints: [],
      acceptance: ['flow works'],
    };

    const normalized = validateNormalizedEpic(payload);
    const quality = runNormalizedEpicQualityChecks(
      normalized,
      'raw epic description text',
    );

    expect(quality.valid).toBe(false);
    expect(quality.errors).toEqual(
      expect.arrayContaining(['acceptance contains generic non-verifiable criteria']),
    );
  });
});
