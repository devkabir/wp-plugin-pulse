import { classifyError } from '../domain/error-classifier';
import type { ActiveView, AppState, NormalizedPlugin, NormalizedPluginCollection, SortDirection, SortKey } from '../domain/plugin-types';
import { getStoredView, setStoredView } from '../utils/view-preference';

export const appState: AppState = {
  plugins: [],
  activeTag: 'form-builder',
  query: '',
  sortKey: 'activeInstalls',
  sortDirection: 'desc',
  activeView: getStoredView(),
  status: 'idle',
  isBackgroundRefreshing: false,
  error: null,
  failedTag: null,
  page: 1,
  totalPages: 1,
  totalResults: 0,
  loadedPages: [],
  loadingMorePage: null,
  loadMoreError: null,
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

export function beginLoading(tag: string, isRefresh = false): void {
  if (isRefresh && appState.plugins.length > 0 && appState.activeTag === tag) {
    appState.isBackgroundRefreshing = true;
    appState.status = 'loading';
    appState.error = null;
    return;
  }

  appState.activeTag = tag;
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
  appState.failedTag = null;
  appState.loadingMorePage = null;
  appState.loadMoreError = null;
}

export function failLoading(error: unknown, tag?: string): void {
  appState.status = 'error';
  appState.isBackgroundRefreshing = false;
  appState.error = classifyError(error);
  appState.failedTag = tag ?? appState.activeTag;
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
