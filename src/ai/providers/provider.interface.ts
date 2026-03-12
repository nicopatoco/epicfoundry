import { AgentRole, Capability, ProviderName } from '../ai.types';

export interface AgentProvider {
  readonly name: ProviderName;
  supportsRole(role: AgentRole): boolean;
  supportsCapability(capability: Capability): boolean;
  executeMock(role: AgentRole, input?: unknown): Promise<unknown>;
}
