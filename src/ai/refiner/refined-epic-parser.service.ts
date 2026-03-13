import { Injectable } from '@nestjs/common';
import { RefinedEpic, refinedEpicSchema } from '../../models/refined-epic';
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
      const raw = JSON.parse(jsonPayload);
      const validated = refinedEpicSchema.safeParse(raw);

      if (!validated.success) {
        return null;
      }

      return validated.data;
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
}
