import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  ERR_STORE_INVALID_CURSOR,
  IStoreMetadata,
  Site,
  STORE_PLUGIN_METADATA_KEY,
} from '@ever-jobs/models';
import { runStoreConformance } from '../../../plugin/src/store/__tests__/conformance';
import {
  InMemoryJobStore,
  STORE_MEMORY_DESCRIPTION,
  STORE_MEMORY_ID,
  StoreMemoryModule,
} from '../src';

/**
 * Spec 004 / T06 — In-memory backend tests.
 *
 * The bulk of the assertion surface lives in the shared conformance
 * suite at `packages/plugin/src/store/__tests__/conformance.ts`; this
 * file (a) runs that suite against a fresh `InMemoryJobStore` per case
 * and (b) covers in-memory-specific paths that fall outside the
 * contract — the cursor envelope shape, version drift, the
 * `@StorePlugin()` metadata wiring, and the NestJS module export.
 */

describe('store-memory plugin (Spec 004 / T06)', () => {
  // Conformance — gives us all 24 contract cases against the in-memory backend.
  runStoreConformance('store-memory', () => new InMemoryJobStore());

  // ----------------------------------------------------------------------
  // Cursor-envelope failure modes (in-memory-specific; the conformance
  // suite only checks the abstract `ERR_STORE_INVALID_CURSOR` contract).
  // ----------------------------------------------------------------------

  describe('cursor envelope (in-memory specific)', () => {
    let store: InMemoryJobStore;

    beforeEach(async () => {
      store = new InMemoryJobStore();
      // Seed enough rows that pagination is meaningful.
      for (let i = 0; i < 5; i++) {
        await store.upsert({
          canonicalJobId: `j-${i}`,
          title: `t${i}`,
          company: 'C',
          location: 'L',
          url: `https://example.com/${i}`,
          sources: [],
          fields: {},
          mergedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
        });
      }
    });

    const invalidCursors: Array<[string, string]> = [
      ['empty string', ''],
      ['plain text', 'hello-world'],
      // Valid base64, NOT JSON.
      ['base64 of non-JSON', Buffer.from('not json', 'utf8').toString('base64')],
      // Valid JSON, NOT an object.
      [
        'base64 of JSON literal',
        Buffer.from(JSON.stringify(42), 'utf8').toString('base64'),
      ],
      // Valid object, missing `v`.
      [
        'object missing version',
        Buffer.from(JSON.stringify({ offset: 0 }), 'utf8').toString('base64'),
      ],
      // Wrong version.
      [
        'object with wrong version',
        Buffer.from(JSON.stringify({ v: 999, offset: 0 }), 'utf8').toString(
          'base64',
        ),
      ],
      // Valid version, NEGATIVE offset.
      [
        'negative offset',
        Buffer.from(JSON.stringify({ v: 1, offset: -1 }), 'utf8').toString(
          'base64',
        ),
      ],
      // Valid version, FRACTIONAL offset.
      [
        'fractional offset',
        Buffer.from(JSON.stringify({ v: 1, offset: 1.5 }), 'utf8').toString(
          'base64',
        ),
      ],
      // Valid version, STRING offset.
      [
        'string offset',
        Buffer.from(JSON.stringify({ v: 1, offset: '0' }), 'utf8').toString(
          'base64',
        ),
      ],
    ];

    it.each(invalidCursors)(
      'rejects %s with ERR_STORE_INVALID_CURSOR',
      async (_label, cursor) => {
        await expect(store.listByQuery({ cursor })).rejects.toMatchObject({
          code: ERR_STORE_INVALID_CURSOR,
          name: 'MemoryStoreCursorError',
        });
      },
    );

    it('a returned nextCursor is opaque base64 — round-trips back into a valid page', async () => {
      const first = await store.listByQuery({ limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).toBeDefined();
      // The cursor MUST be base64-decodable to a JSON object.
      const decoded = JSON.parse(
        Buffer.from(first.nextCursor as string, 'base64').toString('utf8'),
      );
      expect(decoded).toMatchObject({ v: 1, offset: 2 });

      // Round-trip: feeding the cursor back yields the next page.
      const second = await store.listByQuery({
        limit: 2,
        cursor: first.nextCursor,
      });
      expect(second.items).toHaveLength(2);
      // No id appears twice across the two pages.
      const ids = [
        ...first.items.map((j) => j.canonicalJobId),
        ...second.items.map((j) => j.canonicalJobId),
      ];
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ----------------------------------------------------------------------
  // @StorePlugin metadata wiring (T05 acceptance: plugin is discoverable
  // by `StoreModule.forActive`).
  // ----------------------------------------------------------------------

  describe('@StorePlugin metadata', () => {
    it('attaches { id, description } via @StorePlugin', () => {
      const meta = Reflect.getMetadata(
        STORE_PLUGIN_METADATA_KEY,
        InMemoryJobStore,
      ) as IStoreMetadata | undefined;
      expect(meta).toBeDefined();
      expect(meta?.id).toBe(STORE_MEMORY_ID);
      expect(meta?.id).toBe('memory');
      expect(meta?.description).toBe(STORE_MEMORY_DESCRIPTION);
    });

    it('Reflector.get returns the same metadata as raw Reflect.getMetadata', () => {
      const reflector = new Reflector();
      const fromReflector = reflector.get<IStoreMetadata>(
        STORE_PLUGIN_METADATA_KEY,
        InMemoryJobStore,
      );
      const fromReflect = Reflect.getMetadata(
        STORE_PLUGIN_METADATA_KEY,
        InMemoryJobStore,
      ) as IStoreMetadata;
      expect(fromReflector).toBe(fromReflect);
    });
  });

  // ----------------------------------------------------------------------
  // NestJS module wiring (T05 acceptance: builds standalone).
  // ----------------------------------------------------------------------

  describe('StoreMemoryModule', () => {
    it('exports InMemoryJobStore as an injectable provider', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [StoreMemoryModule],
      }).compile();
      const store = moduleRef.get(InMemoryJobStore);
      expect(store).toBeInstanceOf(InMemoryJobStore);
    });

    it('binds a singleton — two consumers see the same instance', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [StoreMemoryModule],
      }).compile();
      const a = moduleRef.get(InMemoryJobStore);
      const b = moduleRef.get(InMemoryJobStore);
      expect(a).toBe(b);
    });
  });

  // ----------------------------------------------------------------------
  // Diagnostic / debug surface
  // ----------------------------------------------------------------------

  describe('size / clear', () => {
    it('reports size after upserts and resets to 0 after clear', async () => {
      const store = new InMemoryJobStore();
      expect(store.size).toBe(0);
      await store.upsert({
        canonicalJobId: 'a',
        title: 't',
        company: 'c',
        location: 'l',
        url: 'https://example.com/a',
        sources: [],
        fields: {},
        mergedAt: '2026-01-01T00:00:00.000Z',
      });
      expect(store.size).toBe(1);
      store.clear();
      expect(store.size).toBe(0);
    });

    it('clear() drops observations as well as canonicals', async () => {
      const store = new InMemoryJobStore();
      await store.putAll('a', [
        {
          site: Site.LINKEDIN,
          sourceJobId: 's1',
          url: 'https://example.com/s1',
          observedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
      expect(await store.listByCanonicalId('a')).toHaveLength(1);
      store.clear();
      expect(await store.listByCanonicalId('a')).toEqual([]);
    });
  });
});
