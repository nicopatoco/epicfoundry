import { EpicNormalizationWorkflowService } from '../src/ai/normalizer/epic-normalization-workflow.service';
import { AiEpicNormalizerService } from '../src/ai/normalizer/epic-normalizer.service';
import { NORMALIZED_EPIC_MARKER } from '../src/ai/normalizer/normalized-epic';
import { AppLogger } from '../src/common/logger/app-logger.service';
import { TrelloService } from '../src/trello/trello.service';

describe('Epic normalization workflow', () => {
  it('skips cards already marked as normalized', async () => {
    const trelloMock = {
      getEpics: jest.fn().mockResolvedValue([
        {
          id: 'card-1',
          name: 'EPIC: Booking system',
          desc: `Goal:\n...\n\n${NORMALIZED_EPIC_MARKER}`,
          idList: 'list-epic',
        },
      ]),
      getCardComments: jest.fn().mockResolvedValue([]),
      updateCardDescription: jest.fn(),
      addComment: jest.fn(),
    } as unknown as TrelloService;

    const normalizerMock = {
      normalizeRawEpic: jest.fn(),
    } as unknown as AiEpicNormalizerService;

    const workflow = new EpicNormalizationWorkflowService(
      trelloMock,
      normalizerMock,
      new AppLogger(),
    );

    const summary = await workflow.run();

    expect(summary.normalized).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(0);
    expect(normalizerMock.normalizeRawEpic).not.toHaveBeenCalled();
    expect(trelloMock.updateCardDescription).not.toHaveBeenCalled();
  });
});
