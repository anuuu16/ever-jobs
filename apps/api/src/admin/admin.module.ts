import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { AdminBackgroundJobsService } from './admin-background-jobs.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [JobsModule],
  controllers: [AdminController],
  providers: [AdminBackgroundJobsService],
})
export class AdminModule {}
