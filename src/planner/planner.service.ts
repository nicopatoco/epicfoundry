import { Injectable } from '@nestjs/common';
import { Epic } from '../models/epic';
import { Task } from '../models/task';

@Injectable()
export class PlannerService {
  planTasks(epic: Epic): Task[] {
    const epicTitle = epic.title;

    return [
      {
        title: `${epicTitle} - API contract`,
        type: 'api-contract',
        goal: `Define API contract for ${epicTitle}`,
        acceptance: ['Request and response schema documented'],
        epicTitle,
      },
      {
        title: `${epicTitle} - Backend endpoint`,
        type: 'backend-endpoint',
        goal: `Implement backend endpoint for ${epicTitle}`,
        acceptance: ['Endpoint is implemented and unit-tested'],
        epicTitle,
      },
      {
        title: `${epicTitle} - Frontend form`,
        type: 'frontend-form',
        goal: `Implement frontend form for ${epicTitle}`,
        acceptance: ['Form validates user input and sends data'],
        epicTitle,
      },
      {
        title: `${epicTitle} - E2E verification`,
        type: 'e2e-verification',
        goal: `Verify end-to-end behavior for ${epicTitle}`,
        acceptance: ['Critical user flow passes in E2E tests'],
        epicTitle,
      },
    ];
  }

  planTasksFromEpics(epics: Epic[]): Task[] {
    return epics.flatMap((epic) => this.planTasks(epic));
  }
}
