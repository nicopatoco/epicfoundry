import { Injectable } from '@nestjs/common';
import { DEFAULT_ROLE_POLICIES } from './ai.constants';
import { AgentRole, RolePolicy } from './ai.types';

@Injectable()
export class AgentPolicyService {
  private readonly policies: RolePolicy[] = [...DEFAULT_ROLE_POLICIES];

  getPolicyForRole(role: AgentRole): RolePolicy {
    const policy = this.policies.find((item) => item.role === role);

    if (!policy) {
      throw new Error(`No AI policy configured for role: ${role}`);
    }

    return {
      ...policy,
      capabilities: [...(policy.capabilities ?? [])],
    };
  }

  getAllPolicies(): RolePolicy[] {
    return this.policies.map((policy) => ({
      ...policy,
      capabilities: [...(policy.capabilities ?? [])],
    }));
  }

  getSummaryLines(): string[] {
    return this.getAllPolicies().map(
      (policy) => `${policy.role} -> ${policy.provider} / ${policy.model}`,
    );
  }
}
