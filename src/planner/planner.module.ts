import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PlannerService } from './planner.service';

@Module({
  imports: [AiModule],
  providers: [PlannerService],
  exports: [PlannerService],
})
export class PlannerModule {}
