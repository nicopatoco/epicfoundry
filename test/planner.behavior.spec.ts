import { AgentPolicyService } from '../src/ai/agent-policy.service';
import { RefinedEpic } from '../src/models/refined-epic';
import { PlannerService } from '../src/planner/planner.service';
import { AnthropicPlannerProvider } from '../src/ai/providers/planner/anthropic-planner.provider';
import { AppLogger } from '../src/common/logger/app-logger.service';
import { Task } from '../src/models/task';
import { ConfigService } from '../src/config/config.service';

function createPlanner(): PlannerService {
  const logger = new AppLogger();
  const policy = new AgentPolicyService(new ConfigService());
  const provider = new AnthropicPlannerProvider(logger);

  return new PlannerService(policy, provider, logger);
}

function refinedEpic(overrides: Partial<RefinedEpic>): RefinedEpic {
  return {
    title: 'Untitled epic',
    summary: 'Default summary',
    scopeIn: ['Deliver core workflow'],
    scopeOut: [],
    assumptions: [],
    openQuestions: [],
    acceptanceCriteria: ['Primary flow works'],
    recommendedApproach: 'Start with a small vertical slice.',
    readyToPlan: true,
    ...overrides,
  };
}

function joinedTaskText(tasks: Task[]): string {
  return tasks
    .flatMap((task) => [task.title, task.goal, ...task.scope, ...task.acceptance])
    .join(' ')
    .toLowerCase();
}

describe('Planner behavior', () => {
  it('Scenario A: synthesizes booking tasks from booking content', async () => {
    const planner = createPlanner();
    const bookingEpic = refinedEpic({
      title:
        'I want to create a booking system so my customers can manage appointments online',
      summary:
        'Customers can view available slots, create bookings, and cancel or reschedule appointments.',
      scopeIn: [
        'Customers can view available slots',
        'Customers can book appointments',
        'Customers can cancel appointments',
        'Customers can reschedule appointments',
      ],
      scopeOut: ['Payments', 'Multi-location support'],
      assumptions: ['One professional for V1'],
      openQuestions: ['Should we support variable appointment duration?'],
      acceptanceCriteria: [
        'Available slots are shown correctly',
        'Customers can create appointments',
        'Customers can cancel and reschedule appointments',
      ],
      recommendedApproach: 'Start with one professional and a simple booking flow.',
      readyToPlan: true,
    });

    const tasks = await planner.generateTasksFromRefinedEpic(bookingEpic);
    const text = joinedTaskText(tasks);

    expect(tasks.length).toBeGreaterThanOrEqual(4);
    expect(tasks.some((task) => /availability|slot/i.test(task.title))).toBe(true);
    expect(tasks.some((task) => /create|book/i.test(task.title + ' ' + task.goal))).toBe(
      true,
    );
    expect(
      tasks.some((task) => /cancel|reschedule/i.test(task.title + ' ' + task.goal)),
    ).toBe(true);
    expect(text).not.toContain('payment');
    expect(tasks.some((task) => task.title.toLowerCase().includes('core feature slice'))).toBe(
      false,
    );
  });

  it('Scenario B: produces billing export tasks without unrelated booking/frontend work', async () => {
    const planner = createPlanner();
    const billingEpic = refinedEpic({
      title: 'Billing CSV export',
      summary:
        'Admins export billing data by month for internal operations. CSV export is enough for V1.',
      scopeIn: [
        'Admin can export billing data by month',
        'CSV format is sufficient for V1',
        'Internal-only access for admins',
        'No frontend redesign is needed',
      ],
      scopeOut: ['Booking flow changes', 'Public customer-facing UI changes'],
      acceptanceCriteria: [
        'CSV export includes all billing records for selected month',
        'Only admins can run export',
      ],
      recommendedApproach:
        'Implement backend export endpoint first; keep current UI unchanged.',
      readyToPlan: true,
    });

    const tasks = await planner.generateTasksFromRefinedEpic(billingEpic);
    const text = joinedTaskText(tasks);

    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(text).toContain('export');
    expect(text).toContain('billing');
    expect(text).not.toContain('booking');
    expect(tasks.some((task) => task.type === 'frontend' || task.type === 'fullstack')).toBe(
      false,
    );
  });

  it('Scenario C: creates profile update tasks including media/upload behavior', async () => {
    const planner = createPlanner();
    const profileEpic = refinedEpic({
      title: 'Profile update improvements',
      summary: 'Users can update display name and profile photo.',
      scopeIn: ['Update display name', 'Update profile photo upload'],
      acceptanceCriteria: [
        'Display name is updated successfully',
        'Profile photo upload accepts valid image formats',
      ],
      recommendedApproach: 'Implement profile update API and media upload handling.',
      readyToPlan: true,
    });

    const tasks = await planner.generateTasksFromRefinedEpic(profileEpic);
    const text = joinedTaskText(tasks);

    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(text).toContain('profile');
    expect(/upload|photo|media/.test(text)).toBe(true);
    expect(text).not.toContain('billing');
    expect(text).not.toContain('csv');
  });

  it('Planner quality: infers variable task count, content-driven titles, and source coverage', async () => {
    const planner = createPlanner();

    const bookingTasks = await planner.generateTasksFromRefinedEpic(
      refinedEpic({
        title: 'Booking system',
        scopeIn: [
          'View available slots',
          'Create appointment',
          'Cancel appointment',
          'Reschedule appointment',
        ],
        acceptanceCriteria: [
          'Slots are returned by date',
          'Invalid booking requests are rejected',
          'Cancellation updates appointment state',
        ],
        readyToPlan: true,
      }),
    );

    const billingTasks = await planner.generateTasksFromRefinedEpic(
      refinedEpic({
        title: 'Billing CSV export',
        scopeIn: ['Export billing data by month', 'CSV output only', 'No frontend redesign'],
        acceptanceCriteria: ['Export endpoint returns valid CSV'],
        recommendedApproach: 'Backend-only change.',
        readyToPlan: true,
      }),
    );

    const profileTasks = await planner.generateTasksFromRefinedEpic(
      refinedEpic({
        title: 'Profile updates',
        scopeIn: ['Update display name', 'Upload profile photo'],
        acceptanceCriteria: ['Updated values persist'],
        readyToPlan: true,
      }),
    );

    const counts = [bookingTasks.length, billingTasks.length, profileTasks.length];
    expect(new Set(counts).size).toBeGreaterThan(1);

    const allTasks = [...bookingTasks, ...billingTasks, ...profileTasks];
    for (const task of allTasks) {
      expect(task.sourceRefs.length).toBeGreaterThan(0);
      expect(task.sourceRefs.some((ref) => /^(scope|acceptance):\d+$/i.test(ref))).toBe(
        true,
      );
      expect(task.title).not.toMatch(
        /^(Core feature slice|Backend implementation|Frontend implementation|QA verification)$/i,
      );
    }
  });
});
