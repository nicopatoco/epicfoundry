import { Module } from '@nestjs/common';
import { AgentPolicyService } from './agent-policy.service';
import { AgentRouterService } from './agent-router.service';
import {
  MockAnthropicProvider,
  MockBrowserProvider,
  MockOpenAIProvider,
  MockPlaywrightProvider,
} from './providers/mock/mock.provider';
import { EpicRefinerService } from './refiner/epic-refiner.service';

@Module({
  providers: [
    AgentPolicyService,
    AgentRouterService,
    MockOpenAIProvider,
    MockAnthropicProvider,
    MockBrowserProvider,
    MockPlaywrightProvider,
    EpicRefinerService,
  ],
  exports: [AgentPolicyService, AgentRouterService, EpicRefinerService],
})
export class AiModule {}
