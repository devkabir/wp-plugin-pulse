import { describe, expect, it } from 'bun:test';
import {
  computeContentHash,
  createPluginSnapshot,
  deduplicateSnapshots,
  extractSnapshotDateKey,
  MemorySnapshotStore,
} from './plugin-snapshots';
import type { NormalizedPlugin, PluginSnapshot, RawPluginRecord } from './plugin-types';

describe('PR 11 — Historical Snapshots and Real Momentum: Snapshots & Storage', () => {
  const sampleNormalizedPlugin: NormalizedPlugin = {
    name: 'Form Builder Pro',
    slug: 'form-builder-pro',
    version: '2.4.0',
    authorName: 'Form Studio',
    authorProfileUrl: 'https://profiles.wordpress.org/formstudio',
    homepageUrl: 'https://example.com/form-builder',
    pluginUrl: 'https://wordpress.org/plugins/form-builder-pro/',
    downloadUrl: 'https://downloads.wordpress.org/plugin/form-builder-pro.2.4.0.zip',
    iconUrl: null,
    shortDescription: 'Flexible drag and drop form builder.',
    description: '<p>Comprehensive form creation tool for WordPress.</p>',
    tags: ['contact-form', 'forms', 'drag-and-drop'],
    activeInstalls: 50000,
    activeInstallsDisplay: '50,000',
    lifetimeDownloads: 125000,
    lifetimeDownloadsDisplay: '125,000',
    lifetimeInstallPace: 45.2,
    lifetimeInstallPaceDisplay: '45.2',
    daysSinceAdded: 1106,
    ratingPercent: 96,
    ratingScore: 4.8,
    ratingScoreDisplay: '4.8',
    ratingCount: 142,
    ratingDistribution: { 1: 2, 2: 1, 3: 3, 4: 10, 5: 126 },
    supportThreads: 20,
    supportThreadsResolved: 18,
    supportResolutionRate: 90,
    addedAt: '2023-01-01T00:00:00.000Z',
    lastUpdatedAt: '2026-08-10T12:00:00.000Z',
    lastUpdatedRelative: '7 days ago',
    freshness: 'fresh',
    requiresWordPress: '6.0',
    testedWordPress: '6.6',
    requiresPhp: '7.4',
    requiredPlugins: [],
  };

  it('computes deterministic content hashes for description, tags, version, and compatibility', () => {
    const hash1 = computeContentHash({
      slug: 'form-builder-pro',
      version: '2.4.0',
      testedWordPress: '6.6',
      requiresWordPress: '6.0',
      requiresPhp: '7.4',
      tags: ['forms', 'contact-form'],
      shortDescription: 'Flexible drag and drop form builder.',
      description: 'Comprehensive form creation tool.',
      lastUpdatedAt: '2026-08-10T12:00:00.000Z',
    });

    // Same input with tags in different order and extra whitespace in description
    const hash2 = computeContentHash({
      slug: 'form-builder-pro',
      version: '2.4.0',
      testedWordPress: '6.6',
      requiresWordPress: '6.0',
      requiresPhp: '7.4',
      tags: ['contact-form', 'forms'],
      shortDescription: 'Flexible drag and drop form builder.',
      description: 'Comprehensive   form creation tool.  ',
      lastUpdatedAt: '2026-08-10T12:00:00.000Z',
    });

    expect(hash1).toBe(hash2);

    // Changing version produces distinct hash
    const hashVersionChange = computeContentHash({
      slug: 'form-builder-pro',
      version: '2.5.0',
      testedWordPress: '6.6',
      requiresWordPress: '6.0',
      requiresPhp: '7.4',
      tags: ['forms', 'contact-form'],
      shortDescription: 'Flexible drag and drop form builder.',
      description: 'Comprehensive form creation tool.',
      lastUpdatedAt: '2026-08-10T12:00:00.000Z',
    });
    expect(hashVersionChange).not.toBe(hash1);

    // Changing compatibility produces distinct hash
    const hashCompatChange = computeContentHash({
      slug: 'form-builder-pro',
      version: '2.4.0',
      testedWordPress: '6.7',
      requiresWordPress: '6.0',
      requiresPhp: '7.4',
      tags: ['forms', 'contact-form'],
      shortDescription: 'Flexible drag and drop form builder.',
      description: 'Comprehensive form creation tool.',
      lastUpdatedAt: '2026-08-10T12:00:00.000Z',
    });
    expect(hashCompatChange).not.toBe(hash1);
  });

  it('creates PluginSnapshot from NormalizedPlugin retaining raw reported precision', () => {
    const snapshot = createPluginSnapshot(sampleNormalizedPlugin, {
      observedAt: '2026-08-10T10:00:00.000Z',
    });

    expect(snapshot.slug).toBe('form-builder-pro');
    expect(snapshot.observedAt).toBe('2026-08-10T10:00:00.000Z');
    expect(snapshot.activeInstalls).toBe(50000);
    expect(snapshot.downloaded).toBe(125000);
    expect(snapshot.rating).toBe(96);
    expect(snapshot.ratingCount).toBe(142);
    expect(snapshot.supportThreads).toBe(20);
    expect(snapshot.supportThreadsResolved).toBe(18);
    expect(snapshot.version).toBe('2.4.0');
    expect(snapshot.testedWordPress).toBe('6.6');
    expect(snapshot.lastUpdatedAt).toBe('2026-08-10T12:00:00.000Z');
    expect(snapshot.contentHash).toBeDefined();
    expect(typeof snapshot.contentHash).toBe('string');
  });

  it('creates PluginSnapshot from RawPluginRecord safely', () => {
    const rawRecord: RawPluginRecord = {
      name: 'WP SEO Fast',
      slug: 'wp-seo-fast',
      version: '1.2.0',
      active_installs: '100000',
      downloaded: '540000',
      rating: '92',
      num_ratings: '88',
      support_threads: '15',
      support_threads_resolved: '12',
      tested: '6.6.1',
      last_updated: '2026-08-01 10:00am GMT',
      tags: ['seo', 'speed'],
      short_description: 'Fast SEO meta tags generator',
    };

    const snapshot = createPluginSnapshot(rawRecord, {
      observedAt: '2026-08-01T12:00:00.000Z',
    });

    expect(snapshot.slug).toBe('wp-seo-fast');
    expect(snapshot.activeInstalls).toBe(100000);
    expect(snapshot.downloaded).toBe(540000);
    expect(snapshot.rating).toBe(92);
    expect(snapshot.ratingCount).toBe(88);
    expect(snapshot.supportThreads).toBe(15);
    expect(snapshot.supportThreadsResolved).toBe(12);
    expect(snapshot.version).toBe('1.2.0');
    expect(snapshot.testedWordPress).toBe('6.6.1');
    expect(snapshot.lastUpdatedAt).toBe('2026-08-01 10:00am GMT');
  });

  it('deduplicates identical snapshots by slug, date, and content hash', () => {
    const snap1: PluginSnapshot = {
      slug: 'form-builder-pro',
      observedAt: '2026-08-01T08:00:00.000Z',
      activeInstalls: 50000,
      downloaded: 100000,
      rating: 95,
      ratingCount: 100,
      supportThreads: 10,
      supportThreadsResolved: 9,
      version: '2.0.0',
      testedWordPress: '6.5',
      lastUpdatedAt: '2026-07-20T00:00:00.000Z',
      contentHash: 'hash-abc-1',
    };

    // Duplicate snapshot on same date (later hour) with same content hash and metrics
    const snap1Duplicate: PluginSnapshot = {
      ...snap1,
      observedAt: '2026-08-01T18:00:00.000Z',
    };

    // Snapshot on next day
    const snap2: PluginSnapshot = {
      slug: 'form-builder-pro',
      observedAt: '2026-08-02T08:00:00.000Z',
      activeInstalls: 50000,
      downloaded: 100500,
      rating: 95,
      ratingCount: 101,
      supportThreads: 11,
      supportThreadsResolved: 10,
      version: '2.0.0',
      testedWordPress: '6.5',
      lastUpdatedAt: '2026-07-20T00:00:00.000Z',
      contentHash: 'hash-abc-1',
    };

    const deduplicated = deduplicateSnapshots([snap1Duplicate, snap1, snap2]);
    expect(deduplicated).toHaveLength(2);
    expect(extractSnapshotDateKey(deduplicated[0].observedAt)).toBe('2026-08-01');
    expect(extractSnapshotDateKey(deduplicated[1].observedAt)).toBe('2026-08-02');
  });

  it('manages watched plugin snapshots with MemorySnapshotStore', () => {
    const store = new MemorySnapshotStore();

    const snapA1: PluginSnapshot = {
      slug: 'plugin-a',
      observedAt: '2026-08-01T00:00:00.000Z',
      activeInstalls: 10000,
      downloaded: 20000,
      rating: 90,
      ratingCount: 50,
      supportThreads: 5,
      supportThreadsResolved: 4,
      version: '1.0.0',
      testedWordPress: '6.5',
      lastUpdatedAt: null,
      contentHash: 'hash-a',
    };

    const snapA2: PluginSnapshot = {
      slug: 'plugin-a',
      observedAt: '2026-08-08T00:00:00.000Z',
      activeInstalls: 10000,
      downloaded: 22000,
      rating: 90,
      ratingCount: 52,
      supportThreads: 5,
      supportThreadsResolved: 5,
      version: '1.0.0',
      testedWordPress: '6.5',
      lastUpdatedAt: null,
      contentHash: 'hash-a',
    };

    const added1 = store.recordSnapshot(snapA1);
    expect(added1).toBe(true);

    const addedDuplicate = store.recordSnapshot(snapA1);
    expect(addedDuplicate).toBe(false); // Deduplicated

    const added2 = store.recordSnapshot(snapA2);
    expect(added2).toBe(true);

    expect(store.getAllWatchedSlugs()).toEqual(['plugin-a']);
    expect(store.getSnapshots('plugin-a')).toHaveLength(2);

    // Export and import test
    const exportedJson = store.exportJson();
    const store2 = new MemorySnapshotStore();
    const importedCount = store2.importJson(exportedJson);
    expect(importedCount).toBe(2);
    expect(store2.getSnapshots('plugin-a')).toHaveLength(2);
  });
});
