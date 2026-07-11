import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [JobsModule],
  controllers: [AdminController],
})
export class AdminModule {}
