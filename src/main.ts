import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app-logger.service';
import { ConfigService } from './config/config.service';
import { Task } from './models/task';
import { EpicParser } from './parser/epic-parser';
import { PlannerService } from './planner/planner.service';
import { TrelloService } from './trello/trello.service';
import { WorkerService } from './worker/worker.service';

type CliCommand = 'setupTrello' | 'planEpics' | 'runWorker';

const REQUIRED_LISTS = ['Epic', 'Todo', 'In Progress', 'Review', 'Done', 'Failed'];
const EPIC_GENERATED_COMMENT = 'EpicFoundry: tasks generated';
const SAMPLE_EPIC_TITLE = 'EPIC: User profile editing';
const SAMPLE_EPIC_DESCRIPTION = [
  'Goal:',
  'Users can edit their profile from the dashboard.',
  '',
  'Scope:',
  '- edit name',
  '- edit email',
  '',
  'Acceptance:',
  '- changes persist',
  '- email validated',
].join('\n');

async function bootstrap() {
  const cliCommand = resolveCliCommand(process.argv.slice(2));

  if (cliCommand) {
    await runCliCommand(cliCommand);
    return;
  }

  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

function resolveCliCommand(args: string[]): CliCommand | null {
  if (args.length === 0) {
    return null;
  }

  const normalized = args.join('').trim().toLowerCase();

  if (normalized === 'setuptrello') {
    return 'setupTrello';
  }

  if (normalized === 'planepics') {
    return 'planEpics';
  }

  if (normalized === 'runworker') {
    return 'runWorker';
  }

  return null;
}

async function runCliCommand(command: CliCommand): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const logger = app.get(AppLogger);

  try {
    ensureTrelloConfig(app.get(ConfigService));

    if (command === 'setupTrello') {
      await runSetupTrello(app.get(TrelloService), logger);
      return;
    }

    if (command === 'planEpics') {
      await runPlanEpics(
        app.get(TrelloService),
        app.get(EpicParser),
        app.get(PlannerService),
        logger,
      );
      return;
    }

    if (command === 'runWorker') {
      const workerService = app.get(WorkerService);
      const summary = await workerService.run();

      logger.log(
        `Worker finished. Processed=${summary.processed}, Succeeded=${summary.succeeded}, Failed=${summary.failed}`,
        'Worker',
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message, error.stack, 'CLI');
    } else {
      logger.error('Unexpected command error', undefined, 'CLI');
    }
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

async function runSetupTrello(
  trelloService: TrelloService,
  logger: AppLogger,
): Promise<void> {
  const hasAccess = await trelloService.validateBoardAccess();

  if (!hasAccess) {
    throw new Error('Cannot access Trello board. Check credentials and board id.');
  }

  const board = await trelloService.getBoard();
  logger.log(`Connected to board: ${board.name}`, 'Setup');

  const ensureResult = await trelloService.ensureLists(REQUIRED_LISTS);
  const createdListNames = new Set(
    ensureResult.created.map((list) => list.name.trim().toLowerCase()),
  );

  for (const listName of REQUIRED_LISTS) {
    const normalized = listName.trim().toLowerCase();

    if (createdListNames.has(normalized)) {
      logger.log(`Created list: ${listName}`, 'Setup');
      continue;
    }

    logger.log(`Found list: ${listName}`, 'Setup');
  }

  const existingEpics = await trelloService.getEpics();

  if (existingEpics.length === 0) {
    const epicList = await trelloService.getListByName('Epic');

    if (!epicList) {
      throw new Error('Epic list is not available after setup.');
    }

    await trelloService.createCard(epicList.id, SAMPLE_EPIC_TITLE, SAMPLE_EPIC_DESCRIPTION);
    logger.log(`Created sample epic: ${SAMPLE_EPIC_TITLE}`, 'Setup');
  }

  logger.log('Complete', 'Setup');
}

async function runPlanEpics(
  trelloService: TrelloService,
  epicParser: EpicParser,
  plannerService: PlannerService,
  logger: AppLogger,
): Promise<void> {
  const epics = await trelloService.getEpics();
  logger.log(`Found ${epics.length} epic${epics.length === 1 ? '' : 's'}`, 'Plan');

  if (epics.length === 0) {
    logger.log('Done', 'Plan');
    return;
  }

  const todoList = await trelloService.getListByName('Todo');

  if (!todoList) {
    throw new Error('Todo list not found. Run setupTrello first.');
  }

  let planned = 0;
  let skipped = 0;

  for (const epicCard of epics) {
    const parsedEpic = epicParser.parseFromCard(epicCard.name, epicCard.desc);

    if (!parsedEpic) {
      skipped += 1;
      logger.warn(`Skipping invalid epic card: ${epicCard.name}`, 'Plan');
      continue;
    }

    const comments = await trelloService.getCardComments(epicCard.id);
    const alreadyPlanned = comments.some((comment) =>
      comment.includes(EPIC_GENERATED_COMMENT),
    );

    if (alreadyPlanned) {
      skipped += 1;
      logger.log(`Skipping already planned epic: ${parsedEpic.title}`, 'Plan');
      continue;
    }

    logger.log(`Planning epic: ${parsedEpic.title}`, 'Plan');
    const tasks = plannerService.generateTasksFromEpic(parsedEpic);

    for (const task of tasks) {
      await trelloService.createCard(
        todoList.id,
        task.title,
        formatTaskCardDescription(task),
      );
      logger.log(`Created task: ${task.title}`, 'Plan');
    }

    await trelloService.addComment(epicCard.id, EPIC_GENERATED_COMMENT);
    planned += 1;
  }

  logger.log(`Done. Planned=${planned}, Skipped=${skipped}`, 'Plan');
}

function ensureTrelloConfig(configService: ConfigService): void {
  configService.getTrelloConfig();
}

function formatTaskCardDescription(task: Task): string {
  const acceptance = task.acceptance.map((item) => `- ${item}`).join('\n');

  return [
    `Type: ${task.type}`,
    `Epic: ${task.epicTitle}`,
    '',
    'Goal:',
    task.goal,
    '',
    'Acceptance:',
    acceptance,
  ].join('\n');
}

void bootstrap();
