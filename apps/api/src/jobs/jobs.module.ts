import { Module } from '@nestjs/common';
import { PluginModule, CircuitBreakerModule } from '@ever-jobs/plugin';
import { ALL_SOURCE_MODULES } from '@ever-jobs/plugin-sources';
import { AnalyticsModule } from '@ever-jobs/analytics';
import { DedupHybridModule } from '@ever-jobs/dedup-hybrid';
import { MergeDefaultModule } from '@ever-jobs/merge-default';
import { JobsService } from './jobs.service';
import { JobsAggregator } from './jobs.aggregator';
import { JobsController } from './jobs.controller';
import { JobsResolver } from './jobs.resolver';

@Module({
  imports: [
    PluginModule,
    ...ALL_SOURCE_MODULES,
    AnalyticsModule,
    // Spec 003 / Phase 5 — bind the default dedup engine + merge resolver
    // under their tokens so the aggregator can pick them up by DI. Either
    // module can be swapped for a custom implementation that re-uses the
    // same token (FR-1 / FR-4).
    DedupHybridModule,
    MergeDefaultModule,
    // Spec 005 / T04 — bind the circuit-breaker service + interceptor so
    // `JobsService` can wrap each per-source `scrape()` call. The
    // underlying engine is swappable by replacing this module (the
    // service is registered under `CIRCUIT_BREAKER_TOKEN`).
    CircuitBreakerModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsAggregator, JobsResolver],
  exports: [JobsService, JobsAggregator],
})
export class JobsModule {}
