import { buildEpicNormalizerPrompt } from '../src/ai/normalizer/epic-normalizer.prompt';

describe('Epic normalizer prompt builder', () => {
  it('includes raw epic input and required JSON schema fields', () => {
    const prompt = buildEpicNormalizerPrompt({
      rawTitle: 'EPIC: Booking system',
      rawDescription: 'Users can book, cancel, and reschedule appointments.',
    });

    expect(prompt).toContain('Raw Epic Title:');
    expect(prompt).toContain('EPIC: Booking system');
    expect(prompt).toContain('Raw Epic Description:');
    expect(prompt).toContain('book, cancel, and reschedule');
    expect(prompt).toContain('"title": string');
    expect(prompt).toContain('"scope": string[]');
    expect(prompt).toContain('"acceptance": string[]');
    expect(prompt).toContain('Return JSON only');
  });
});
