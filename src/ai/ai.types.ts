export type AgentRole =
  | 'epic_planner'
  | 'backend_worker'
  | 'frontend_worker'
  | 'manual_qa_agent'
  | 'e2e_tester'
  | 'reviewer';

export type ProviderName = 'openai' | 'anthropic' | 'browser' | 'playwright';

export type ModelName = string;

export type Capability =
  | 'plan'
  | 'implement'
  | 'edit_code'
  | 'run_terminal'
  | 'browser_navigation'
  | 'visual_validation'
  | 'deterministic_e2e'
  | 'review'
  | 'analyze_failure';

export interface RolePolicy {
  role: AgentRole;
  provider: ProviderName;
  model: ModelName;
  capabilities?: Capability[];
}

export interface RoutingDecision {
  role: AgentRole;
  provider: ProviderName;
  model: ModelName;
  capabilities: Capability[];
}

export interface PlanEpicInput {
  epicTitle: string;
  goal?: string;
}

export interface PlannedTask {
  title: string;
  type: 'backend' | 'frontend' | 'fullstack' | 'qa';
  goal: string;
  acceptance: string[];
}

export interface TaskExecutionInput {
  taskTitle: string;
  role: 'backend_worker' | 'frontend_worker';
}

export interface TaskExecutionResult {
  status: 'success' | 'failed' | 'blocked';
  summary: string;
  logs: string[];
}

export interface ManualQaInput {
  feature: string;
}

export interface ManualQaFinding {
  severity: 'low' | 'medium' | 'high';
  title: string;
  expected: string;
  actual: string;
}

export interface ManualQaReport {
  status: 'passed' | 'issues_found' | 'blocked';
  summary: string;
  exploredFlows: string[];
  findings: ManualQaFinding[];
}

export interface E2EInput {
  suite: string;
}

export interface E2EResult {
  status: 'passed' | 'failed' | 'blocked';
  summary: string;
  testCases: string[];
}

export interface ReviewInput {
  artifact: string;
}

export interface ReviewResult {
  status: 'approved' | 'changes_requested';
  summary: string;
  comments: string[];
}

export interface RefinedEpic {
  title: string;
  summary: string;
  scopeIn: string[];
  scopeOut: string[];
  openQuestions: string[];
  recommendedApproach: string;
}

export interface EpicRefinementResult {
  summary: string;
  suggestedScope: {
    in: string[];
    out: string[];
  };
  openQuestions: string[];
  recommendedApproach: string;
  refinedEpic: RefinedEpic;
}
