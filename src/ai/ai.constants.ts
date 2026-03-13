import { AgentRole, RolePolicy } from './ai.types';

export const DEFAULT_ROLE_POLICIES: RolePolicy[] = [
  {
    role: 'epic_normalizer',
    provider: 'openai',
    model: 'gpt-5.3-codex',
    capabilities: ['normalize_epic'],
  },
  {
    role: 'epic_planner',
    provider: 'anthropic',
    model: 'claude-opus-4.6',
    capabilities: ['plan'],
  },
  {
    role: 'backend_worker',
    provider: 'openai',
    model: 'gpt-5.3-codex',
    capabilities: ['implement', 'edit_code', 'run_terminal'],
  },
  {
    role: 'frontend_worker',
    provider: 'anthropic',
    model: 'claude-opus-4.6',
    capabilities: ['implement', 'edit_code'],
  },
  {
    role: 'manual_qa_agent',
    provider: 'browser',
    model: 'exploratory-browser-agent',
    capabilities: ['browser_navigation', 'visual_validation', 'analyze_failure'],
  },
  {
    role: 'e2e_tester',
    provider: 'playwright',
    model: 'deterministic-e2e',
    capabilities: ['deterministic_e2e', 'analyze_failure'],
  },
  {
    role: 'reviewer',
    provider: 'anthropic',
    model: 'claude-opus-4.6',
    capabilities: ['review'],
  },
];

export const ALL_AGENT_ROLES: AgentRole[] = [
  'epic_normalizer',
  'epic_planner',
  'backend_worker',
  'frontend_worker',
  'manual_qa_agent',
  'e2e_tester',
  'reviewer',
];
