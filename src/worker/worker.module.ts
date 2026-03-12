import { Module } from '@nestjs/common';
import { ParserModule } from '../parser/parser.module';
import { TrelloModule } from '../trello/trello.module';
import { WorkerService } from './worker.service';

@Module({
  imports: [TrelloModule, ParserModule],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
