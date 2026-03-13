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
    const epicLabel = this.normalizeEpicLabel(refinedEpic.title);
    const planningInput: RefinedEpic = {
      ...refinedEpic,
      title: epicLabel,
    };

    this.logger.log('Synthesizing tasks from RefinedEpic', 'Planner');
    this.logger.log(`Using normalized epic label: ${epicLabel}`, 'Planner');

    try {
      this.logger.log('Using AI planner provider', 'Planner');
      const aiTasks = await this.generateTasksWithProvider(planningInput);

      if (aiTasks.length === 0) {
        throw new Error('No tasks were synthesized from refined epic');
      }

      const mappedTasks = aiTasks.map((task) => this.toTask(task, planningInput.title));
      const coverageRefs = new Set(mappedTasks.flatMap((task) => task.sourceRefs));

      this.logger.log(
        `Generated ${mappedTasks.length} tasks from ${planningInput.scopeIn.length} scope items and ${planningInput.acceptanceCriteria.length} acceptance criteria`,
        'Planner',
      );
      this.logger.log(
        `Coverage mapped from ${planningInput.scopeIn.length} scope items and ${planningInput.acceptanceCriteria.length} acceptance criteria into ${coverageRefs.size} references`,
        'Planner',
      );

      return mappedTasks;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown planner error';
      this.logger.warn(
        `Content-driven synthesis failed - using fallback planner (${message})`,
        'Planner',
      );
      return this.generateFallbackTasks(epicLabel);
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
    const type = this.toTaskType(plannedTask.type);
    const scope =
      plannedTask.scope.length > 0 ? [...plannedTask.scope] : [plannedTask.goal];
    const acceptance =
      plannedTask.acceptance.length > 0
        ? [...plannedTask.acceptance]
        : ['Task behavior is implemented and verified'];
    const sourceRefs =
      plannedTask.sourceRefs.length > 0
        ? [...plannedTask.sourceRefs]
        : ['scope:1'];

    return {
      title: plannedTask.title,
      type,
      goal: plannedTask.goal,
      scope,
      acceptance,
      sourceRefs,
      project: this.inferProject(type),
      epicTitle,
    };
  }

  private toTaskType(type: PlannedTask['type']): TaskType {
    if (type === 'contract') {
      return 'contract';
    }

    if (type === 'backend') {
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

  private inferProject(type: TaskType): string {
    if (type === 'contract' || type === 'backend') {
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

  private generateFallbackTasks(epicTitle: string): Task[] {
    return [
      {
        title: 'API contract',
        type: 'contract',
        goal: `Define API contract for ${epicTitle}`,
        scope: ['Define request/response schema', 'Align validation rules'],
        acceptance: ['Request and response schema documented'],
        sourceRefs: ['scope:1', 'acceptance:1'],
        project: 'backend',
        epicTitle,
      },
      {
        title: 'Backend endpoint',
        type: 'backend',
        goal: `Implement backend endpoint for ${epicTitle}`,
        scope: ['Create endpoint handler', 'Persist business data'],
        acceptance: ['Endpoint is implemented and unit-tested'],
        sourceRefs: ['scope:1', 'acceptance:1'],
        project: 'backend',
        epicTitle,
      },
      {
        title: 'Frontend flow',
        type: 'frontend',
        goal: `Implement frontend flow for ${epicTitle}`,
        scope: ['Build input form', 'Submit data to backend endpoint'],
        acceptance: ['Form validates user input and sends data'],
        sourceRefs: ['scope:1', 'acceptance:1'],
        project: 'frontend',
        epicTitle,
      },
      {
        title: 'E2E verification',
        type: 'qa',
        goal: `Verify end-to-end behavior for ${epicTitle}`,
        scope: ['Test happy path', 'Test one failure scenario'],
        acceptance: ['Critical user flow passes in E2E tests'],
        sourceRefs: ['scope:1', 'acceptance:1'],
        project: 'qa',
        epicTitle,
      },
    ];
  }

  private normalizeEpicLabel(title: string): string {
    const normalized = title.trim().replace(/\s+/g, ' ');
    const createMatch = normalized.match(
      /\b(create|build|implement|develop|design)\s+(?:a|an|the)?\s*([^,.]+?)(?:\s+so\b|\s+for\b|\s+that\b|$)/i,
    );

    if (createMatch && createMatch[2]) {
      return this.toTitleCase(createMatch[2]);
    }

    const cleaned = normalized
      .replace(/^i\s+(want|need|would like)\s+to\s+/i, '')
      .split(/\s+so(?:\s+that)?\s+/i)[0]
      .trim();

    const limited = cleaned.split(/\s+/).slice(0, 5).join(' ');
    return this.toTitleCase(limited || normalized);
  }

  private toTitleCase(value: string): string {
    if (!value) {
      return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
