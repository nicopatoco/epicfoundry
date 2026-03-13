import { NestFactory } from '@nestjs/core';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { AgentPolicyService } from './ai/agent-policy.service';
import { AgentRouterService } from './ai/agent-router.service';
import { EpicRefinerService } from './ai/refiner/epic-refiner.service';
import { RefinedEpicParserService } from './ai/refiner/refined-epic-parser.service';
import { REFINEMENT_GENERATED_MARKER } from './ai/refiner/refinement.constants';
import { formatRefinementComment } from './ai/refiner/refinement-comment.formatter';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app-logger.service';
import { ConfigService } from './config/config.service';
import { Task } from './models/task';
import { EpicParser } from './parser/epic-parser';
import { PlannerService } from './planner/planner.service';
import { TrelloService } from './trello/trello.service';
import { WorkerService } from './worker/worker.service';

type CliCommand =
  | 'setupTrello'
  | 'planEpics'
  | 'epicRefine'
  | 'runWorker'
  | 'trelloReset'
  | 'trelloResetAll'
  | 'aiRoles'
  | 'aiTestRouting'
  | 'aiTestManualQa';

const REQUIRED_LISTS = ['Epic', 'Todo', 'In Progress', 'Review', 'Done', 'Failed'];
const RESET_LISTS = ['Todo', 'In Progress', 'Review', 'Done', 'Failed'];
const RESET_ALL_LISTS = ['Epic', ...RESET_LISTS];
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

  if (normalized === 'epicrefine') {
    return 'epicRefine';
  }

  if (normalized === 'runworker') {
    return 'runWorker';
  }

  if (normalized === 'trelloreset') {
    return 'trelloReset';
  }

  if (normalized === 'trelloresetall') {
    return 'trelloResetAll';
  }

  if (normalized === 'airoles') {
    return 'aiRoles';
  }

  if (normalized === 'aitestrouting') {
    return 'aiTestRouting';
  }

  if (normalized === 'aitestmanualqa') {
    return 'aiTestManualQa';
  }

  return null;
}

function commandNeedsTrelloConfig(command: CliCommand): boolean {
  return (
    command === 'setupTrello' ||
    command === 'planEpics' ||
    command === 'epicRefine' ||
    command === 'runWorker' ||
    command === 'trelloReset' ||
    command === 'trelloResetAll'
  );
}

async function runCliCommand(command: CliCommand): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const logger = app.get(AppLogger);

  try {
    if (commandNeedsTrelloConfig(command)) {
      ensureTrelloConfig(app.get(ConfigService));
    }

    if (command === 'setupTrello') {
      await runSetupTrello(app.get(TrelloService), logger);
      return;
    }

    if (command === 'planEpics') {
      await runPlanEpics(
        app.get(TrelloService),
        app.get(EpicParser),
        app.get(PlannerService),
        app.get(RefinedEpicParserService),
        logger,
      );
      return;
    }

    if (command === 'epicRefine') {
      await runEpicRefine(
        app.get(TrelloService),
        app.get(EpicParser),
        app.get(EpicRefinerService),
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
      return;
    }

    if (command === 'trelloReset') {
      await runTrelloReset(app.get(TrelloService), logger, false);
      return;
    }

    if (command === 'trelloResetAll') {
      await runTrelloReset(app.get(TrelloService), logger, true);
      return;
    }

    if (command === 'aiRoles') {
      await runAiRoles(app.get(AgentPolicyService), logger);
      return;
    }

    if (command === 'aiTestRouting') {
      await runAiTestRouting(app.get(AgentRouterService), logger);
      return;
    }

    if (command === 'aiTestManualQa') {
      await runAiTestManualQa(app.get(AgentRouterService), logger);
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
  refinedEpicParser: RefinedEpicParserService,
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
    const refinedEpic = refinedEpicParser.parseFromComments(comments);
    if (refinedEpic) {
      logger.log(`RefinedEpic detected for ${refinedEpic.title}`, 'Plan');
    }
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

async function runEpicRefine(
  trelloService: TrelloService,
  epicParser: EpicParser,
  epicRefiner: EpicRefinerService,
  logger: AppLogger,
): Promise<void> {
  const epics = await trelloService.getEpics();
  logger.log(`Found ${epics.length} epic${epics.length === 1 ? '' : 's'}`, 'Refine');

  if (epics.length === 0) {
    logger.log('Done', 'Refine');
    return;
  }

  let refinedCount = 0;
  let skippedCount = 0;

  for (const epicCard of epics) {
    const parsedEpic = epicParser.parseFromCard(epicCard.name, epicCard.desc);

    if (!parsedEpic) {
      skippedCount += 1;
      logger.warn(`Skipping invalid epic card: ${epicCard.name}`, 'Refine');
      continue;
    }

    const comments = await trelloService.getCardComments(epicCard.id);
    const alreadyRefined = comments.some((comment) =>
      comment.includes(REFINEMENT_GENERATED_MARKER),
    );

    if (alreadyRefined) {
      skippedCount += 1;
      logger.log(`Skipping epic (already refined): ${parsedEpic.title}`, 'Refine');
      continue;
    }

    logger.log(`Analyzing epic: ${parsedEpic.title}`, 'Refine');
    const refinement = await epicRefiner.refineEpic(parsedEpic);
    const comment = formatRefinementComment(refinement);

    await trelloService.addComment(epicCard.id, comment);
    logger.log('Posted refinement comment', 'Refine');
    refinedCount += 1;
  }

  logger.log(`Done. Refined=${refinedCount}, Skipped=${skippedCount}`, 'Refine');
}

async function runTrelloReset(
  trelloService: TrelloService,
  logger: AppLogger,
  includeEpics: boolean,
): Promise<void> {
  logger.log('Cleaning Trello board', 'Reset');

  if (includeEpics) {
    logger.warn('WARNING: This will delete ALL cards including Epics.', 'Reset');
    const confirmed = await confirmResetAll();

    if (!confirmed) {
      logger.log('Reset cancelled. No cards were deleted.', 'Reset');
      return;
    }
  }

  const lists = await trelloService.getLists();
  const listsByName = new Map(
    lists.map((list) => [list.name.trim().toLowerCase(), list]),
  );
  const targetLists = includeEpics ? RESET_ALL_LISTS : RESET_LISTS;

  let totalDeleted = 0;

  for (const listName of targetLists) {
    const list = listsByName.get(listName.trim().toLowerCase());

    if (!list) {
      logger.warn(`List not found: ${listName} (skipping)`, 'Reset');
      continue;
    }

    try {
      const cards = await trelloService.getCardsInList(list.id);

      for (const card of cards) {
        await trelloService.deleteCard(card.id);
      }

      totalDeleted += cards.length;
      logger.log(`Deleted ${cards.length} cards from ${listName}`, 'Reset');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to clean list ${listName}: ${message}`, 'Reset');
    }
  }

  logger.log(`Board cleaned successfully (total deleted: ${totalDeleted})`, 'Reset');
}

async function confirmResetAll(): Promise<boolean> {
  if (!input.isTTY || !output.isTTY) {
    console.warn(
      '[Reset] WARNING: Confirmation prompt unavailable (non-interactive mode). Proceeding with reset:all.',
    );
    return true;
  }

  const readline = createInterface({ input, output });

  try {
    const answer = await readline.question('[Reset] Type "yes" to continue: ');
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    readline.close();
  }
}

async function runAiRoles(
  policyService: AgentPolicyService,
  logger: AppLogger,
): Promise<void> {
  const lines = policyService.getSummaryLines();

  logger.log('Configured AI role routes:', 'AI-Roles');
  for (const line of lines) {
    logger.log(line, 'AI-Roles');
  }
}

async function runAiTestRouting(
  routerService: AgentRouterService,
  logger: AppLogger,
): Promise<void> {
  const routes = routerService.getAllRoutes();

  logger.log('Routing test for all roles:', 'AI-TestRouting');
  for (const route of routes) {
    logger.log(
      `${route.role} -> ${route.provider} / ${route.model}`,
      'AI-TestRouting',
    );
  }

  const plannerResult = await routerService.runPlannerDemo('User profile editing');
  logger.log(`Planner demo produced ${plannerResult.length} task(s)`, 'AI-TestRouting');

  const backendResult = await routerService.runWorkerDemo('backend_worker');
  logger.log(`Backend worker demo: ${backendResult.status}`, 'AI-TestRouting');

  const frontendResult = await routerService.runWorkerDemo('frontend_worker');
  logger.log(`Frontend worker demo: ${frontendResult.status}`, 'AI-TestRouting');
}

async function runAiTestManualQa(
  routerService: AgentRouterService,
  logger: AppLogger,
): Promise<void> {
  const report = await routerService.runManualQaDemo({
    feature: 'User profile editing',
  });

  logger.log(`Status: ${report.status}`, 'AI-ManualQA');
  logger.log(`Summary: ${report.summary}`, 'AI-ManualQA');

  for (const flow of report.exploredFlows) {
    logger.log(`Explored flow: ${flow}`, 'AI-ManualQA');
  }

  if (report.findings.length === 0) {
    logger.log('No findings reported', 'AI-ManualQA');
    return;
  }

  for (const finding of report.findings) {
    logger.log(
      `${finding.severity.toUpperCase()} - ${finding.title} | Expected: ${finding.expected} | Actual: ${finding.actual}`,
      'AI-ManualQA',
    );
  }
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
