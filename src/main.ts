import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app-logger.service';
import { ConfigService } from './config/config.service';
import { Epic } from './models/epic';
import { EpicParser } from './parser/epic-parser';
import { PlannerService } from './planner/planner.service';
import { TrelloService } from './trello/trello.service';
import { WorkerService } from './worker/worker.service';

type CliCommand = 'sync epics' | 'plan tasks' | 'run worker';

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
  if (args.length < 2) {
    return null;
  }

  const command = `${args[0]} ${args[1]}`.toLowerCase();

  if (command === 'sync epics') {
    return 'sync epics';
  }

  if (command === 'plan tasks') {
    return 'plan tasks';
  }

  if (command === 'run worker') {
    return 'run worker';
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

    if (command === 'sync epics') {
      const trelloService = app.get(TrelloService);
      const epicParser = app.get(EpicParser);
      const epics = await loadEpics(trelloService, epicParser);

      logger.log(`Synced ${epics.length} epic(s)`, 'CLI');
      for (const epic of epics) {
        logger.log(`Epic: ${epic.title}`, 'CLI');
      }
      return;
    }

    if (command === 'plan tasks') {
      const trelloService = app.get(TrelloService);
      const epicParser = app.get(EpicParser);
      const plannerService = app.get(PlannerService);
      const epics = await loadEpics(trelloService, epicParser);
      const tasks = plannerService.planTasksFromEpics(epics);

      logger.log(`Generated ${tasks.length} task(s)`, 'CLI');
      for (const task of tasks) {
        logger.log(`Task: ${task.title}`, 'CLI');
      }
      return;
    }

    if (command === 'run worker') {
      const workerService = app.get(WorkerService);
      const summary = await workerService.run();

      logger.log(
        `Worker finished. Processed=${summary.processed}, Succeeded=${summary.succeeded}, Failed=${summary.failed}`,
        'CLI',
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

async function loadEpics(
  trelloService: TrelloService,
  epicParser: EpicParser,
): Promise<Epic[]> {
  const epicCards = await trelloService.getEpicCards();

  return epicCards
    .map((card) => epicParser.parseFromCard(card.name, card.desc))
    .filter((epic): epic is Epic => epic !== null);
}

function ensureTrelloConfig(configService: ConfigService): void {
  configService.getTrelloConfig();
}

void bootstrap();
