import { Injectable } from '@nestjs/common';
import { AgentPolicyService } from '../ai/agent-policy.service';
import { AnthropicPlannerProvider } from '../ai/providers/planner/anthropic-planner.provider';
import { PlannedTask, RefinedEpic } from '../ai/ai.types';
import { AppLogger } from '../common/logger/app-logger.service';
import { Epic } from '../models/epic';
import { Task, TaskType } from '../models/task';

@Injectable()
export class PlannerService {
  constructor(
    private readonly agentPolicyService: AgentPolicyService,
    private readonly anthropicPlannerProvider: AnthropicPlannerProvider,
    private readonly logger: AppLogger,
  ) {}

  async generateTasksFromRefinedEpic(refinedEpic: RefinedEpic): Promise<Task[]> {
    try {
      this.logger.log('Using AI planner provider', 'Planner');
      const aiTasks = await this.generateTasksWithProvider(refinedEpic);
      this.logger.log(`Generated ${aiTasks.length} tasks`, 'Planner');

      return aiTasks.map((task) => this.toTask(task, refinedEpic.title));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown planner error';
      this.logger.warn(`AI planner failed - using fallback planner (${message})`, 'Planner');
      return this.generateFallbackTasks(refinedEpic.title);
    }
  }

  generateTasksFromEpic(epic: Epic): Task[] {
    return this.generateFallbackTasks(epic.title);
  }

  planTasks(epic: Epic): Task[] {
    return this.generateTasksFromEpic(epic);
  }

  planTasksFromEpics(epics: Epic[]): Task[] {
    return epics.flatMap((epic) => this.generateTasksFromEpic(epic));
  }

  private async generateTasksWithProvider(refinedEpic: RefinedEpic): Promise<PlannedTask[]> {
    const policy = this.agentPolicyService.getPolicyForRole('epic_planner');

    if (policy.provider === 'anthropic') {
      return this.anthropicPlannerProvider.planEpic(refinedEpic);
    }

    throw new Error(`Planner provider is not implemented for ${policy.provider}`);
  }

  private toTask(plannedTask: PlannedTask, epicTitle: string): Task {
    return {
      title: plannedTask.title,
      type: this.toTaskType(plannedTask.type),
      goal: plannedTask.goal,
      acceptance: [...plannedTask.acceptance],
      epicTitle,
    };
  }

  private toTaskType(type: PlannedTask['type']): TaskType {
    if (type === 'backend') {
      return 'backend-endpoint';
    }

    if (type === 'frontend') {
      return 'frontend-form';
    }

    if (type === 'qa') {
      return 'e2e-verification';
    }

    return 'generic';
  }

  private generateFallbackTasks(epicTitle: string): Task[] {
    return [
      {
        title: `${epicTitle} — API contract`,
        type: 'api-contract',
        goal: `Define API contract for ${epicTitle}`,
        acceptance: ['Request and response schema documented'],
        epicTitle,
      },
      {
        title: `${epicTitle} — Backend endpoint`,
        type: 'backend-endpoint',
        goal: `Implement backend endpoint for ${epicTitle}`,
        acceptance: ['Endpoint is implemented and unit-tested'],
        epicTitle,
      },
      {
        title: `${epicTitle} — Frontend form`,
        type: 'frontend-form',
        goal: `Implement frontend form for ${epicTitle}`,
        acceptance: ['Form validates user input and sends data'],
        epicTitle,
      },
      {
        title: `${epicTitle} — E2E verification`,
        type: 'e2e-verification',
        goal: `Verify end-to-end behavior for ${epicTitle}`,
        acceptance: ['Critical user flow passes in E2E tests'],
        epicTitle,
      },
    ];
  }
}
