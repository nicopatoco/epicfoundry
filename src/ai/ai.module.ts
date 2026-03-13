import { Module } from '@nestjs/common';
import { AgentPolicyService } from './agent-policy.service';
import { AgentRouterService } from './agent-router.service';
import { AiEpicNormalizerService } from './normalizer/epic-normalizer.service';
import { EpicNormalizationWorkflowService } from './normalizer/epic-normalization-workflow.service';
import {
  MockAnthropicProvider,
  MockBrowserProvider,
  MockOpenAIProvider,
  MockPlaywrightProvider,
} from './providers/mock/mock.provider';
import { OpenAiProvider } from './providers/openai/openai.provider';
import { AnthropicPlannerProvider } from './providers/planner/anthropic-planner.provider';
import { EpicRefinerService } from './refiner/epic-refiner.service';
import { RefinedEpicParserService } from './refiner/refined-epic-parser.service';
import { TrelloModule } from '../trello/trello.module';

@Module({
  imports: [TrelloModule],
  providers: [
    AgentPolicyService,
    AgentRouterService,
    MockOpenAIProvider,
    MockAnthropicProvider,
    MockBrowserProvider,
    MockPlaywrightProvider,
    OpenAiProvider,
    AiEpicNormalizerService,
    EpicNormalizationWorkflowService,
    AnthropicPlannerProvider,
    EpicRefinerService,
    RefinedEpicParserService,
  ],
  exports: [
    AgentPolicyService,
    AgentRouterService,
    AiEpicNormalizerService,
    EpicNormalizationWorkflowService,
    AnthropicPlannerProvider,
    EpicRefinerService,
    RefinedEpicParserService,
  ],
})
export class AiModule {}
