import { EpicRefinerService } from '../src/ai/refiner/epic-refiner.service';
import { AppLogger } from '../src/common/logger/app-logger.service';
import { EpicNormalizerService } from '../src/parser/epic-normalizer.service';

function normalizeAndRefine(input: { title: string; description: string }) {
  const logger = new AppLogger();
  const normalizer = new EpicNormalizerService(logger);
  const refiner = new EpicRefinerService(logger);

  const epic = normalizer.normalizeEpic({
    name: input.title,
    desc: input.description,
  });

  return refiner.refineEpic(epic);
}

function toLower(values: string[]): string[] {
  return values.map((item) => item.toLowerCase());
}

describe('Epic refinement behavior', () => {
  it('Scenario A: decomposes booking actions into granular scope and acceptance', async () => {
    const refined = await normalizeAndRefine({
      title: 'EPIC: Booking system',
      description:
        'I need something that lets my clients book appointments, cancel them, and maybe reschedule.',
    });

    const scopeIn = toLower(refined.scopeIn);
    const acceptance = toLower(refined.acceptanceCriteria);

    expect(scopeIn).toEqual(
      expect.arrayContaining([
        'customers can create appointments',
        'customers can cancel appointments',
        'customers can reschedule appointments',
      ]),
    );

    expect(acceptance.some((item) => item.includes('create an appointment'))).toBe(true);
    expect(acceptance.some((item) => item.includes('cancel an appointment'))).toBe(true);
    expect(acceptance.some((item) => item.includes('reschedule an appointment'))).toBe(true);
    expect(
      acceptance.some(
        (item) =>
          item.includes('unavailable slots cannot be booked') ||
          item.includes('unavailable appointments cannot be booked'),
      ),
    ).toBe(true);
  });

  it('Scenario B: keeps billing export scope focused and acceptance verifiable', async () => {
    const refined = await normalizeAndRefine({
      title: 'EPIC: Billing CSV export',
      description:
        'Admins should be able to export billing data by month. No frontend redesign is needed. CSV is enough for V1.',
    });

    const scopeIn = toLower(refined.scopeIn);
    const scopeOut = toLower(refined.scopeOut);
    const acceptance = toLower(refined.acceptanceCriteria);

    expect(scopeIn.some((item) => item.includes('export billing data by month'))).toBe(true);
    expect(scopeOut).toEqual(expect.arrayContaining(['frontend redesign']));
    expect(scopeOut.some((item) => item.includes('payments'))).toBe(false);
    expect(acceptance.some((item) => item.includes('csv'))).toBe(true);
    expect(acceptance.some((item) => item.includes('flow validated'))).toBe(false);
  });

  it('Scenario C: splits profile updates into display name and profile photo capabilities', async () => {
    const refined = await normalizeAndRefine({
      title: 'EPIC: Profile updates',
      description: 'Users should be able to update display name and profile photo.',
    });

    const scopeIn = toLower(refined.scopeIn);

    expect(scopeIn).toEqual(
      expect.arrayContaining([
        'users can update display name',
        'users can update profile photo',
      ]),
    );
    expect(scopeIn.every((item) => !item.includes(' and '))).toBe(true);
  });
});
