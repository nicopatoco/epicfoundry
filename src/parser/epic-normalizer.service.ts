import { Injectable } from '@nestjs/common';
import { AppLogger } from '../common/logger/app-logger.service';
import { Epic, epicSchema } from '../models/epic';

export interface RawEpicCardInput {
  id?: string;
  name: string;
  desc?: string;
}

type SectionKey =
  | 'goal'
  | 'context'
  | 'scope'
  | 'outOfScope'
  | 'constraints'
  | 'acceptance'
  | 'project';

type Actor = 'customers' | 'users' | 'admins';
type Domain = 'booking' | 'billing' | 'profile' | 'generic';

@Injectable()
export class EpicNormalizerService {
  constructor(private readonly logger: AppLogger) {}

  normalizeEpic(rawCard: RawEpicCardInput): Epic {
    const rawTitle = rawCard.name.trim();
    const rawDescription = (rawCard.desc ?? '').trim();
    const title = this.cleanTitle(rawTitle);

    const structured = this.parseStructuredSections(rawDescription);

    const candidate: Epic = structured.found
      ? this.buildStructuredEpic(rawCard.id, rawTitle, rawDescription, title, structured)
      : this.buildHeuristicEpic(rawCard.id, rawTitle, rawDescription, title);

    const validated = epicSchema.safeParse(candidate);

    if (validated.success) {
      return validated.data;
    }

    this.logger.warn(
      `Epic normalization validation failed for "${title}". Falling back to minimal canonical epic.`,
      'Normalize',
    );

    return {
      sourceCardId: rawCard.id,
      rawTitle,
      rawDescription,
      title,
      parsingMode: structured.found ? 'structured' : 'heuristic',
    };
  }

  private buildStructuredEpic(
    sourceCardId: string | undefined,
    rawTitle: string,
    rawDescription: string,
    title: string,
    structured: Record<SectionKey, string[]> & { found: boolean },
  ): Epic {
    this.logger.log('Parsed structured epic', 'Normalize');

    const actor = this.inferActor(`${rawTitle} ${rawDescription}`);
    const goal = structured.goal.join(' ').trim();
    const scope = this.normalizeScopeItems(structured.scope, actor, 'structured');
    const outOfScope = this.inferOutOfScope([
      ...structured.outOfScope,
      ...this.extractSentences(rawDescription),
    ]);
    const constraints = this.inferConstraints([
      ...structured.constraints,
      ...this.extractSentences(rawDescription),
    ]);
    const acceptance = this.inferAcceptance(
      scope,
      [...structured.acceptance, ...this.extractSentences(rawDescription)],
      actor,
      constraints,
    );

    return {
      sourceCardId,
      rawTitle,
      rawDescription,
      title,
      goal: goal.length > 0 ? goal : undefined,
      context: this.optionalArray(structured.context.map((item) => this.normalizeSentence(item))),
      scope: this.optionalArray(scope),
      outOfScope: this.optionalArray(outOfScope),
      constraints: this.optionalArray(constraints),
      acceptance: this.optionalArray(acceptance),
      project: structured.project[0],
      parsingMode: 'structured',
    };
  }

  private buildHeuristicEpic(
    sourceCardId: string | undefined,
    rawTitle: string,
    rawDescription: string,
    title: string,
  ): Epic {
    this.logger.log('Parsed heuristic epic', 'Normalize');

    const sentences = this.extractSentences(rawDescription);
    const actor = this.inferActor(`${rawTitle} ${rawDescription}`);
    const goal = this.inferGoal(sentences, title);
    const scope = this.inferScope(sentences, actor);
    const outOfScope = this.inferOutOfScope(sentences);
    const constraints = this.inferConstraints(sentences);
    const acceptance = this.inferAcceptance(scope, sentences, actor, constraints);
    const context = this.inferContext(sentences);

    return {
      sourceCardId,
      rawTitle,
      rawDescription,
      title,
      goal,
      scope: this.optionalArray(scope),
      outOfScope: this.optionalArray(outOfScope),
      constraints: this.optionalArray(constraints),
      acceptance: this.optionalArray(acceptance),
      context: this.optionalArray(context),
      parsingMode: 'heuristic',
    };
  }

  private cleanTitle(rawTitle: string): string {
    const withoutPrefix = rawTitle.replace(/^EPIC:\s*/i, '').trim();

    const createMatch = withoutPrefix.match(
      /\b(create|build|implement|develop|design)\s+(?:a|an|the)?\s*([^,.]+?)(?:\s+so\b|\s+for\b|\s+that\b|$)/i,
    );

    if (createMatch && createMatch[2]) {
      return this.toSentenceCase(createMatch[2]);
    }

    const normalized = withoutPrefix
      .replace(/^i\s+(want|need|would like)\s+to\s+/i, '')
      .split(/\s+so(?:\s+that)?\s+/i)[0]
      .trim();

    if (normalized.length === 0) {
      return withoutPrefix;
    }

    const compact = normalized.split(/\s+/).slice(0, 6).join(' ');
    return this.toSentenceCase(compact);
  }

  private parseStructuredSections(description: string): Record<SectionKey, string[]> & { found: boolean } {
    const sections: Record<SectionKey, string[]> = {
      goal: [],
      context: [],
      scope: [],
      outOfScope: [],
      constraints: [],
      acceptance: [],
      project: [],
    };

    const lines = description.split(/\r?\n/);
    let currentSection: SectionKey | null = null;
    let found = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const section = this.getSectionFromHeading(line);
      if (section) {
        found = true;
        currentSection = section.key;

        if (section.inlineValue.length > 0) {
          sections[section.key].push(this.stripListPrefix(section.inlineValue));
        }

        continue;
      }

      if (!currentSection) {
        continue;
      }

      sections[currentSection].push(this.stripListPrefix(line));
    }

    return {
      ...sections,
      found,
    };
  }

  private getSectionFromHeading(
    line: string,
  ): { key: SectionKey; inlineValue: string } | null {
    const match = line.match(
      /^(Goal|Context|Scope|Out of scope|Out-of-scope|OutOfScope|Constraints?|Acceptance|Project):\s*(.*)$/i,
    );

    if (!match) {
      return null;
    }

    const heading = match[1].toLowerCase();
    const inlineValue = match[2].trim();

    if (heading === 'goal') {
      return { key: 'goal', inlineValue };
    }

    if (heading === 'context') {
      return { key: 'context', inlineValue };
    }

    if (heading === 'scope') {
      return { key: 'scope', inlineValue };
    }

    if (['out of scope', 'out-of-scope', 'outofscope'].includes(heading)) {
      return { key: 'outOfScope', inlineValue };
    }

    if (heading.startsWith('constraint')) {
      return { key: 'constraints', inlineValue };
    }

    if (heading === 'acceptance') {
      return { key: 'acceptance', inlineValue };
    }

    return { key: 'project', inlineValue };
  }

  private inferGoal(sentences: string[], title: string): string {
    const candidate = sentences.find((sentence) =>
      /(i need|i want|allow|lets|so that|customers can|users can|admins can)/i.test(
        sentence,
      ),
    );

    if (candidate) {
      return this.normalizeSentence(candidate);
    }

    if (sentences.length > 0) {
      return this.normalizeSentence(sentences[0]);
    }

    return `Deliver ${title}.`;
  }

  private normalizeScopeItems(
    items: string[],
    defaultActor: Actor,
    mode: 'heuristic' | 'structured',
  ): string[] {
    const capabilities = items.flatMap((item) =>
      this.extractCapabilitiesFromSentence(item, defaultActor),
    );
    const normalized = this.unique(capabilities);

    if (normalized.length > 0) {
      this.logger.log(`Split natural language into ${normalized.length} scope items`, 'Normalize');
      return normalized;
    }

    if (mode === 'structured') {
      return this.unique(items.map((item) => this.normalizeSentence(item)));
    }

    return ['Users can complete the primary workflow'];
  }

  private inferScope(sentences: string[], defaultActor: Actor): string[] {
    const capabilitySentences = sentences.filter((sentence) =>
      /(book|create|cancel|reschedule|view|manage|edit|update|export|upload|download|list)/i.test(
        sentence,
      ),
    );

    return this.normalizeScopeItems(capabilitySentences, defaultActor, 'heuristic');
  }

  private inferOutOfScope(sentences: string[]): string[] {
    const out: string[] = [];

    for (const sentence of sentences) {
      const text = sentence.toLowerCase();

      if (
        /(no frontend redesign|without frontend redesign|no ui redesign|without ui redesign)/i.test(
          text,
        )
      ) {
        out.push('frontend redesign');
      }

      if (/(do not|don't|not yet|without|no)\s+.*payment/i.test(text)) {
        out.push('payments');
      }

      if (/(do not|don't|not yet|without|no)\s+.*multi[-\s]?location/i.test(text)) {
        out.push('multi-location support');
      }

      if (/(do not|don't|not yet|without|no)\s+.*sms/i.test(text)) {
        out.push('sms notifications');
      }
    }

    return this.unique(out.map((item) => this.toSentenceCase(item)));
  }

  private inferConstraints(sentences: string[]): string[] {
    const constraints: string[] = [];

    for (const sentence of sentences) {
      const text = sentence.toLowerCase();

      if (/(one|single)\s+professional/.test(text)) {
        constraints.push('single professional for v1');
      }

      if (/internal[-\s]?only|internal use/.test(text)) {
        constraints.push('internal use only');
      }

      if (/csv.*(enough|sufficient)|csv is enough/.test(text)) {
        constraints.push('csv format for v1');
      }
    }

    return this.unique(constraints.map((item) => this.toSentenceCase(item)));
  }

  private inferAcceptance(
    scope: string[],
    sentences: string[],
    defaultActor: Actor,
    constraints: string[],
  ): string[] {
    const derived = scope.flatMap((item) =>
      this.deriveAcceptanceForScopeItem(item, defaultActor),
    );
    const acceptance = [...derived];
    const joined = sentences.join(' ').toLowerCase();

    if (scope.some((item) => /create appointments/i.test(item))) {
      acceptance.push('Unavailable slots cannot be booked');
    }

    if (
      /csv/.test(joined) ||
      constraints.some((item) => item.toLowerCase().includes('csv'))
    ) {
      acceptance.push('Billing export is generated in CSV format');
    }

    if (
      /internal|admin/.test(joined) ||
      constraints.some((item) => item.toLowerCase().includes('internal'))
    ) {
      acceptance.push('Only admins can perform internal export operations');
    }

    return this.unique(acceptance.map((item) => this.toSentenceCase(item)));
  }

  private inferContext(sentences: string[]): string[] {
    const matches = sentences
      .filter((sentence) => /(for a|for an|for the|business|salon|clinic|store)/i.test(sentence))
      .map((sentence) => this.normalizeSentence(sentence));

    return this.unique(matches);
  }

  private extractCapabilitiesFromSentence(
    sentence: string,
    defaultActor: Actor,
  ): string[] {
    const actor = this.inferActor(sentence, defaultActor);
    const segments = this.splitActionSegments(sentence);
    const domain = this.inferDomain(sentence);

    const capabilities = segments.flatMap((segment) =>
      this.mapSegmentToCapabilities(segment, actor, domain),
    );

    return this.unique(capabilities.map((item) => this.toSentenceCase(item)));
  }

  private mapSegmentToCapabilities(
    segment: string,
    actor: Actor,
    domain: Domain,
  ): string[] {
    const normalized = segment.toLowerCase();
    const capabilities: string[] = [];

    if (
      /(view|list|fetch|get|show)/.test(normalized) &&
      /(slot|availability|appointment)/.test(normalized)
    ) {
      capabilities.push(`${actor} can view available slots`);
    }

    if (/(book|create|schedule)/.test(normalized) && /(appointment|booking|slot|them)/.test(normalized)) {
      capabilities.push(`${actor} can create appointments`);
    }

    if (/\bcancel\b/.test(normalized)) {
      capabilities.push(`${actor} can cancel appointments`);
    }

    if (/reschedul/.test(normalized)) {
      capabilities.push(`${actor} can reschedule appointments`);
    }

    if (/(export|download)/.test(normalized) && /(billing|invoice|report|csv)/.test(normalized)) {
      const withPeriod = /\bmonth\b/.test(normalized)
        ? `${actor} can export billing data by month`
        : `${actor} can export billing data`;
      capabilities.push(withPeriod);
    }

    if (
      /(update|edit)/.test(normalized) &&
      /(display name|name)/.test(normalized)
    ) {
      capabilities.push(`${actor} can update display name`);
    }

    if (
      /(update|edit|upload)/.test(normalized) &&
      /(profile photo|photo|avatar|image)/.test(normalized)
    ) {
      capabilities.push(`${actor} can update profile photo`);
    }

    if (/(update|edit)/.test(normalized) && /\bemail\b/.test(normalized)) {
      capabilities.push(`${actor} can update email`);
    }

    if (domain === 'profile' && /profile/.test(normalized) && /(update|edit)/.test(normalized)) {
      capabilities.push(`${actor} can update profile details`);
    }

    return capabilities;
  }

  private splitActionSegments(sentence: string): string[] {
    const cleaned = sentence
      .toLowerCase()
      .replace(/[.!?]/g, ' ')
      .replace(/\bmaybe\b/g, ' ')
      .replace(
        /\b(i need something that lets|i need something that allows|something that lets|something that allows)\b/g,
        ' ',
      )
      .replace(
        /\b(users|customers|clients|admins)\s+(should be able to|can)\b/g,
        ' ',
      )
      .replace(/\b(my|our)\s+(clients|customers|users)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const rawSegments = cleaned
      .split(/\s*,\s*|\s+and\s+|\s+or\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    const segments: string[] = [];
    let currentVerb: string | null = null;

    for (const segment of rawSegments) {
      const verb = this.extractActionVerb(segment);

      if (verb) {
        currentVerb = verb;
        segments.push(segment);
        continue;
      }

      if (currentVerb && /\b(appointment|appointments|booking|profile|photo|name|email)\b/.test(segment)) {
        segments.push(`${currentVerb} ${segment}`);
      }
    }

    return segments;
  }

  private extractActionVerb(segment: string): string | null {
    const match = segment.match(
      /\b(view|list|fetch|get|show|book|create|schedule|cancel|reschedule|update|edit|upload|export|download)\b/,
    );

    return match ? match[1] : null;
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

  private deriveAcceptanceForScopeItem(item: string, defaultActor: Actor): string[] {
    const lowered = item.toLowerCase();
    const actor = this.inferActor(item, defaultActor);

    if (/create appointments/.test(lowered)) {
      return [`${actor} can create an appointment`];
    }

    if (/cancel appointments/.test(lowered)) {
      return [`${actor} can cancel an appointment`];
    }

    if (/reschedule appointments/.test(lowered)) {
      return [`${actor} can reschedule an appointment`];
    }

    if (/view available slots/.test(lowered)) {
      return [`${actor} can view available slots`];
    }

    if (/export billing data by month/.test(lowered)) {
      return ['Admins can export billing data by month'];
    }

    if (/export billing data/.test(lowered)) {
      return ['Admins can export billing data'];
    }

    if (/update display name/.test(lowered)) {
      return [`${actor} can update display name`];
    }

    if (/update profile photo/.test(lowered)) {
      return [`${actor} can update profile photo`];
    }

    if (/update email/.test(lowered)) {
      return [`${actor} can update email`];
    }

    return [];
  }

  private extractSentences(description: string): string[] {
    return description
      .split(/\r?\n+/)
      .flatMap((line) => line.split(/(?<=[.!?])\s+/))
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
  }

  private stripListPrefix(value: string): string {
    return value.replace(/^[-*]\s*/, '').trim();
  }

  private normalizeSentence(sentence: string): string {
    return this.toSentenceCase(sentence.trim().replace(/\s+/g, ' '));
  }

  private optionalArray(values: string[]): string[] | undefined {
    const normalized = this.unique(values);

    if (normalized.length === 0) {
      return undefined;
    }

    return normalized;
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.map((item) => item.trim()).filter((item) => item.length > 0)));
  }

  private toSentenceCase(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      return normalized;
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}
