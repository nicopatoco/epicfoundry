import { Injectable } from '@nestjs/common';
import { Epic } from '../models/epic';

interface EpicSections {
  goal: string[];
  scope: string[];
  acceptance: string[];
}

@Injectable()
export class EpicParser {
  parseFromCard(cardName: string, description = ''): Epic | null {
    if (!cardName.trim().toUpperCase().startsWith('EPIC:')) {
      return null;
    }

    const title = cardName.replace(/^EPIC:\s*/i, '').trim();
    const sections = this.parseSections(description);

    return {
      title,
      goal: sections.goal.join(' ').trim(),
      scope: sections.scope,
      acceptance: sections.acceptance,
    };
  }

  private parseSections(description: string): EpicSections {
    const lines = description
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const sections: EpicSections = {
      goal: [],
      scope: [],
      acceptance: [],
    };

    let currentSection: keyof EpicSections | null = null;

    for (const line of lines) {
      const sectionMatch = line.match(/^(Goal|Scope|Acceptance):\s*(.*)$/i);

      if (sectionMatch) {
        const sectionName = sectionMatch[1].toLowerCase() as keyof EpicSections;
        const inlineValue = sectionMatch[2].trim();
        currentSection = sectionName;

        if (inlineValue.length > 0) {
          if (sectionName === 'goal') {
            sections.goal.push(inlineValue);
          } else {
            sections[sectionName].push(this.stripListPrefix(inlineValue));
          }
        }

        continue;
      }

      if (!currentSection) {
        continue;
      }

      if (currentSection === 'goal') {
        sections.goal.push(this.stripListPrefix(line));
      } else {
        sections[currentSection].push(this.stripListPrefix(line));
      }
    }

    return sections;
  }

  private stripListPrefix(value: string): string {
    return value.replace(/^[-*]\s*/, '').trim();
  }
}
