import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './common/logger/logger.module';
import { ConfigModule } from './config/config.module';
import { ModelsModule } from './models/models.module';
import { ParserModule } from './parser/parser.module';
import { PlannerModule } from './planner/planner.module';
import { TrelloModule } from './trello/trello.module';
import { WorkerModule } from './worker/worker.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule,
    ModelsModule,
    ParserModule,
    PlannerModule,
    TrelloModule,
    WorkerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
