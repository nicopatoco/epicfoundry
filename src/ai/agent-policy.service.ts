import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { DEFAULT_ROLE_POLICIES } from './ai.constants';
import { AgentRole, RolePolicy } from './ai.types';

@Injectable()
export class AgentPolicyService {
  constructor(private readonly configService: ConfigService) {}

  private readonly policies: RolePolicy[] = [...DEFAULT_ROLE_POLICIES];

  getPolicyForRole(role: AgentRole): RolePolicy {
    const policy = this.policies.find((item) => item.role === role);

    if (!policy) {
      throw new Error(`No AI policy configured for role: ${role}`);
    }

    const resolved: RolePolicy = {
      ...policy,
      capabilities: [...(policy.capabilities ?? [])],
    };

    if (role === 'epic_normalizer') {
      const model = this.configService.get('OPENAI_MODEL_EPIC_NORMALIZER')?.trim();
      if (model) {
        resolved.model = model;
      }
    }

    return resolved;
  }

  getAllPolicies(): RolePolicy[] {
    return this.policies.map((policy) => this.getPolicyForRole(policy.role));
  }

  getSummaryLines(): string[] {
    return this.getAllPolicies().map(
      (policy) => `${policy.role} -> ${policy.provider} / ${policy.model}`,
    );
  }
}
