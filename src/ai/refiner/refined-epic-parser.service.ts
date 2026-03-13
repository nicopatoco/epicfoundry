import { Injectable } from '@nestjs/common';
import { RefinedEpic } from '../ai.types';
import { REFINED_EPIC_JSON_HEADER } from './refinement.constants';

@Injectable()
export class RefinedEpicParserService {
  parseFromComments(comments: string[]): RefinedEpic | null {
    for (let index = comments.length - 1; index >= 0; index -= 1) {
      const parsed = this.parseFromComment(comments[index]);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  parseFromComment(comment: string): RefinedEpic | null {
    const jsonPayload = this.extractJsonPayload(comment);

    if (!jsonPayload) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonPayload) as Partial<RefinedEpic>;
      if (!this.isValidRefinedEpic(parsed)) {
        return null;
      }

      return {
        title: parsed.title.trim(),
        summary: parsed.summary.trim(),
        scopeIn: parsed.scopeIn.map((item) => item.trim()),
        scopeOut: parsed.scopeOut.map((item) => item.trim()),
        openQuestions: parsed.openQuestions.map((item) => item.trim()),
        recommendedApproach: parsed.recommendedApproach.trim(),
      };
    } catch {
      return null;
    }
  }

  private extractJsonPayload(comment: string): string | null {
    const headerIndex = comment.indexOf(REFINED_EPIC_JSON_HEADER);

    if (headerIndex < 0) {
      return null;
    }

    const afterHeader = comment.slice(headerIndex + REFINED_EPIC_JSON_HEADER.length);
    const match = afterHeader.match(/```json\s*([\s\S]*?)\s*```/i);

    if (!match || !match[1]) {
      return null;
    }

    return match[1].trim();
  }

  private isValidRefinedEpic(payload: Partial<RefinedEpic>): payload is RefinedEpic {
    return (
      typeof payload.title === 'string' &&
      typeof payload.summary === 'string' &&
      Array.isArray(payload.scopeIn) &&
      payload.scopeIn.every((item) => typeof item === 'string') &&
      Array.isArray(payload.scopeOut) &&
      payload.scopeOut.every((item) => typeof item === 'string') &&
      Array.isArray(payload.openQuestions) &&
      payload.openQuestions.every((item) => typeof item === 'string') &&
      typeof payload.recommendedApproach === 'string'
    );
  }
}
