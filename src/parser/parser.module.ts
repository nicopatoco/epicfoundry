import { Module } from '@nestjs/common';
import { EpicParser } from './epic-parser';
import { TaskParser } from './task-parser';

@Module({
  providers: [EpicParser, TaskParser],
  exports: [EpicParser, TaskParser],
})
export class ParserModule {}
