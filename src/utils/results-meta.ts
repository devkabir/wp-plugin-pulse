import type { AppState, SortKey } from '../domain/plugin-types';

export const SORT_LABELS: Record<SortKey, string> = {
  name: 'Plugin Name',
  estimatedInstallsPerDay: 'Estimated Installs / Day',
  activeInstalls: 'Active Installs',
  ratingScore: 'Rating',
  supportResolution: 'Support Resolution',
  lastUpdated: 'Last Updated',
};

export function updateResultsMeta(state: AppState, visibleCount: number): void {
  const meta = document.getElementById('results-meta');
  if (!meta) return;

  if (state.status === 'loading') {
    meta.textContent = `Loading plugins tagged "${state.activeTag}"…`;
    return;
  }

  if (state.status === 'error') {
    meta.textContent = `Failed to load plugins for "${state.activeTag}".`;
    return;
  }

  if (state.plugins.length === 0) {
    meta.textContent = `No plugins found for tag "${state.activeTag}".`;
    return;
  }

  if (visibleCount === 0) {
    meta.textContent = `No plugins matching “${state.query}” found among ${state.plugins.length} loaded plugins.`;
    return;
  }

  const sortLabel = SORT_LABELS[state.sortKey] || state.sortKey;
  const sortDir = state.sortDirection === 'asc' ? 'ascending' : 'descending';
  const isPartial =
    state.plugins.length < state.totalResults || state.loadedPages.length < state.totalPages;
  const totalPagesStr = `${state.totalPages} ${state.totalPages === 1 ? 'page' : 'pages'}`;
  const loadedPagesCount = state.loadedPages.length || 1;

  if (state.query.trim()) {
    if (isPartial) {
      meta.textContent = `Showing ${visibleCount} of ${state.plugins.length} loaded plugins (${state.totalResults} total across ${totalPagesStr}, ${loadedPagesCount} loaded) matching “${state.query}” (sorted by ${sortLabel}, ${sortDir} among loaded plugins)`;
    } else {
      meta.textContent = `Showing ${visibleCount} of ${state.totalResults} plugins across ${totalPagesStr} matching “${state.query}” (sorted by ${sortLabel}, ${sortDir})`;
    }
  } else if (isPartial) {
    meta.textContent = `Showing ${state.plugins.length} of ${state.totalResults} plugins tagged "${state.activeTag}" (${loadedPagesCount} of ${totalPagesStr} loaded — sorted by ${sortLabel}, ${sortDir} among loaded plugins)`;
  } else {
    meta.textContent = `Showing all ${state.totalResults} plugins tagged "${state.activeTag}" across ${totalPagesStr} (sorted by ${sortLabel}, ${sortDir})`;
  }
}
