# Plan — Spec 139 / source-company-bloomreach

Re-spin of `source-company-doximity` (Spec 127). Zero structural
deviations. First cohort observation of mojibake-NBSP D-10 sub-axis
captured as observability note in service-file docblock.

## Files

1. `packages/plugins/source-company-bloomreach/package.json`
2. `packages/plugins/source-company-bloomreach/tsconfig.json`
3. `packages/plugins/source-company-bloomreach/src/index.ts`
4. `packages/plugins/source-company-bloomreach/src/bloomreach.module.ts`
5. `packages/plugins/source-company-bloomreach/src/bloomreach.service.ts`
6. `packages/plugins/source-company-bloomreach/__tests__/fixtures/bloomreach-jobs.json`
7. `packages/plugins/source-company-bloomreach/__tests__/bloomreach.service.spec.ts`

## Wiring (4 files)

1. `packages/models/src/enums/site.enum.ts` — add `BLOOMREACH = 'bloomreach'` under `// Phase 149`.
2. `packages/plugins/index.ts` — import `BloomreachModule`, place between `BlendModule` and `BlockModule`.
3. `tsconfig.base.json` — add `@ever-jobs/source-company-bloomreach` path.
4. `jest.config.js` — add `^@ever-jobs/source-company-bloomreach$` mapper.

## Cross-regression suites

`bloomreach`, `blend`, `bigid`, `doximity` (4 suites; 32 tests).
