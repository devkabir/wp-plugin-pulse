import { beforeEach, describe, expect, it } from 'bun:test';
import type { NormalizedPlugin } from './plugin-types';
import { selectVisiblePlugins } from './plugin-selectors';
import {
  appState,
  beginLoading,
  finishLoading,
  setActiveView,
  setQuery,
  setSorting,
} from '../state/app-state';

function createMockPlugin(overrides: Partial<NormalizedPlugin> = {}): NormalizedPlugin {
  return {
    name: 'Form Builder Pro',
    slug: 'form-builder-pro',
    version: '2.5.0',
    authorName: 'PluginDev',
    authorProfileUrl: 'https://profiles.wordpress.org/plugindev',
    homepageUrl: null,
    pluginUrl: 'https://wordpress.org/plugins/form-builder-pro/',
    downloadUrl: 'https://downloads.wordpress.org/plugin/form-builder-pro.2.5.0.zip',
    iconUrl: 'https://ps.w.org/form-builder-pro/assets/icon-128x128.png',
    shortDescription: 'Modern visual form builder for WordPress.',
    tags: ['forms', 'contact', 'builder'],
    activeInstalls: 50000,
    activeInstallsDisplay: '50,000+',
    lifetimeDownloads: 500000,
    lifetimeDownloadsDisplay: '500,000',
    lifetimeInstallPace: 125,
    lifetimeInstallPaceDisplay: '125',
    daysSinceAdded: 400,
    ratingPercent: 96,
    ratingScore: 4.8,
    ratingScoreDisplay: '4.8',
    ratingCount: 250,
    ratingDistribution: { 1: 5, 2: 2, 3: 3, 4: 15, 5: 225 },
    supportThreads: 20,
    supportThreadsResolved: 18,
    supportResolutionRate: 90,
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

describe('view switching and data preservation', () => {
  beforeEach(() => {
    beginLoading('form-builder');
    finishLoading({
      plugins: [
        createMockPlugin({ name: 'Alpha Forms', slug: 'alpha-forms', activeInstalls: 20000 }),
        createMockPlugin({ name: 'Beta Forms', slug: 'beta-forms', activeInstalls: 80000 }),
        createMockPlugin({ name: 'Gamma Forms', slug: 'gamma-forms', activeInstalls: 50000 }),
      ],
      page: 1,
      totalPages: 3,
      totalResults: 250,
    });
    setQuery('forms');
    setSorting('activeInstalls', 'desc');
    setActiveView('table');
  });

  it('preserves active query, filter query, sort key, sort direction, and loaded data when switching to cards view', () => {
    expect(appState.activeView).toBe('table');
    expect(appState.activeQuery).toEqual({ mode: 'tag', value: 'form-builder' });
    expect(appState.query).toBe('forms');
    expect(appState.sortKey).toBe('activeInstalls');
    expect(appState.sortDirection).toBe('desc');
    expect(appState.plugins.length).toBe(3);

    // Switch view to cards
    setActiveView('cards');

    expect(appState.activeView).toBe('cards');
    expect(appState.activeQuery).toEqual({ mode: 'tag', value: 'form-builder' });
    expect(appState.query).toBe('forms');
    expect(appState.sortKey).toBe('activeInstalls');
    expect(appState.sortDirection).toBe('desc');
    expect(appState.plugins.length).toBe(3);
  });

  it('renders both views from the exact same normalized and filtered plugin collection', () => {
    const visibleInTable = selectVisiblePlugins(appState);
    expect(visibleInTable.map((p) => p.name)).toEqual(['Beta Forms', 'Gamma Forms', 'Alpha Forms']);

    setActiveView('cards');
    const visibleInCards = selectVisiblePlugins(appState);
    expect(visibleInCards).toEqual(visibleInTable);
  });

  it('preserves pagination state and loaded pages when switching views', () => {
    expect(appState.page).toBe(1);
    expect(appState.totalPages).toBe(3);
    expect(appState.totalResults).toBe(250);
    expect(appState.loadedPages).toEqual([1]);

    setActiveView('cards');

    expect(appState.page).toBe(1);
    expect(appState.totalPages).toBe(3);
    expect(appState.totalResults).toBe(250);
    expect(appState.loadedPages).toEqual([1]);
  });
});
