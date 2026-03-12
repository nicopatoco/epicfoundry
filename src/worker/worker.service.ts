import { Injectable } from '@nestjs/common';
import { AppLogger } from '../common/logger/app-logger.service';
import { TaskParser } from '../parser/task-parser';
import { TrelloCard, TrelloService } from '../trello/trello.service';

export interface WorkerRunSummary {
  processed: number;
  succeeded: number;
  failed: number;
}

@Injectable()
export class WorkerService {
  constructor(
    private readonly trelloService: TrelloService,
    private readonly taskParser: TaskParser,
    private readonly logger: AppLogger,
  ) {}

  async run(): Promise<WorkerRunSummary> {
    const todoCards = await this.trelloService.getTodoCards();

    if (todoCards.length === 0) {
      this.logger.log('No cards found in Todo list', 'WorkerService');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const card of todoCards) {
      const success = await this.processCard(card);
      if (success) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    }

    return {
      processed: todoCards.length,
      succeeded,
      failed,
    };
  }

  private async processCard(card: TrelloCard): Promise<boolean> {
    const task = this.taskParser.parseCard(card.name);

    await this.trelloService.moveCardToList(card.id, 'In Progress');
    await this.trelloService.addCommentToCard(
      card.id,
      `Worker started: ${task.title}`,
    );

    const success = await this.simulateExecution(task.title);

    if (success) {
      await this.trelloService.moveCardToList(card.id, 'Review');
      await this.trelloService.addCommentToCard(
        card.id,
        'Worker finished successfully. Ready for review.',
      );
      this.logger.log(`Task succeeded: ${task.title}`, 'WorkerService');
      return true;
    }

    await this.trelloService.moveCardToList(card.id, 'Failed');
    await this.trelloService.addCommentToCard(
      card.id,
      'Worker execution failed. Please check logs and retry.',
    );
    this.logger.warn(`Task failed: ${task.title}`, 'WorkerService');

    return false;
  }

  private async simulateExecution(taskTitle: string): Promise<boolean> {
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    return !taskTitle.toLowerCase().includes('[fail]');
  }
}
