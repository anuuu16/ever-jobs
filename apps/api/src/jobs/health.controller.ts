import {
  Controller,
  Get,
  Header,
  Inject,
  Logger,
  Optional,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CIRCUIT_BREAKER_TOKEN,
  DEFAULT_CIRCUIT_POLICY,
  ICircuitBreakerService,
  Site,
  SourceHealth,
} from '@ever-jobs/models';
import { PluginRegistry } from '@ever-jobs/plugin';

/**
 * Source-health controller — Spec 005 / FR-5 / T05.
 *
 * Exposes `GET /api/sources/health` returning per-`Site` circuit-breaker
 * snapshots so operators can see which sources are degraded. The route
 * carries a `Cache-Control: public, max-age=1` header so a busy dashboard
 * doesn't flood the breaker introspection API; the 1-second TTL is the
 * acceptance criterion from `tasks.md` (T05) and is tight enough that an
 * incident is still observable in near-real-time.
 *
 * Output ordering is by `Site` name (alphabetical) so a dashboard can
 * render stable rows without re-sorting client-side.
 *
 * **Why this lives under `apps/api/src/jobs/`** — Spec 005 / T05 names the
 * file. The breaker is bound through `JobsModule` (it imports
 * `CircuitBreakerModule`); putting the controller in the same module keeps
 * the DI graph shallow and self-contained. The route path prefix
 * (`/api/sources/health`) is intentionally distinct from `JobsController`'s
 * `/api/jobs/*` so the URL surface stays operator-facing.
 *
 * **Optional registry overlay (Q-014)** — by default `breaker.list()`
 * returns only sites the breaker has actually seen (lazy-init). A
 * `?include=all` query param overlays every registered plugin with a
 * synthetic "closed / no-data" snapshot so operators can also confirm that
 * a registered source has not yet been called this process. The overlay
 * does **not** mutate breaker state — it composes purely from
 * `PluginRegistry.listSiteKeys()` and never touches `breaker.health(site)`
 * for unseen sites (which would otherwise create a real entry and inflate
 * the per-process memory ceiling — Spec 005 / NFR-3).
 */
@ApiTags('Health')
@Controller('api/sources')
export class SourcesHealthController {
  private readonly logger = new Logger(SourcesHealthController.name);

  constructor(
    @Optional()
    @Inject(CIRCUIT_BREAKER_TOKEN)
    private readonly breaker?: ICircuitBreakerService,
    @Optional() private readonly registry?: PluginRegistry,
  ) {}

  /**
   * `GET /api/sources/health` — returns per-site `SourceHealth` snapshots.
   *
   * Query params:
   *   - `include=all` — overlay every registered plugin (default: only
   *     return sites the breaker has actually observed).
   *
   * Response shape: `{ count: number; sources: SourceHealth[] }`.
   *
   * The `count` field is convenience for monitoring scripts that want to
   * alert on "fewer than N sources reporting"; consumers that only care
   * about the array can ignore it. Both fields are stable.
   */
  @Get('health')
  @Header('Cache-Control', 'public, max-age=1')
  @ApiOperation({
    summary: 'List per-source health snapshots',
    description:
      "Returns each source's circuit-breaker state, success rate and " +
      'p95 latency over the rolling window. Use `?include=all` to also ' +
      'list registered plugins that have not yet been called this process ' +
      '(those rows report state=closed, successRate=1, p95LatencyMs=0).',
  })
  @ApiQuery({
    name: 'include',
    required: false,
    description:
      'Set to "all" to overlay every registered plugin with a synthetic ' +
      'closed/no-data row. Default returns only sites the breaker has ' +
      'observed at least once.',
    example: 'all',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of per-source health snapshots.',
  })
  list(@Query('include') include?: string): {
    count: number;
    sources: SourceHealth[];
  } {
    if (!this.breaker) {
      this.logger.warn(
        'No circuit-breaker bound under CIRCUIT_BREAKER_TOKEN; returning empty list',
      );
      return { count: 0, sources: [] };
    }

    const observed = this.breaker.list();
    const observedSites = new Set(observed.map((h) => h.site));

    let merged: SourceHealth[] = observed;

    if (include === 'all' && this.registry) {
      const synthetic: SourceHealth[] = [];
      for (const site of this.registry.listSiteKeys()) {
        if (observedSites.has(site)) continue;
        synthetic.push({
          site,
          state: 'closed',
          successRate: 1,
          p95LatencyMs: 0,
          windowMs: DEFAULT_CIRCUIT_POLICY.rollingWindowMs,
        });
      }
      merged = [...observed, ...synthetic];
    }

    merged.sort((a, b) => siteCompare(a.site, b.site));
    return { count: merged.length, sources: merged };
  }
}

/**
 * Locale-stable `Site` comparator. `Site` enum values are kebab-case
 * strings (`'linkedin'`, `'source-ats-ashby'`, etc.) — a plain `<` over
 * strings is enough; we wrap it for readability and so a future change of
 * the underlying type (e.g. wrapping in an opaque branded type) doesn't
 * silently break ordering at the call site.
 */
function siteCompare(a: Site, b: Site): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
