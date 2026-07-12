import { Module } from '@nestjs/common';
import { CircuitBreakerModule } from '@ever-jobs/plugin';
import { JobsModule } from '../jobs/jobs.module';
import { AdminBackgroundJobsService } from './admin-background-jobs.service';
import { AdminController } from './admin.controller';

@Module({
  // `CircuitBreakerModule` is also imported by `JobsModule` (for the
  // scrape-path interceptor) — importing it here too does NOT create a
  // second instance, it's a static module with no dynamic params, so
  // Nest resolves both to the same app-wide `CIRCUIT_BREAKER_TOKEN`
  // singleton. Needed because `JobsModule` doesn't re-export the token.
  imports: [JobsModule, CircuitBreakerModule],
  controllers: [AdminController],
  providers: [AdminBackgroundJobsService],
})
export class AdminModule {}
