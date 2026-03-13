import { Injectable } from '@nestjs/common';
import {
  AgentRole,
  Capability,
  E2EResult,
  ManualQaReport,
  PlannedTask,
  ProviderName,
  ReviewResult,
  TaskExecutionResult,
} from '../../ai.types';
import { AgentProvider } from '../provider.interface';

abstract class BaseMockProvider implements AgentProvider {
  abstract readonly name: ProviderName;

  abstract supportsRole(role: AgentRole): boolean;

  abstract supportsCapability(capability: Capability): boolean;

  abstract executeMock(role: AgentRole, input?: unknown): Promise<unknown>;
}

@Injectable()
export class MockOpenAIProvider extends BaseMockProvider {
  readonly name = 'openai';

  supportsRole(role: AgentRole): boolean {
    return role === 'backend_worker';
  }

  supportsCapability(capability: Capability): boolean {
    return ['implement', 'edit_code', 'run_terminal'].includes(capability);
  }

  async executeMock(role: AgentRole): Promise<unknown> {
    if (role !== 'backend_worker') {
      throw new Error(`Provider ${this.name} does not support role ${role}`);
    }

    const result: TaskExecutionResult = {
      status: 'success',
      summary: 'Backend worker executed task with mock OpenAI provider.',
      logs: ['Generated endpoint skeleton', 'Updated service layer', 'Added unit test stub'],
    };

    return result;
  }
}

@Injectable()
export class MockAnthropicProvider extends BaseMockProvider {
  readonly name = 'anthropic';

  supportsRole(role: AgentRole): boolean {
    return ['epic_planner', 'frontend_worker', 'reviewer'].includes(role);
  }

  supportsCapability(capability: Capability): boolean {
    return ['plan', 'implement', 'edit_code', 'review'].includes(capability);
  }

  async executeMock(role: AgentRole, input?: unknown): Promise<unknown> {
    if (role === 'epic_planner') {
      const epicTitle =
        typeof input === 'string' && input.trim().length > 0
          ? input
          : 'User profile editing';

      const tasks: PlannedTask[] = [
        {
          title: `${epicTitle} - Backend contract`,
          type: 'backend',
          goal: `Define API contract for ${epicTitle}`,
          acceptance: ['Request and response schema documented'],
        },
        {
          title: `${epicTitle} - Frontend form`,
          type: 'frontend',
          goal: `Implement frontend form for ${epicTitle}`,
          acceptance: ['Form validates and submits user data'],
        },
      ];

      return tasks;
    }

    if (role === 'frontend_worker') {
      const result: TaskExecutionResult = {
        status: 'success',
        summary: 'Frontend worker executed task with mock Anthropic provider.',
        logs: ['Created React form component', 'Added client-side validation'],
      };
      return result;
    }

    if (role === 'reviewer') {
      const review: ReviewResult = {
        status: 'approved',
        summary: 'Code review completed by mock Anthropic reviewer.',
        comments: ['No blocking issues found', 'Suggest adding one more integration test'],
      };
      return review;
    }

    throw new Error(`Provider ${this.name} does not support role ${role}`);
  }
}

@Injectable()
export class MockBrowserProvider extends BaseMockProvider {
  readonly name = 'browser';

  supportsRole(role: AgentRole): boolean {
    return role === 'manual_qa_agent';
  }

  supportsCapability(capability: Capability): boolean {
    return ['browser_navigation', 'visual_validation', 'analyze_failure'].includes(
      capability,
    );
  }

  async executeMock(role: AgentRole): Promise<unknown> {
    if (role !== 'manual_qa_agent') {
      throw new Error(`Provider ${this.name} does not support role ${role}`);
    }

    const report: ManualQaReport = {
      status: 'issues_found',
      summary: 'Manual QA finished with one medium-priority issue.',
      exploredFlows: [
        'Login and navigate to dashboard',
        'Open profile editing form',
        'Submit valid profile updates',
      ],
      findings: [
        {
          severity: 'medium',
          title: 'Email validation message is unclear',
          expected: 'Inline message should explain accepted email format.',
          actual: 'Form shows generic "Invalid input" message.',
        },
      ],
    };

    return report;
  }
}

@Injectable()
export class MockPlaywrightProvider extends BaseMockProvider {
  readonly name = 'playwright';

  supportsRole(role: AgentRole): boolean {
    return role === 'e2e_tester';
  }

  supportsCapability(capability: Capability): boolean {
    return ['deterministic_e2e', 'analyze_failure'].includes(capability);
  }

  async executeMock(role: AgentRole): Promise<unknown> {
    if (role !== 'e2e_tester') {
      throw new Error(`Provider ${this.name} does not support role ${role}`);
    }

    const result: E2EResult = {
      status: 'passed',
      summary: 'Deterministic E2E suite passed in mock Playwright provider.',
      testCases: ['profile-update-smoke', 'profile-email-validation'],
    };

    return result;
  }
}
