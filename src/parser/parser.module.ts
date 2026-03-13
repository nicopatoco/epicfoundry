import { Module } from '@nestjs/common';
import { EpicParser } from './epic-parser';
import { EpicNormalizerService } from './epic-normalizer.service';
import { TaskParser } from './task-parser';

@Module({
  providers: [EpicParser, EpicNormalizerService, TaskParser],
  exports: [EpicParser, EpicNormalizerService, TaskParser],
})
export class ParserModule {}
