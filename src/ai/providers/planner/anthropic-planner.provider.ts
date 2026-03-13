import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { PlannedTask, RefinedEpic } from '../../ai.types';
import { PlannerProvider } from './planner-provider.interface';
import { buildPlannerPrompt } from './planner-prompt';
import { PlannerResponse, plannerResponseSchema } from './planner-schema';

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
      acceptance: task.acceptance.map((item) => item.trim()),
    }));
  }

  private simulateModelResponse(refinedEpic: RefinedEpic): unknown {
    const title = refinedEpic.title.toLowerCase();

    if (title.includes('booking')) {
      return {
        tasks: [
          {
            title: `${refinedEpic.title} — Availability API`,
            type: 'backend',
            goal: 'Expose available appointment slots for selected date and professional.',
            acceptance: [
              'Endpoint returns available slots for date range',
              'Unavailable slots are excluded',
            ],
          },
          {
            title: `${refinedEpic.title} — Booking flow UI`,
            type: 'frontend',
            goal: 'Allow customer to select slot and create booking from UI.',
            acceptance: [
              'Customer can select a valid slot',
              'Booking confirmation is shown after submit',
            ],
          },
          {
            title: `${refinedEpic.title} — Booking mutation endpoint`,
            type: 'backend',
            goal: 'Create and cancel bookings with validation rules.',
            acceptance: [
              'Create booking rejects overlapping slots',
              'Cancel booking marks status as cancelled',
            ],
          },
          {
            title: `${refinedEpic.title} — End-to-end booking verification`,
            type: 'qa',
            goal: 'Validate full booking journey from slot selection to cancellation.',
            acceptance: [
              'Booking happy path passes',
              'Cancellation path passes',
            ],
          },
        ],
      };
    }

    if (title.includes('profile')) {
      return {
        tasks: [
          {
            title: `${refinedEpic.title} — Profile update API`,
            type: 'backend',
            goal: 'Implement API contract and endpoint for profile updates.',
            acceptance: [
              'Name and email updates persist',
              'Invalid email is rejected',
            ],
          },
          {
            title: `${refinedEpic.title} — Profile edit form`,
            type: 'frontend',
            goal: 'Provide editable profile form with client-side validation.',
            acceptance: [
              'User can edit and submit profile form',
              'Validation messages are shown for invalid input',
            ],
          },
          {
            title: `${refinedEpic.title} — Profile integration tests`,
            type: 'qa',
            goal: 'Cover backend and UI profile update scenarios.',
            acceptance: [
              'Backend integration tests pass',
              'UI integration tests pass',
            ],
          },
        ],
      };
    }

    return {
      tasks: [
        {
          title: `${refinedEpic.title} — Backend implementation`,
          type: 'backend',
          goal: `Implement backend support for ${refinedEpic.title}.`,
          acceptance: ['Backend behavior matches refined scope'],
        },
        {
          title: `${refinedEpic.title} — Frontend implementation`,
          type: 'frontend',
          goal: `Implement frontend workflow for ${refinedEpic.title}.`,
          acceptance: ['Frontend behavior matches refined scope'],
        },
        {
          title: `${refinedEpic.title} — QA verification`,
          type: 'qa',
          goal: `Verify critical flow for ${refinedEpic.title}.`,
          acceptance: ['Happy path and one failure path are validated'],
        },
      ],
    };
  }
}
