import { Injectable } from '@nestjs/common';
import { AppLogger } from '../common/logger/app-logger.service';
import { ALL_AGENT_ROLES } from './ai.constants';
import { AgentPolicyService } from './agent-policy.service';
import {
  AgentRole,
  ManualQaInput,
  ManualQaReport,
  PlannedTask,
  ProviderName,
  RoutingDecision,
  TaskExecutionResult,
} from './ai.types';
import {
  MockAnthropicProvider,
  MockBrowserProvider,
  MockOpenAIProvider,
  MockPlaywrightProvider,
} from './providers/mock/mock.provider';
import { AgentProvider } from './providers/provider.interface';

@Injectable()
export class AgentRouterService {
  private readonly providers: AgentProvider[];

  constructor(
    private readonly policyService: AgentPolicyService,
    private readonly logger: AppLogger,
    openaiProvider: MockOpenAIProvider,
    anthropicProvider: MockAnthropicProvider,
    browserProvider: MockBrowserProvider,
    playwrightProvider: MockPlaywrightProvider,
  ) {
    this.providers = [
      openaiProvider,
      anthropicProvider,
      browserProvider,
      playwrightProvider,
    ];
  }

  getRouteForRole(role: AgentRole): RoutingDecision {
    const policy = this.policyService.getPolicyForRole(role);
    const provider = this.findProvider(policy.provider);

    if (!provider.supportsRole(role)) {
      throw new Error(
        `Provider ${policy.provider} is configured for ${role} but does not support that role.`,
      );
    }

    for (const capability of policy.capabilities ?? []) {
      if (!provider.supportsCapability(capability)) {
        throw new Error(
          `Provider ${policy.provider} does not support capability ${capability} for role ${role}.`,
        );
      }
    }

    const route: RoutingDecision = {
      role,
      provider: policy.provider,
      model: policy.model,
      capabilities: [...(policy.capabilities ?? [])],
    };

    this.logger.log(
      `Route resolved: ${route.role} -> ${route.provider} / ${route.model}`,
      'AI-Router',
    );

    return route;
  }

  getAllRoutes(): RoutingDecision[] {
    return ALL_AGENT_ROLES.map((role) => this.getRouteForRole(role));
  }

  async runPlannerDemo(epicTitle: string): Promise<PlannedTask[]> {
    const route = this.getRouteForRole('epic_planner');
    const provider = this.findProvider(route.provider);
    const result = await provider.executeMock('epic_planner', epicTitle);

    return result as PlannedTask[];
  }

  async runWorkerDemo(
    role: 'backend_worker' | 'frontend_worker',
  ): Promise<TaskExecutionResult> {
    const route = this.getRouteForRole(role);
    const provider = this.findProvider(route.provider);
    const result = await provider.executeMock(role);

    return result as TaskExecutionResult;
  }

  async runManualQaDemo(input: ManualQaInput): Promise<ManualQaReport> {
    const route = this.getRouteForRole('manual_qa_agent');
    const provider = this.findProvider(route.provider);
    const result = await provider.executeMock('manual_qa_agent', input);

    return result as ManualQaReport;
  }

  private findProvider(name: ProviderName): AgentProvider {
    const provider = this.providers.find((item) => item.name === name);

    if (!provider) {
      throw new Error(`AI provider is not registered: ${name}`);
    }

    return provider;
  }
}
