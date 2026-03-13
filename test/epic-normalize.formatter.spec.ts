import { formatNormalizedEpicDescription } from '../src/ai/normalizer/epic-normalizer.formatter';
import { NORMALIZED_EPIC_MARKER } from '../src/ai/normalizer/normalized-epic';

describe('Epic normalizer description formatter', () => {
  it('renders normalized epic into the expected Trello description format', () => {
    const description = formatNormalizedEpicDescription({
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
        'customers can create an appointment',
        'unavailable slots cannot be booked',
      ],
    });

    expect(description).toContain('Goal:');
    expect(description).toContain('Context:');
    expect(description).toContain('Scope:');
    expect(description).toContain('Out of scope:');
    expect(description).toContain('Constraints:');
    expect(description).toContain('Acceptance:');
    expect(description).toContain(NORMALIZED_EPIC_MARKER);
  });
});
