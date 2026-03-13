import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/app-logger.service';
import { TrelloService } from '../../trello/trello.service';
import { formatNormalizedEpicDescription } from './epic-normalizer.formatter';
import { AiEpicNormalizerService } from './epic-normalizer.service';
import { NORMALIZED_EPIC_MARKER } from './normalized-epic';

export interface EpicNormalizationSummary {
  normalized: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class EpicNormalizationWorkflowService {
  constructor(
    private readonly trelloService: TrelloService,
    private readonly epicNormalizerService: AiEpicNormalizerService,
    private readonly logger: AppLogger,
  ) {}

  async run(): Promise<EpicNormalizationSummary> {
    const epics = await this.trelloService.getEpics();
    this.logger.log(`Found ${epics.length} epic${epics.length === 1 ? '' : 's'}`, 'Normalize');

    let normalized = 0;
    let skipped = 0;
    let failed = 0;

    for (const epicCard of epics) {
      this.logger.log(`Found raw epic: ${epicCard.name}`, 'Normalize');

      const comments = await this.trelloService.getCardComments(epicCard.id);
      const alreadyNormalized =
        epicCard.desc.includes(NORMALIZED_EPIC_MARKER) ||
        comments.some((comment) => comment.includes(NORMALIZED_EPIC_MARKER));

      if (alreadyNormalized) {
        skipped += 1;
        this.logger.log('Skipping epic (already normalized)', 'Normalize');
        continue;
      }

      try {
        const normalizedEpic = await this.epicNormalizerService.normalizeRawEpic({
          rawTitle: epicCard.name,
          rawDescription: epicCard.desc,
        });
        const description = formatNormalizedEpicDescription(normalizedEpic);

        await this.trelloService.updateCardDescription(epicCard.id, description);
        await this.trelloService.addComment(epicCard.id, NORMALIZED_EPIC_MARKER);
        this.logger.log('Updated Trello card description', 'Normalize');
        normalized += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown normalization error';
        this.logger.warn(`Failed to normalize epic "${epicCard.name}": ${message}`, 'Normalize');
      }
    }

    return { normalized, skipped, failed };
  }
}
