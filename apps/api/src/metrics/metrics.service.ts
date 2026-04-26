import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // HTTP Request metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;

  // Scraper metrics
  public readonly scraperRequestsTotal: Counter;
  public readonly scraperDuration: Histogram;

  // Cache metrics
  public readonly cacheHitsTotal: Counter;
  public readonly cacheMissesTotal: Counter;

  // System metrics
  public readonly totalSources: Gauge;

  constructor() {
    this.registry = new Registry();

    // Default metrics (CPU, Memory, Event Loop)
    collectDefaultMetrics({ register: this.registry, prefix: 'ever_jobs_' });

    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'ever_jobs_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'ever_jobs_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    // Scraper Metrics
    this.scraperRequestsTotal = new Counter({
      name: 'ever_jobs_scraper_requests_total',
      help: 'Total number of scraper requests',
      labelNames: ['site', 'status'], // status: success | error | circuit_open
      registers: [this.registry],
    });

    this.scraperDuration = new Histogram({
      name: 'ever_jobs_scraper_duration_seconds',
      help: 'Duration of job scraping in seconds',
      labelNames: ['site'],
      buckets: [1, 5, 10, 30, 60],
      registers: [this.registry],
    });

    // Cache Metrics
    this.cacheHitsTotal = new Counter({
      name: 'ever_jobs_cache_hits_total',
      help: 'Total number of cache hits',
      registers: [this.registry],
    });

    this.cacheMissesTotal = new Counter({
      name: 'ever_jobs_cache_misses_total',
      help: 'Total number of cache misses',
      registers: [this.registry],
    });

    // System Metrics
    this.totalSources = new Gauge({
      name: 'ever_jobs_sources_total',
      help: 'Total number of supported job sources',
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Initial value for total sources
    this.totalSources.set(160);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
