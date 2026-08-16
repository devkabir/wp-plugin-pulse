import { describe, expect, test } from 'bun:test';
import { getNextUnloadedPage } from '../components/pagination-controls';
import { computeKpiSummary } from './plugin-kpi';
import type { NormalizedPlugin } from './plugin-types';
import { mergePluginCollections } from '../state/app-state';

function createMockPlugin(overrides: Partial<NormalizedPlugin>): NormalizedPlugin {
  return {
    name: 'Sample Plugin',
    slug: 'sample-plugin',
    version: '1.0.0',
    authorName: 'Sample Author',
    authorProfileUrl: null,
    homepageUrl: null,
    pluginUrl: 'https://wordpress.org/plugins/sample-plugin/',
    downloadUrl: null,
    iconUrl: null,
    shortDescription: 'Sample short description',
    tags: ['sample'],
    activeInstalls: 1000,
    activeInstallsDisplay: '1,000',
    lifetimeDownloads: 5000,
    lifetimeDownloadsDisplay: '5,000',
    estimatedInstallsPerDay: 10,
    estimatedInstallsPerDayDisplay: '10.0',
    daysSinceAdded: 100,
    ratingPercent: 90,
    ratingScore: 4.5,
    ratingScoreDisplay: '4.5',
    ratingCount: 10,
    ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 7 },
    supportThreads: 10,
    supportThreadsResolved: 8,
    supportResolutionRate: 80,
    addedAt: '2023-01-01T00:00:00.000Z',
    lastUpdatedAt: '2024-01-01T00:00:00.000Z',
    lastUpdatedRelative: '1 year ago',
    freshness: 'aging',
    requiresWordPress: '6.0',
    testedWordPress: '6.4',
    requiresPhp: '7.4',
    requiredPlugins: [],
    ...overrides,
  };
}

describe('pagination and multi-page data merging', () => {
  test('getNextUnloadedPage finds the next missing page in sequence', () => {
    expect(getNextUnloadedPage([1], 3)).toBe(2);
    expect(getNextUnloadedPage([1, 2], 3)).toBe(3);
    expect(getNextUnloadedPage([1, 3], 3)).toBe(2);
    expect(getNextUnloadedPage([1, 2, 3], 3)).toBe(null);
    expect(getNextUnloadedPage([], 1)).toBe(1);
  });

  test('mergePluginCollections merges plugins from different pages', () => {
    const page1Plugins = [
      createMockPlugin({ slug: 'plugin-a', name: 'Plugin A' }),
      createMockPlugin({ slug: 'plugin-b', name: 'Plugin B' }),
    ];
    const page2Plugins = [
      createMockPlugin({ slug: 'plugin-c', name: 'Plugin C' }),
      createMockPlugin({ slug: 'plugin-d', name: 'Plugin D' }),
    ];

    const merged = mergePluginCollections(page1Plugins, page2Plugins);
    expect(merged.length).toBe(4);
    expect(merged.map((p) => p.slug)).toEqual(['plugin-a', 'plugin-b', 'plugin-c', 'plugin-d']);
  });

  test('mergePluginCollections deduplicates by plugin slug', () => {
    const page1Plugins = [
      createMockPlugin({ slug: 'plugin-a', name: 'Plugin A (Page 1)' }),
      createMockPlugin({ slug: 'plugin-b', name: 'Plugin B (Page 1)' }),
    ];
    const page2Plugins = [
      createMockPlugin({ slug: 'plugin-b', name: 'Plugin B (Page 2 duplicate)' }),
      createMockPlugin({ slug: 'plugin-c', name: 'Plugin C' }),
    ];

    const merged = mergePluginCollections(page1Plugins, page2Plugins);
    expect(merged.length).toBe(3);
    expect(merged.map((p) => p.slug)).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
    // Keeps first occurrence
    expect(merged[1].name).toBe('Plugin A (Page 1)' === merged[0].name ? 'Plugin B (Page 1)' : 'Plugin B (Page 1)');
  });
});

describe('competitive landscape rankings and multi-page state', () => {
  test('marks landscape as partial when loaded count is less than total results', () => {
    const plugins = [
      createMockPlugin({ slug: 'plugin-1', name: 'Leader One', estimatedInstallsPerDay: 50, activeInstalls: 50000 }),
      createMockPlugin({ slug: 'plugin-2', name: 'Runner Up', estimatedInstallsPerDay: 20, activeInstalls: 20000 }),
    ];

    // 2 loaded out of 255 across 3 pages
    const metrics = computeKpiSummary(plugins, 255, 3, 1);
    expect(metrics.totalLoaded).toBe(2);
    expect(metrics.totalResults).toBe(255);
    expect(metrics.totalPages).toBe(3);
    expect(metrics.loadedPagesCount).toBe(1);
    expect(metrics.isFullyLoaded).toBe(false);
    expect(metrics.topEstimatedInstallsLeader?.slug).toBe('plugin-1');
  });

  test('marks landscape as fully loaded when all pages are loaded', () => {
    const plugins = [
      createMockPlugin({ slug: 'plugin-1', name: 'Leader One', estimatedInstallsPerDay: 50, activeInstalls: 50000 }),
      createMockPlugin({ slug: 'plugin-2', name: 'Runner Up', estimatedInstallsPerDay: 20, activeInstalls: 20000 }),
      createMockPlugin({ slug: 'plugin-3', name: 'Third Place', estimatedInstallsPerDay: 10, activeInstalls: 10000 }),
    ];

    // 3 loaded out of 3 total across 1 page (or 3 of 3 pages)
    const metrics = computeKpiSummary(plugins, 3, 1, 1);
    expect(metrics.totalLoaded).toBe(3);
    expect(metrics.totalResults).toBe(3);
    expect(metrics.isFullyLoaded).toBe(true);
  });
});
