import { Injectable } from '@nestjs/common';
import { Task, TaskType } from '../models/task';

@Injectable()
export class TaskParser {
  parseCard(cardName: string, epicTitle = 'Unknown Epic'): Task {
    const normalizedTitle = cardName.trim();

    return {
      title: normalizedTitle,
      type: this.detectTaskType(normalizedTitle),
      goal: `Complete task: ${normalizedTitle}`,
      acceptance: ['Task is implemented', 'Task changes are reviewed'],
      epicTitle,
    };
  }

  private detectTaskType(title: string): TaskType {
    const loweredTitle = title.toLowerCase();

    if (loweredTitle.includes('api')) {
      return 'api-contract';
    }

    if (loweredTitle.includes('backend')) {
      return 'backend-endpoint';
    }

    if (loweredTitle.includes('frontend') || loweredTitle.includes('ui')) {
      return 'frontend-form';
    }

    if (loweredTitle.includes('e2e') || loweredTitle.includes('verification')) {
      return 'e2e-verification';
    }

    return 'generic';
  }
}
