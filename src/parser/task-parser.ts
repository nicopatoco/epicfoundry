import { Injectable } from '@nestjs/common';
import { Task, TaskType } from '../models/task';

@Injectable()
export class TaskParser {
  parseCard(cardName: string, epicTitle = 'Unknown Epic'): Task {
    const normalizedTitle = cardName.trim();
    const type = this.detectTaskType(normalizedTitle);

    return {
      title: normalizedTitle,
      type,
      goal: `Complete task: ${normalizedTitle}`,
      scope: ['Implement required behavior', 'Preserve existing behavior'],
      acceptance: ['Task is implemented', 'Task changes are reviewed'],
      sourceRefs: ['scope:1', 'acceptance:1'],
      project: this.inferProject(type),
      epicTitle,
    };
  }

  private detectTaskType(title: string): TaskType {
    const loweredTitle = title.toLowerCase();

    if (loweredTitle.includes('contract') || loweredTitle.includes('api')) {
      return 'contract';
    }

    if (loweredTitle.includes('backend') || loweredTitle.includes('endpoint')) {
      return 'backend';
    }

    if (loweredTitle.includes('frontend') || loweredTitle.includes('ui')) {
      return 'frontend';
    }

    if (loweredTitle.includes('qa') || loweredTitle.includes('e2e')) {
      return 'qa';
    }

    if (loweredTitle.includes('bug') || loweredTitle.includes('fix')) {
      return 'bugfix';
    }

    return 'fullstack';
  }

  private inferProject(type: TaskType): string {
    if (type === 'backend' || type === 'contract') {
      return 'backend';
    }

    if (type === 'frontend') {
      return 'frontend';
    }

    if (type === 'qa') {
      return 'qa';
    }

    return 'fullstack';
  }
}
