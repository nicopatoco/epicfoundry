import { Module } from '@nestjs/common';
import { AgentPolicyService } from './agent-policy.service';
import { AgentRouterService } from './agent-router.service';
import {
  MockAnthropicProvider,
  MockBrowserProvider,
  MockOpenAIProvider,
  MockPlaywrightProvider,
} from './providers/mock/mock.provider';

@Module({
  providers: [
    AgentPolicyService,
    AgentRouterService,
    MockOpenAIProvider,
    MockAnthropicProvider,
    MockBrowserProvider,
    MockPlaywrightProvider,
  ],
  exports: [AgentPolicyService, AgentRouterService],
})
export class AiModule {}
