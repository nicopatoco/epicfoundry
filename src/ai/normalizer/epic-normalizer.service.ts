import { Injectable } from '@nestjs/common';
import { AgentPolicyService } from '../agent-policy.service';
import { OpenAiProvider } from '../providers/openai/openai.provider';
import { AppLogger } from '../../common/logger/app-logger.service';
import {
  runNormalizedEpicQualityChecks,
  validateNormalizedEpic,
} from './epic-normalizer.validation';
import { buildEpicNormalizerPrompt } from './epic-normalizer.prompt';
import { NormalizedEpic } from './normalized-epic';

export interface RawEpicInput {
  rawTitle: string;
  rawDescription: string;
}

@Injectable()
export class AiEpicNormalizerService {
  constructor(
    private readonly policyService: AgentPolicyService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly logger: AppLogger,
  ) {}

  async normalizeRawEpic(input: RawEpicInput): Promise<NormalizedEpic> {
    this.logger.log('Using epic_normalizer role', 'Normalize');
    const policy = this.policyService.getPolicyForRole('epic_normalizer');

    if (policy.provider !== 'openai') {
      throw new Error(
        `epic_normalizer provider "${policy.provider}" is not implemented.`,
      );
    }

    this.logger.log('Calling OpenAI provider', 'Normalize');
    const prompt = buildEpicNormalizerPrompt(input);
    const rawResponse = await this.openAiProvider.createJsonResponse(prompt, policy.model);
    const normalized = validateNormalizedEpic(rawResponse);
    const quality = runNormalizedEpicQualityChecks(normalized, input.rawDescription);

    for (const warning of quality.warnings) {
      this.logger.warn(`Warning: ${warning}`, 'Normalize');
    }

    if (!quality.valid) {
      throw new Error(`Normalized epic failed quality checks: ${quality.errors.join('; ')}`);
    }

    this.logger.log('Normalized epic validated successfully', 'Normalize');
    return normalized;
  }
}
