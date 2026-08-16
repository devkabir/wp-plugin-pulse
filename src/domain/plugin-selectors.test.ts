import { describe, expect, test } from 'bun:test';
import type { AppState, NormalizedPlugin } from './plugin-types';
import { selectVisiblePlugins, sortPlugins } from './plugin-selectors';

function createMockPlugin(overrides: Partial<NormalizedPlugin> = {}): NormalizedPlugin {
  return {
    name: 'Form Plugin',
    slug: 'form-plugin',
    version: '1.0.0',
    authorName: 'Jane Dev',
    authorProfileUrl: 'https://profiles.wordpress.org/janedev',
    homepageUrl: null,
    pluginUrl: 'https://wordpress.org/plugins/form-plugin/',
    downloadUrl: 'https://downloads.wordpress.org/plugin/form-plugin.zip',
    iconUrl: null,
    shortDescription: 'The ultimate contact form builder for WordPress.',
    tags: ['contact-form', 'builder'],
    activeInstalls: 50000,
    activeInstallsDisplay: '50,000+',
    lifetimeDownloads: 200000,
    lifetimeDownloadsDisplay: '200,000',
    estimatedInstallsPerDay: 120,
    estimatedInstallsPerDayDisplay: '120',
    daysSinceAdded: 416,
    ratingPercent: 96,
    ratingScore: 4.8,
    ratingScoreDisplay: '4.8',
    ratingCount: 150,
    ratingDistribution: { 1: 2, 2: 1, 3: 3, 4: 14, 5: 130 },
    supportThreads: 10,
    supportThreadsResolved: 8,
    supportResolutionRate: 80,
    addedAt: '2025-01-01',
    lastUpdatedAt: '2026-08-10',
    lastUpdatedRelative: '6 days ago',
    freshness: 'fresh',
    requiresWordPress: '6.0',
    testedWordPress: '6.6',
    requiresPhp: '7.4',
    requiredPlugins: [],
    ...overrides,
  };
}

describe('plugin filtering', () => {
  const p1 = createMockPlugin({
    name: 'Fluent Forms',
    slug: 'fluentform',
    authorName: 'WPManageNinja',
    shortDescription: 'Fast and intuitive contact form plugin.',
    tags: ['forms', 'fluent'],
    version: '5.2.0',
    requiresPhp: '7.4',
    testedWordPress: '6.6',
  });

  const p2 = createMockPlugin({
    name: 'Contact Form 7',
    slug: 'contact-form-7',
    authorName: 'Takayuki Miyoshi',
    shortDescription: 'Just another contact form plugin. Simple but flexible.',
    tags: ['contact-form', 'email'],
    version: '6.0.1',
    requiresPhp: '8.0',
    testedWordPress: '6.7',
    requiredPlugins: ['flamingo'],
  });

  const p3 = createMockPlugin({
    name: 'WPForms Lite',
    slug: 'wpforms-lite',
    authorName: 'WPForms',
    shortDescription: 'Beginner friendly drag & drop WordPress form builder.',
    tags: ['drag-and-drop', 'survey'],
    version: '1.9.0',
    requiresPhp: '7.2',
    testedWordPress: '6.5',
  });

  const baseState: AppState = {
    plugins: [p1, p2, p3],
    activeTag: 'form-builder',
    query: '',
    sortKey: 'name',
    sortDirection: 'asc',
    activeView: 'table',
    status: 'ready',
    error: null,
    page: 1,
    totalPages: 1,
    totalResults: 3,
  };

  test('returns all plugins when query is empty', () => {
    const results = selectVisiblePlugins(baseState);
    expect(results.length).toBe(3);
  });

  test('filters case-insensitively by name', () => {
    const results = selectVisiblePlugins({ ...baseState, query: 'fluent' });
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe('fluentform');
  });

  test('filters by author name', () => {
    const results = selectVisiblePlugins({ ...baseState, query: 'Takayuki' });
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe('contact-form-7');
  });

  test('filters by short description', () => {
    const results = selectVisiblePlugins({ ...baseState, query: 'drag & drop' });
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe('wpforms-lite');
  });

  test('filters by tags', () => {
    const results = selectVisiblePlugins({ ...baseState, query: 'survey' });
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe('wpforms-lite');
  });

  test('filters by version and compatibility', () => {
    const results = selectVisiblePlugins({ ...baseState, query: 'flamingo' });
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe('contact-form-7');
  });

  test('returns empty array on unmatched query without mutating source plugins', () => {
    const results = selectVisiblePlugins({ ...baseState, query: 'nonexistent-query-xyz' });
    expect(results.length).toBe(0);
    expect(baseState.plugins.length).toBe(3);
  });
});

describe('plugin sorting', () => {
  const pA = createMockPlugin({
    name: 'Alpha Form',
    slug: 'alpha-form',
    activeInstalls: 10000,
    estimatedInstallsPerDay: 50,
    ratingScore: 4.5,
    ratingCount: 20,
    supportResolutionRate: 90,
    supportThreadsResolved: 9,
    lastUpdatedAt: '2026-08-01',
  });

  const pB = createMockPlugin({
    name: 'Beta Form',
    slug: 'beta-form',
    activeInstalls: 500000,
    estimatedInstallsPerDay: 400,
    ratingScore: 4.9,
    ratingCount: 200,
    supportResolutionRate: 70,
    supportThreadsResolved: 35,
    lastUpdatedAt: '2026-08-15',
  });

  const pC = createMockPlugin({
    name: 'Gamma Form',
    slug: 'gamma-form',
    activeInstalls: 500000, // Equal active installs to pB
    estimatedInstallsPerDay: 0, // Unavailable
    ratingScore: 0, // Unrated
    ratingCount: 0,
    supportResolutionRate: null, // No support threads
    supportThreads: 0,
    supportThreadsResolved: 0,
    lastUpdatedAt: null, // Missing date
  });

  test('sorts by name ascending and descending', () => {
    const asc = sortPlugins([pB, pA, pC], 'name', 'asc');
    expect(asc.map((p) => p.name)).toEqual(['Alpha Form', 'Beta Form', 'Gamma Form']);

    const desc = sortPlugins([pB, pA, pC], 'name', 'desc');
    expect(desc.map((p) => p.name)).toEqual(['Gamma Form', 'Beta Form', 'Alpha Form']);
  });

  test('sorts by active installs descending with name tie-breaking', () => {
    const desc = sortPlugins([pA, pC, pB], 'activeInstalls', 'desc');
    // pB and pC both have 500000, tie-breaker is name 'Beta Form' < 'Gamma Form'
    expect(desc.map((p) => p.name)).toEqual(['Beta Form', 'Gamma Form', 'Alpha Form']);
  });

  test('sorts by estimated installs per day placing unavailable (0) at bottom', () => {
    const desc = sortPlugins([pC, pA, pB], 'estimatedInstallsPerDay', 'desc');
    expect(desc.map((p) => p.name)).toEqual(['Beta Form', 'Alpha Form', 'Gamma Form']);

    const asc = sortPlugins([pC, pA, pB], 'estimatedInstallsPerDay', 'asc');
    expect(asc.map((p) => p.name)).toEqual(['Alpha Form', 'Beta Form', 'Gamma Form']);
  });

  test('sorts by rating placing unrated plugins at the bottom', () => {
    const desc = sortPlugins([pC, pA, pB], 'ratingScore', 'desc');
    expect(desc.map((p) => p.name)).toEqual(['Beta Form', 'Alpha Form', 'Gamma Form']);

    const asc = sortPlugins([pC, pA, pB], 'ratingScore', 'asc');
    expect(asc.map((p) => p.name)).toEqual(['Alpha Form', 'Beta Form', 'Gamma Form']);
  });

  test('sorts by support resolution placing plugins with no threads at the bottom', () => {
    const desc = sortPlugins([pC, pA, pB], 'supportResolution', 'desc');
    expect(desc.map((p) => p.name)).toEqual(['Alpha Form', 'Beta Form', 'Gamma Form']);

    const asc = sortPlugins([pC, pA, pB], 'supportResolution', 'asc');
    expect(asc.map((p) => p.name)).toEqual(['Beta Form', 'Alpha Form', 'Gamma Form']);
  });

  test('sorts by last updated placing missing dates at the bottom', () => {
    const desc = sortPlugins([pC, pA, pB], 'lastUpdated', 'desc');
    expect(desc.map((p) => p.name)).toEqual(['Beta Form', 'Alpha Form', 'Gamma Form']);
  });
});
