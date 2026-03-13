import { Module } from '@nestjs/common';
import { AgentPolicyService } from './agent-policy.service';
import { AgentRouterService } from './agent-router.service';
import {
  MockAnthropicProvider,
  MockBrowserProvider,
  MockOpenAIProvider,
  MockPlaywrightProvider,
} from './providers/mock/mock.provider';
import { AnthropicPlannerProvider } from './providers/planner/anthropic-planner.provider';
import { EpicRefinerService } from './refiner/epic-refiner.service';
import { RefinedEpicParserService } from './refiner/refined-epic-parser.service';

@Module({
  providers: [
    AgentPolicyService,
    AgentRouterService,
    MockOpenAIProvider,
    MockAnthropicProvider,
    MockBrowserProvider,
    MockPlaywrightProvider,
    AnthropicPlannerProvider,
    EpicRefinerService,
    RefinedEpicParserService,
  ],
  exports: [
    AgentPolicyService,
    AgentRouterService,
    AnthropicPlannerProvider,
    EpicRefinerService,
    RefinedEpicParserService,
  ],
})
export class AiModule {}
