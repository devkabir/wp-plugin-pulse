import type { AppState, NormalizedPluginCollection } from '../domain/plugin-types';

export const appState: AppState = {
  plugins: [],
  activeTag: 'form-builder',
  query: '',
  sortKey: 'activeInstalls',
  sortDirection: 'desc',
  activeView: 'table',
  status: 'idle',
  error: null,
  page: 1,
  totalPages: 1,
  totalResults: 0,
};

export function beginLoading(tag: string): void {
  appState.activeTag = tag;
  appState.status = 'loading';
  appState.error = null;
}

export function finishLoading(collection: NormalizedPluginCollection): void {
  appState.plugins = collection.plugins;
  appState.page = collection.page;
  appState.totalPages = collection.totalPages;
  appState.totalResults = collection.totalResults;
  appState.status = 'ready';
}

export function failLoading(error: unknown): void {
  appState.status = 'error';
  appState.error = error instanceof Error ? error.message : 'Unable to load plugins.';
}
