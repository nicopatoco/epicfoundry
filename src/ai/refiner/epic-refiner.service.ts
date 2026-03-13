import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/app-logger.service';
import { Epic } from '../../models/epic';
import { RefinedEpic, refinedEpicSchema } from '../../models/refined-epic';

type Actor = 'customers' | 'users' | 'admins';
type Domain = 'booking' | 'billing' | 'profile' | 'generic';

@Injectable()
export class EpicRefinerService {
  constructor(private readonly logger: AppLogger) {}

  async refineEpic(epic: Epic): Promise<RefinedEpic> {
    const actor = this.inferActor(`${epic.rawTitle} ${epic.rawDescription}`);
    const domain = this.inferDomain(`${epic.title} ${epic.rawDescription}`);
    const scopeIn = this.buildScopeIn(epic, actor, domain);
    const scopeOut = this.buildScopeOut(epic.outOfScope ?? []);
    const assumptions = this.buildAssumptions(epic);
    const acceptanceCriteria = this.buildAcceptanceCriteria(
      scopeIn,
      epic,
      actor,
      assumptions,
    );
    const openQuestions = this.buildOpenQuestions(domain, epic, assumptions);

    this.logger.log(
      `Generated ${acceptanceCriteria.length} acceptance criteria from ${scopeIn.length} scope items`,
      'Refine',
    );

    const candidate: RefinedEpic = {
      title: epic.title,
      summary: this.buildSummary(epic),
      scopeIn,
      scopeOut,
      assumptions,
      openQuestions,
      acceptanceCriteria,
      recommendedApproach: this.buildRecommendedApproach(epic.title, domain),
      readyToPlan: scopeIn.length > 0 && acceptanceCriteria.length > 0,
    };

    const validated = refinedEpicSchema.safeParse(candidate);

    if (validated.success) {
      return validated.data;
    }

    this.logger.warn(
      `RefinedEpic validation failed for "${epic.title}". Returning safe fallback refinement.`,
      'Refine',
    );

    return {
      title: epic.title,
      summary: `Feature refinement for ${epic.title}`,
      scopeIn: ['Users can complete the primary workflow'],
      scopeOut: [],
      assumptions: ['Assume existing project setup remains unchanged'],
      openQuestions: ['What should be included in the first release?'],
      acceptanceCriteria: ['Primary capability is implemented and verified'],
      recommendedApproach: 'Start with one vertical slice and iterate.',
      readyToPlan: true,
    };
  }

  private buildScopeIn(epic: Epic, actor: Actor, domain: Domain): string[] {
    const source = epic.scope && epic.scope.length > 0 ? epic.scope : this.fallbackScope(domain);
    const capabilities = source.flatMap((item) => this.expandScopeItem(item, actor, domain));
    const scope = this.unique(capabilities);

    if (scope.length > 0) {
      return scope;
    }

    return this.fallbackScope(domain);
  }

  private buildScopeOut(source: string[]): string[] {
    return this.unique(
      source.map((item) => {
        const lowered = item.toLowerCase();

        if (/frontend redesign|ui redesign/.test(lowered)) {
          return 'Frontend redesign';
        }

        if (/payment/.test(lowered)) {
          return 'Payments';
        }

        if (/multi[-\s]?location/.test(lowered)) {
          return 'Multi-location support';
        }

        if (/sms/.test(lowered)) {
          return 'SMS notifications';
        }

        return this.toSentenceCase(item);
      }),
    );
  }

  private buildAssumptions(epic: Epic): string[] {
    const assumptions = [
      ...(epic.constraints ?? []),
      ...(epic.context ?? []).map((item) => `Context: ${item}`),
    ];

    if (assumptions.length === 0) {
      return ['No special assumptions identified'];
    }

    return this.unique(assumptions.map((item) => this.toSentenceCase(item)));
  }

  private buildAcceptanceCriteria(
    scopeIn: string[],
    epic: Epic,
    defaultActor: Actor,
    assumptions: string[],
  ): string[] {
    const criteria = scopeIn.flatMap((scopeItem) =>
      this.deriveAcceptanceForScopeItem(scopeItem, defaultActor),
    );
    const explicitAcceptance = (epic.acceptance ?? []).filter(
      (item) => !/(flow validated|primary user flow|end-to-end|handled clearly)/i.test(item),
    );
    criteria.push(...explicitAcceptance.map((item) => this.toSentenceCase(item)));

    if (scopeIn.some((item) => /create appointments/i.test(item))) {
      criteria.push('Unavailable slots cannot be booked');
    }

    if (
      scopeIn.some((item) => /export billing data/i.test(item)) &&
      (epic.rawDescription.toLowerCase().includes('csv') ||
        assumptions.some((item) => item.toLowerCase().includes('csv')))
    ) {
      criteria.push('Billing export is generated in CSV format');
    }

    if (
      scopeIn.some((item) => /export billing data/i.test(item)) &&
      (epic.rawDescription.toLowerCase().includes('admin') ||
        assumptions.some((item) => item.toLowerCase().includes('internal')))
    ) {
      criteria.push('Only admins can export billing data');
    }

    const normalized = this.unique(criteria.map((item) => this.toSentenceCase(item)));
    if (normalized.length > 0) {
      return normalized;
    }

    return ['Primary capability is implemented and verified'];
  }

  private buildOpenQuestions(domain: Domain, epic: Epic, assumptions: string[]): string[] {
    const questions: string[] = [];
    const lowered = epic.rawDescription.toLowerCase();

    if (
      domain === 'booking' &&
      !assumptions.some((item) => /(single professional|one professional)/i.test(item))
    ) {
      questions.push('How many professionals should the booking flow support in V1?');
    }

    if (domain === 'booking' && !/duration|slot length/.test(lowered)) {
      questions.push('What is the default appointment duration?');
    }

    if (domain === 'billing' && !/timezone/.test(lowered)) {
      questions.push('Which timezone defines the monthly billing boundary?');
    }

    if (domain === 'profile' && /photo|avatar/.test(lowered) && !/size|format/.test(lowered)) {
      questions.push('What file size and formats are allowed for profile photos?');
    }

    if (questions.length === 0) {
      questions.push('Are there any additional constraints for V1 delivery?');
    }

    return questions.slice(0, 3);
  }

  private buildSummary(epic: Epic): string {
    const fallback = `This epic describes a feature for ${epic.title.toLowerCase()}.`;

    if (!epic.goal || epic.goal.trim().length === 0) {
      return fallback;
    }

    return `This epic describes ${epic.goal.trim().replace(/\.$/, '')}.`;
  }

  private buildRecommendedApproach(title: string, domain: Domain): string {
    if (domain === 'booking') {
      return 'Start with slot visibility, then implement appointment creation and lifecycle actions.';
    }

    if (domain === 'billing') {
      return 'Implement backend export first and keep existing UI unchanged for V1.';
    }

    if (domain === 'profile') {
      return 'Implement profile update endpoints and media handling with validation first.';
    }

    return `Deliver a small vertical slice for ${title} first, then iterate.`;
  }

  private expandScopeItem(item: string, actor: Actor, domain: Domain): string[] {
    const normalized = item.toLowerCase().replace(/[.!?]/g, ' ');
    const segments = normalized
      .replace(/\bmaybe\b/g, ' ')
      .split(/\s*,\s*|\s+and\s+|\s+or\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    const expanded: string[] = [];
    let currentVerb: string | null = null;

    for (const segment of segments) {
      const verbMatch = segment.match(
        /\b(view|list|fetch|get|show|book|create|schedule|cancel|reschedule|update|edit|upload|export|download)\b/,
      );

      const verb = verbMatch?.[1] ?? currentVerb;
      if (!verb) {
        continue;
      }

      currentVerb = verb;
      const effectiveSegment = verbMatch ? segment : `${verb} ${segment}`;
      expanded.push(...this.mapSegmentToCapability(effectiveSegment, actor, domain));
    }

    if (expanded.length > 0) {
      return expanded.map((entry) => this.toSentenceCase(entry));
    }

    return [this.toSentenceCase(item)];
  }

  private mapSegmentToCapability(
    segment: string,
    actor: Actor,
    domain: Domain,
  ): string[] {
    const text = segment.toLowerCase();
    const capabilities: string[] = [];

    if (
      /(view|list|fetch|get|show)/.test(text) &&
      /(slot|availability|appointment)/.test(text)
    ) {
      capabilities.push(`${actor} can view available slots`);
    }

    if (/(book|create|schedule)/.test(text) && /(appointment|booking|slot|them)/.test(text)) {
      capabilities.push(`${actor} can create appointments`);
    }

    if (/\bcancel\b/.test(text)) {
      capabilities.push(`${actor} can cancel appointments`);
    }

    if (/reschedul/.test(text)) {
      capabilities.push(`${actor} can reschedule appointments`);
    }

    if (/(export|download)/.test(text) && /(billing|invoice|report|csv)/.test(text)) {
      capabilities.push(
        /\bmonth\b/.test(text)
          ? `${actor} can export billing data by month`
          : `${actor} can export billing data`,
      );
    }

    if (/(update|edit)/.test(text) && /(display name|name)/.test(text)) {
      capabilities.push(`${actor} can update display name`);
    }

    if (/(update|edit|upload)/.test(text) && /(profile photo|photo|avatar|image)/.test(text)) {
      capabilities.push(`${actor} can update profile photo`);
    }

    if (/(update|edit)/.test(text) && /\bemail\b/.test(text)) {
      capabilities.push(`${actor} can update email`);
    }

    if (domain === 'profile' && /profile/.test(text) && /(update|edit)/.test(text)) {
      capabilities.push(`${actor} can update profile details`);
    }

    return capabilities;
  }

  private deriveAcceptanceForScopeItem(item: string, fallbackActor: Actor): string[] {
    const text = item.toLowerCase();
    const actor = this.inferActor(item, fallbackActor);

    if (/create appointments/.test(text)) {
      return [`${actor} can create an appointment`];
    }

    if (/cancel appointments/.test(text)) {
      return [`${actor} can cancel an appointment`];
    }

    if (/reschedule appointments/.test(text)) {
      return [`${actor} can reschedule an appointment`];
    }

    if (/view available slots/.test(text)) {
      return [`${actor} can view available slots`];
    }

    if (/export billing data by month/.test(text)) {
      return ['Admins can export billing data by month'];
    }

    if (/export billing data/.test(text)) {
      return ['Admins can export billing data'];
    }

    if (/update display name/.test(text)) {
      return [`${actor} can update display name`];
    }

    if (/update profile photo/.test(text)) {
      return [`${actor} can update profile photo`];
    }

    if (/update email/.test(text)) {
      return [`${actor} can update email`];
    }

    return [];
  }

  private fallbackScope(domain: Domain): string[] {
    if (domain === 'booking') {
      return [
        'Customers can view available slots',
        'Customers can create appointments',
        'Customers can cancel appointments',
      ];
    }

    if (domain === 'billing') {
      return ['Admins can export billing data'];
    }

    if (domain === 'profile') {
      return ['Users can update profile details'];
    }

    return ['Users can complete the primary workflow'];
  }

  private inferActor(text: string, fallback: Actor = 'users'): Actor {
    const lowered = text.toLowerCase();

    if (/(admin|administrator)/.test(lowered)) {
      return 'admins';
    }

    if (/(customer|client)/.test(lowered)) {
      return 'customers';
    }

    if (/(user|users)/.test(lowered)) {
      return 'users';
    }

    return fallback;
  }

  private inferDomain(text: string): Domain {
    const lowered = text.toLowerCase();

    if (/(appointment|booking|slot|reschedule|cancel)/.test(lowered)) {
      return 'booking';
    }

    if (/(billing|invoice|csv|export|report)/.test(lowered)) {
      return 'billing';
    }

    if (/(profile|display name|photo|avatar|email)/.test(lowered)) {
      return 'profile';
    }

    return 'generic';
  }

  private unique(values: string[]): string[] {
    return Array.from(
      new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
    );
  }

  private toSentenceCase(text: string): string {
    const normalized = text.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      return normalized;
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}
