import { Task } from '../models/task';

export function formatTaskCardDescription(task: Task): string {
  const scope = task.scope.map((item) => `- ${item}`).join('\n');
  const acceptance = task.acceptance.map((item) => `- ${item}`).join('\n');

  const sections = [
    'Type:',
    task.type,
    '',
    'Goal:',
    task.goal,
    '',
    'Scope:',
    scope,
    '',
    'Acceptance:',
    acceptance,
  ];

  if (task.project) {
    sections.push('', 'Project:', task.project);
  }

  sections.push('', 'Epic:', task.epicTitle);

  return sections.join('\n');
}
