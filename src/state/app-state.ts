import { classifyError } from '../domain/error-classifier';
import type { ActiveView, AppState, NormalizedPlugin, NormalizedPluginCollection, PluginQuery, SortDirection, SortKey } from '../domain/plugin-types';
import { getStoredComparison, MAX_COMPETITORS, setStoredComparison } from '../utils/comparison-preference';
import { getStoredView, setStoredView } from '../utils/view-preference';

export function normalizeQuery(query: PluginQuery | string): PluginQuery {
  if (typeof query === 'string') {
    return { mode: 'tag', value: query.trim() };
  }
  return { mode: query.mode, value: query.value.trim() };
}

export const appState: AppState = {
  plugins: [],
  activeQuery: { mode: 'tag', value: 'form-builder' },
  query: '',
  sortKey: 'activeInstalls',
  sortDirection: 'desc',
  activeView: getStoredView(),
  status: 'idle',
  isBackgroundRefreshing: false,
  error: null,
  failedQuery: null,
  page: 1,
  totalPages: 1,
  totalResults: 0,
  loadedPages: [],
  loadingMorePage: null,
  loadMoreError: null,
  comparison: getStoredComparison(),
};

/**
 * Deduplicates plugins by slug (or name fallback) when merging pages.
 * Preserves the original order and incoming updates without duplicate keys.
 */
export function mergePluginCollections(
  existing: readonly NormalizedPlugin[],
  incoming: readonly NormalizedPlugin[]
): NormalizedPlugin[] {
  const seenSlugs = new Set<string>();
  const merged: NormalizedPlugin[] = [];

  for (const plugin of existing) {
    const key = plugin.slug || plugin.name;
    if (!seenSlugs.has(key)) {
      seenSlugs.add(key);
      merged.push(plugin);
    }
  }

  for (const plugin of incoming) {
    const key = plugin.slug || plugin.name;
    if (!seenSlugs.has(key)) {
      seenSlugs.add(key);
      merged.push(plugin);
    }
  }

  return merged;
}

export function beginLoading(query: PluginQuery | string, isRefresh = false): void {
  const normQuery = normalizeQuery(query);
  if (
    isRefresh &&
    appState.plugins.length > 0 &&
    appState.activeQuery.mode === normQuery.mode &&
    appState.activeQuery.value.toLowerCase() === normQuery.value.toLowerCase()
  ) {
    appState.isBackgroundRefreshing = true;
    appState.status = 'loading';
    appState.error = null;
    return;
  }

  appState.activeQuery = normQuery;
  appState.query = '';
  appState.status = 'loading';
  appState.isBackgroundRefreshing = false;
  appState.error = null;
  appState.plugins = [];
  appState.loadedPages = [];
  appState.loadingMorePage = null;
  appState.loadMoreError = null;
  appState.page = 1;
  appState.totalPages = 1;
  appState.totalResults = 0;
}

export function finishLoading(collection: NormalizedPluginCollection): void {
  appState.plugins = collection.plugins;
  appState.page = collection.page;
  appState.totalPages = collection.totalPages;
  appState.totalResults = collection.totalResults;
  appState.loadedPages = [collection.page];
  appState.status = 'ready';
  appState.isBackgroundRefreshing = false;
  appState.error = null;
  appState.failedQuery = null;
  appState.loadingMorePage = null;
  appState.loadMoreError = null;
}

export function failLoading(error: unknown, query?: PluginQuery | string): void {
  appState.status = 'error';
  appState.isBackgroundRefreshing = false;
  appState.error = classifyError(error);
  appState.failedQuery = query ? normalizeQuery(query) : appState.activeQuery;
  appState.loadingMorePage = null;
  appState.loadMoreError = null;
}

export function beginLoadingPage(page: number): void {
  appState.loadingMorePage = page;
  appState.loadMoreError = null;
}

export function appendLoadedPage(collection: NormalizedPluginCollection): void {
  appState.plugins = mergePluginCollections(appState.plugins, collection.plugins);
  appState.page = collection.page;
  appState.totalPages = collection.totalPages;
  appState.totalResults = collection.totalResults;

  if (!appState.loadedPages.includes(collection.page)) {
    appState.loadedPages = [...appState.loadedPages, collection.page].sort((a, b) => a - b);
  }

  appState.status = 'ready';
  appState.loadingMorePage = null;
  appState.loadMoreError = null;
}

export function failLoadingPage(page: number, error: unknown): void {
  appState.loadingMorePage = null;
  const appErr = classifyError(error);
  appState.loadMoreError = { page, message: appErr.message, error: appErr };
}

export function clearLoadMoreError(): void {
  appState.loadMoreError = null;
}

export function setQuery(query: string): void {
  appState.query = query;
}

export function clearQuery(): void {
  appState.query = '';
}

export function toggleSort(key: SortKey): void {
  if (appState.sortKey === key) {
    appState.sortDirection = appState.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    appState.sortKey = key;
    // Default names to ascending; numbers and dates default to descending
    appState.sortDirection = key === 'name' ? 'asc' : 'desc';
  }
}

export function setSorting(key: SortKey, direction: SortDirection): void {
  appState.sortKey = key;
  appState.sortDirection = direction;
}

export function setActiveView(view: ActiveView): void {
  appState.activeView = view;
  setStoredView(view);
}

export function setComparisonSubject(slug: string | null): void {
  const normSlug = typeof slug === 'string' && slug.trim().length > 0 ? slug.trim() : null;
  appState.comparison.subjectSlug = normSlug;
  if (normSlug) {
    appState.comparison.competitorSlugs = appState.comparison.competitorSlugs.filter(
      (s) => s !== normSlug
    );
  }
  setStoredComparison(appState.comparison);
}

export function toggleCompetitor(slug: string): boolean {
  const normSlug = typeof slug === 'string' ? slug.trim() : '';
  if (!normSlug) return false;

  // Invariant: subject cannot also be a competitor
  if (appState.comparison.subjectSlug === normSlug) {
    return false;
  }

  if (appState.comparison.competitorSlugs.includes(normSlug)) {
    appState.comparison.competitorSlugs = appState.comparison.competitorSlugs.filter(
      (s) => s !== normSlug
    );
    setStoredComparison(appState.comparison);
    return true;
  }

  // Invariant: maximum three competitors
  if (appState.comparison.competitorSlugs.length >= MAX_COMPETITORS) {
    return false;
  }

  appState.comparison.competitorSlugs = [...appState.comparison.competitorSlugs, normSlug];
  setStoredComparison(appState.comparison);
  return true;
}

export function removeCompetitor(slug: string): void {
  const normSlug = typeof slug === 'string' ? slug.trim() : '';
  if (!normSlug) return;
  appState.comparison.competitorSlugs = appState.comparison.competitorSlugs.filter(
    (s) => s !== normSlug
  );
  setStoredComparison(appState.comparison);
}

export function clearComparison(): void {
  appState.comparison = {
    subjectSlug: null,
    competitorSlugs: [],
  };
  setStoredComparison(appState.comparison);
}

