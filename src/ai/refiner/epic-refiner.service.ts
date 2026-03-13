import { Injectable } from '@nestjs/common';
import { Epic } from '../../models/epic';
import { EpicRefinementResult } from '../ai.types';

@Injectable()
export class EpicRefinerService {
  async refineEpic(epic: Epic): Promise<EpicRefinementResult> {
    const summary = this.buildSummary(epic);

    const inScope =
      epic.scope.length > 0
        ? epic.scope.map((item) => this.toSentenceCase(item))
        : [
            'Customer can view available slots',
            'Customer can create appointment',
            'Customer can cancel appointment',
          ];

    const outOfScope = [
      'payments',
      'multi-location support',
      'SMS notifications',
    ];

    const openQuestions = [
      'Is there only one professional or multiple?',
      'What is the appointment duration?',
      'Can customers reschedule appointments?',
    ];

    return {
      summary,
      suggestedScope: {
        in: inScope,
        out: outOfScope,
      },
      openQuestions,
      recommendedApproach: `Start with a simple ${epic.title.toLowerCase()} flow for a single professional.`,
    };
  }

  private buildSummary(epic: Epic): string {
    const fallback = `This epic describes a feature for ${epic.title.toLowerCase()}.`;

    if (!epic.goal || epic.goal.trim().length === 0) {
      return fallback;
    }

    return `This epic describes ${epic.goal.trim().replace(/\.$/, '')}.`;
  }

  private toSentenceCase(text: string): string {
    const normalized = text.trim();

    if (!normalized) {
      return normalized;
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}
