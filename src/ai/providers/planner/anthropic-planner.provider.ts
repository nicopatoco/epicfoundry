import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { PlannedTask, RefinedEpic } from '../../ai.types';
import { PlannerProvider } from './planner-provider.interface';
import { buildPlannerPrompt } from './planner-prompt';
import { PlannerResponse, plannerResponseSchema } from './planner-schema';

interface IndexedItem {
  text: string;
  ref: string;
}

@Injectable()
export class AnthropicPlannerProvider implements PlannerProvider {
  readonly name = 'anthropic' as const;

  constructor(private readonly logger: AppLogger) {}

  async planEpic(refinedEpic: RefinedEpic): Promise<PlannedTask[]> {
    const prompt = buildPlannerPrompt(refinedEpic);
    this.logger.log(`Prompt prepared (${prompt.length} chars)`, 'PlannerProvider');

    const simulatedResponse = this.simulateModelResponse(refinedEpic);
    const parsed = plannerResponseSchema.safeParse(simulatedResponse);

    if (!parsed.success) {
      throw new Error(
        `Planner response validation failed: ${parsed.error.issues
          .map((issue) => issue.message)
          .join('; ')}`,
      );
    }

    return this.normalizeTasks(parsed.data);
  }

  private normalizeTasks(response: PlannerResponse): PlannedTask[] {
    return response.tasks.map((task) => ({
      title: task.title.trim(),
      type: task.type,
      goal: task.goal.trim(),
      scope: this.unique(task.scope),
      acceptance: this.unique(task.acceptance),
      sourceRefs: this.unique(task.sourceRefs),
    }));
  }

  private simulateModelResponse(refinedEpic: RefinedEpic): unknown {
    const epicLabel = this.normalizeEpicLabel(refinedEpic.title);
    const scopeItems = this.indexItems(refinedEpic.scopeIn, 'scope');
    const acceptanceItems = this.indexItems(
      refinedEpic.acceptanceCriteria,
      'acceptance',
    );

    const tasks: PlannedTask[] = this.synthesizeTasks(
      epicLabel,
      refinedEpic,
      scopeItems,
      acceptanceItems,
    );

    return {
      tasks,
    };
  }

  private synthesizeTasks(
    epicLabel: string,
    refinedEpic: RefinedEpic,
    scopeItems: IndexedItem[],
    acceptanceItems: IndexedItem[],
  ): PlannedTask[] {
    const outOfScopeKeywords = this.extractKeywords(refinedEpic.scopeOut);
    const effectiveScopeItems = this.filterOutOfScope(scopeItems, outOfScopeKeywords);
    const tasks: PlannedTask[] = [];
    const readScope = effectiveScopeItems.filter((item) => this.hasReadSignal(item.text));
    const exportScope = effectiveScopeItems.filter((item) =>
      this.hasExportSignal(item.text),
    );
    const createScope = effectiveScopeItems.filter((item) =>
      this.hasCreateSignal(item.text),
    );
    const changeScope = effectiveScopeItems.filter((item) => this.hasChangeSignal(item.text));
    const contractScope = effectiveScopeItems.filter((item) =>
      this.hasContractSignal(item.text),
    );
    const frontendScope = effectiveScopeItems.filter(
      (item) =>
        this.hasFrontendSignal(item.text) &&
        !this.hasNegativeFrontendSignal(item.text),
    );
    const backendScope = effectiveScopeItems.filter((item) =>
      this.hasBackendSignal(item.text),
    );
    const authScope = effectiveScopeItems.filter((item) => this.hasAuthSignal(item.text));
    const validationAcceptance = acceptanceItems.filter((item) =>
      this.hasValidationSignal(item.text),
    );

    const joinedSignals = [
      refinedEpic.summary,
      refinedEpic.recommendedApproach,
      ...refinedEpic.scopeIn,
      ...refinedEpic.acceptanceCriteria,
      ...refinedEpic.scopeOut,
      ...refinedEpic.openQuestions,
    ]
      .join(' ')
      .toLowerCase();
    const suppressFrontendTasks = this.shouldSuppressFrontendTasks(joinedSignals);
    const hasUiSignal =
      !suppressFrontendTasks &&
      (frontendScope.length > 0 || this.hasFrontendSignal(joinedSignals));
    const hasBackendSignal =
      backendScope.length > 0 || this.hasBackendSignal(joinedSignals);

    if (!refinedEpic.readyToPlan && refinedEpic.openQuestions.length > 0) {
      tasks.push({
        title: 'Requirements clarification',
        type: 'contract',
        goal: `Resolve open planning questions for ${epicLabel} before implementation.`,
        scope: refinedEpic.openQuestions
          .slice(0, 3)
          .map((question) => `Clarify: ${question}`),
        acceptance: ['Open questions are resolved and reflected in scope decisions'],
        sourceRefs: this.buildSourceRefs(
          effectiveScopeItems.slice(0, 2),
          acceptanceItems.slice(0, 1),
        ),
      });
    }

    if (contractScope.length > 0 || (hasUiSignal && hasBackendSignal)) {
      const scopedItems =
        contractScope.length > 0 ? contractScope : effectiveScopeItems.slice(0, 2);
      tasks.push({
        title: 'API contract',
        type: 'contract',
        goal: `Define integration contract for ${epicLabel}.`,
        scope: this.toScopeLines(scopedItems, ['Define request/response fields']),
        acceptance: this.toAcceptanceLines(
          validationAcceptance,
          acceptanceItems,
          ['Contract is documented and agreed between client and server'],
        ),
        sourceRefs: this.buildSourceRefs(scopedItems, validationAcceptance),
      });
    }

    if (exportScope.length > 0) {
      tasks.push({
        title: this.pickExportTaskTitle(exportScope, epicLabel),
        type: 'backend',
        goal: `Implement export behavior required by ${epicLabel}.`,
        scope: this.toScopeLines(exportScope, ['Generate and return export data']),
        acceptance: this.toAcceptanceLines(
          acceptanceItems,
          validationAcceptance,
          ['Export output is generated in the expected format'],
        ),
        sourceRefs: this.buildSourceRefs(exportScope, acceptanceItems),
      });
    }

    if (readScope.length > 0) {
      tasks.push({
        title: this.pickReadTaskTitle(readScope),
        type: 'backend',
        goal: `Implement read operations required by ${epicLabel}.`,
        scope: this.toScopeLines(readScope, ['Expose read endpoint for core data']),
        acceptance: this.toAcceptanceLines(
          acceptanceItems,
          validationAcceptance,
          ['Read endpoint returns expected data for valid input'],
        ),
        sourceRefs: this.buildSourceRefs(readScope, acceptanceItems),
      });
    }

    if (createScope.length > 0) {
      tasks.push({
        title: this.pickCreateTaskTitle(createScope),
        type: 'backend',
        goal: `Implement create operations required by ${epicLabel}.`,
        scope: this.toScopeLines(createScope, ['Persist new records for the main flow']),
        acceptance: this.toAcceptanceLines(
          acceptanceItems,
          validationAcceptance,
          ['Create flow stores data and returns a stable response'],
        ),
        sourceRefs: this.buildSourceRefs(createScope, acceptanceItems),
      });
    }

    if (changeScope.length > 0) {
      tasks.push({
        title: this.pickChangeTaskTitle(changeScope),
        type: 'backend',
        goal: `Implement update/cancellation operations for ${epicLabel}.`,
        scope: this.toScopeLines(changeScope, ['Support lifecycle changes for existing records']),
        acceptance: this.toAcceptanceLines(
          acceptanceItems,
          validationAcceptance,
          ['Lifecycle changes are validated and persisted correctly'],
        ),
        sourceRefs: this.buildSourceRefs(changeScope, acceptanceItems),
      });
    }

    if (authScope.length > 0) {
      tasks.push({
        title: 'Access control rules',
        type: 'backend',
        goal: `Enforce role and access constraints for ${epicLabel}.`,
        scope: this.toScopeLines(authScope, ['Restrict operation to allowed roles']),
        acceptance: this.toAcceptanceLines(
          acceptanceItems,
          validationAcceptance,
          ['Unauthorized requests are rejected'],
        ),
        sourceRefs: this.buildSourceRefs(authScope, acceptanceItems),
      });
    }

    if (hasUiSignal) {
      const scopedItems =
        frontendScope.length > 0 ? frontendScope : [...readScope, ...createScope].slice(0, 3);
      tasks.push({
        title: this.pickFrontendTaskTitle(frontendScope),
        type: hasBackendSignal ? 'frontend' : 'fullstack',
        goal: `Implement user-facing flow for ${epicLabel}.`,
        scope: this.toScopeLines(scopedItems, ['Build the core user interaction flow']),
        acceptance: this.toAcceptanceLines(
          acceptanceItems,
          validationAcceptance,
          ['Users can complete the primary flow with clear feedback'],
        ),
        sourceRefs: this.buildSourceRefs(scopedItems, acceptanceItems),
      });
    }

    const shouldAddQa =
      acceptanceItems.length >= 2 ||
      effectiveScopeItems.length >= 4 ||
      (hasUiSignal && hasBackendSignal);

    if (shouldAddQa) {
      tasks.push({
        title: 'Flow verification',
        type: 'qa',
        goal: `Validate the critical scenarios for ${epicLabel}.`,
        scope: this.toScopeLines(
          [...effectiveScopeItems].slice(0, 3),
          ['Verify happy path and key failure behavior'],
        ),
        acceptance: this.toAcceptanceLines(
          acceptanceItems,
          validationAcceptance,
          ['Critical scenarios are covered by QA checks'],
        ),
        sourceRefs: this.buildSourceRefs(
          effectiveScopeItems.slice(0, 3),
          acceptanceItems,
        ),
      });
    }

    if (tasks.length === 0 && effectiveScopeItems.length > 0) {
      const firstScope = effectiveScopeItems[0]?.text ?? 'core workflow';
      tasks.push({
        title: this.toTitleCase(firstScope),
        type: 'fullstack',
        goal: `Deliver the first vertical slice for ${epicLabel}.`,
        scope: this.toScopeLines(effectiveScopeItems, [
          'Implement one end-to-end working slice',
        ]),
        acceptance: this.toAcceptanceLines(
          acceptanceItems,
          validationAcceptance,
          ['Primary feature slice works end-to-end'],
        ),
        sourceRefs: this.buildSourceRefs(effectiveScopeItems, acceptanceItems),
      });
    }

    const deduped = this.dedupeByTitle(tasks);
    return this.applyComplexityBudget(
      deduped,
      effectiveScopeItems.length,
      acceptanceItems.length,
    );
  }

  private applyComplexityBudget(
    tasks: PlannedTask[],
    scopeCount: number,
    acceptanceCount: number,
  ): PlannedTask[] {
    const complexity = scopeCount + acceptanceCount;

    if (complexity <= 3 && tasks.length > 3) {
      return tasks.filter((task) => task.type !== 'qa').slice(0, 3);
    }

    if (complexity >= 6 && tasks.length >= 2 && tasks.length < 5) {
      const hasQa = tasks.some((task) => task.type === 'qa');
      if (!hasQa) {
        const first = tasks[0];
        tasks.push({
          title: 'Flow verification',
          type: 'qa',
          goal: `Validate integrated behavior for ${first.goal.replace(/^Implement\s+/i, '')}`,
          scope: ['Run happy path', 'Run key validation checks'],
          acceptance: ['Critical flow checks are automated or documented'],
          sourceRefs: [...first.sourceRefs],
        });
      }
    }

    return tasks.slice(0, 7);
  }

  private dedupeByTitle(tasks: PlannedTask[]): PlannedTask[] {
    const seen = new Set<string>();
    const deduped: PlannedTask[] = [];

    for (const task of tasks) {
      const key = task.title.trim().toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      deduped.push(task);
    }

    return deduped;
  }

  private buildSourceRefs(
    scopeItems: IndexedItem[],
    acceptanceItems: IndexedItem[],
  ): string[] {
    const refs = [
      ...scopeItems.map((item) => item.ref),
      ...acceptanceItems.map((item) => item.ref),
    ];

    return this.unique(refs).slice(0, 6);
  }

  private toScopeLines(items: IndexedItem[], fallback: string[]): string[] {
    if (items.length === 0) {
      return fallback;
    }

    return this.unique(items.map((item) => item.text)).slice(0, 4);
  }

  private toAcceptanceLines(
    primary: IndexedItem[],
    secondary: IndexedItem[],
    fallback: string[],
  ): string[] {
    const lines = this.unique([
      ...primary.map((item) => this.ensurePeriod(item.text)),
      ...secondary.map((item) => this.ensurePeriod(item.text)),
    ]);

    if (lines.length === 0) {
      return fallback;
    }

    return lines.slice(0, 4);
  }

  private pickReadTaskTitle(items: IndexedItem[]): string {
    const text = items.map((item) => item.text.toLowerCase()).join(' ');

    if (text.includes('availability') || text.includes('slot')) {
      return 'Availability API';
    }

    return 'Read endpoint';
  }

  private pickCreateTaskTitle(items: IndexedItem[]): string {
    const text = items.map((item) => item.text.toLowerCase()).join(' ');

    if (text.includes('appointment')) {
      return 'Create appointment endpoint';
    }

    return 'Create endpoint';
  }

  private pickChangeTaskTitle(items: IndexedItem[]): string {
    const text = items.map((item) => item.text.toLowerCase()).join(' ');

    if (text.includes('cancel') && text.includes('reschedule')) {
      return 'Cancel and reschedule endpoint';
    }

    if (text.includes('cancel')) {
      return 'Cancel endpoint';
    }

    if (text.includes('update') || text.includes('edit')) {
      return 'Update endpoint';
    }

    return 'Lifecycle endpoint';
  }

  private pickFrontendTaskTitle(items: IndexedItem[]): string {
    const text = items.map((item) => item.text.toLowerCase()).join(' ');

    if (text.includes('form')) {
      return 'Form UI';
    }

    if (text.includes('dashboard')) {
      return 'Dashboard flow UI';
    }

    return 'Feature flow UI';
  }

  private pickExportTaskTitle(items: IndexedItem[], epicLabel: string): string {
    const text = items.map((item) => item.text.toLowerCase()).join(' ');

    if (text.includes('csv') && text.includes('billing')) {
      return 'Billing CSV export endpoint';
    }

    if (text.includes('csv')) {
      return 'CSV export endpoint';
    }

    if (text.includes('report')) {
      return 'Reporting export endpoint';
    }

    return `${epicLabel} export endpoint`;
  }

  private indexItems(items: string[], prefix: 'scope' | 'acceptance'): IndexedItem[] {
    return this.unique(items.map((item) => this.cleanText(item)))
      .filter((item) => item.length > 0)
      .map((text, index) => ({
        text,
        ref: `${prefix}:${index + 1}`,
      }));
  }

  private filterOutOfScope(
    scopeItems: IndexedItem[],
    outOfScopeKeywords: Set<string>,
  ): IndexedItem[] {
    if (outOfScopeKeywords.size === 0) {
      return scopeItems;
    }

    const filtered = scopeItems.filter((item) => {
      const keywords = this.extractKeywords([item.text]);

      for (const keyword of keywords) {
        if (outOfScopeKeywords.has(keyword)) {
          return false;
        }
      }

      return true;
    });

    return filtered.length > 0 ? filtered : scopeItems;
  }

  private extractKeywords(lines: string[]): Set<string> {
    const keywords = new Set<string>();

    for (const line of lines) {
      const normalized = line.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      for (const token of normalized.split(/\s+/)) {
        if (token.length < 4) {
          continue;
        }
        keywords.add(token);
      }
    }

    return keywords;
  }

  private cleanText(text: string): string {
    return text.trim().replace(/^[-*]\s*/, '').replace(/\s+/g, ' ');
  }

  private normalizeEpicLabel(title: string): string {
    const normalized = this.cleanText(title);
    const createMatch = normalized.match(
      /\b(create|build|implement|develop|design)\s+(?:a|an|the)?\s*([^,.]+?)(?:\s+so\b|\s+for\b|\s+that\b|$)/i,
    );

    if (createMatch && createMatch[2]) {
      return this.toTitleCase(createMatch[2]);
    }

    const split = normalized
      .replace(/^i\s+(want|need|would like)\s+to\s+/i, '')
      .split(/\s+so(?:\s+that)?\s+/i)[0]
      .trim();

    const words = split.split(/\s+/).slice(0, 5).join(' ');
    return this.toTitleCase(words || normalized);
  }

  private hasReadSignal(text: string): boolean {
    return /(view|list|fetch|get|search|availability|show)/i.test(text);
  }

  private hasExportSignal(text: string): boolean {
    return /(export|csv|report|download)/i.test(text);
  }

  private hasCreateSignal(text: string): boolean {
    return /(create|book|submit|add|schedule)/i.test(text);
  }

  private hasChangeSignal(text: string): boolean {
    return /(cancel|reschedule|update|edit|modify|delete|remove)/i.test(text);
  }

  private hasAuthSignal(text: string): boolean {
    return /(admin|internal|role|access|permission|authorize|authorization|auth)/i.test(
      text,
    );
  }

  private hasValidationSignal(text: string): boolean {
    return /(valid|invalid|reject|error|constraint|persist|saved|required)/i.test(text);
  }

  private hasFrontendSignal(text: string): boolean {
    return /(ui|form|dashboard|page|screen|button|frontend|portal|web|mobile|online)/i.test(
      text,
    );
  }

  private hasNegativeFrontendSignal(text: string): boolean {
    return /(no frontend|without frontend|no ui|without ui|no redesign|keep (current|existing) ui)/i.test(
      text,
    );
  }

  private shouldSuppressFrontendTasks(text: string): boolean {
    const hasNegativeSignal = this.hasNegativeFrontendSignal(text) || /(backend[-\s]?only|api[-\s]?only|internal[-\s]?only)/i.test(text);

    if (!hasNegativeSignal) {
      return false;
    }

    const hasPositiveOverride = /(build|create|design|implement)\s+(a|the)?\s*(frontend|ui|form|page|screen)/i.test(
      text,
    );

    return !hasPositiveOverride;
  }

  private hasBackendSignal(text: string): boolean {
    return /(api|endpoint|service|server|database|persist|slot|record|query|mutation|export|csv|report)/i.test(
      text,
    );
  }

  private hasContractSignal(text: string): boolean {
    return /(contract|schema|payload|dto|interface|field)/i.test(text);
  }

  private ensurePeriod(text: string): string {
    const normalized = text.trim();
    if (!normalized) {
      return normalized;
    }

    if (/[.!?]$/.test(normalized)) {
      return normalized;
    }

    return `${normalized}.`;
  }

  private toTitleCase(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return normalized;
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  }
}
