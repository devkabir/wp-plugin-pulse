import type { AppState, SortKey } from '../domain/plugin-types';

export const SORT_LABELS: Record<SortKey, string> = {
  name: 'Plugin Name',
  lifetimeInstallPace: 'Lifetime Install Pace',
  activeInstalls: 'Active Installs',
  ratingScore: 'Rating',
  supportResolution: 'Support Resolution',
  lastUpdated: 'Last Updated',
};

export function formatResultsMeta(state: AppState, visibleCount: number): string {
  if (state.status === 'loading') {
    if (state.isBackgroundRefreshing) {
      return `Updating plugins tagged "${state.activeTag}"…`;
    }
    return `Loading plugins tagged "${state.activeTag}"…`;
  }

  if (state.status === 'error') {
    const tag = state.failedTag || state.activeTag;
    const msg = state.error?.message;
    return msg ? `Failed to load plugins for "${tag}": ${msg}` : `Failed to load plugins for "${tag}".`;
  }

  if (state.plugins.length === 0) {
    return `No plugins found for tag "${state.activeTag}".`;
  }

  if (visibleCount === 0) {
    return `No plugins matching “${state.query}” found among ${state.plugins.length} loaded plugins.`;
  }

  const sortLabel = SORT_LABELS[state.sortKey] || state.sortKey;
  const sortDir = state.sortDirection === 'asc' ? 'ascending' : 'descending';
  const isPartial =
    state.plugins.length < state.totalResults || state.loadedPages.length < state.totalPages;
  const totalPagesStr = `${state.totalPages} ${state.totalPages === 1 ? 'page' : 'pages'}`;
  const loadedPagesCount = state.loadedPages.length || 1;

  if (state.query.trim()) {
    if (isPartial) {
      return `Showing ${visibleCount} of ${state.plugins.length} loaded plugins (${state.totalResults} total across ${totalPagesStr}, ${loadedPagesCount} loaded) matching “${state.query}” (sorted by ${sortLabel}, ${sortDir} among loaded plugins)`;
    }
    return `Showing ${visibleCount} of ${state.totalResults} plugins across ${totalPagesStr} matching “${state.query}” (sorted by ${sortLabel}, ${sortDir})`;
  }

  if (isPartial) {
    return `Showing ${state.plugins.length} of ${state.totalResults} plugins tagged "${state.activeTag}" (${loadedPagesCount} of ${totalPagesStr} loaded — sorted by ${sortLabel}, ${sortDir} among loaded plugins)`;
  }

  return `Showing all ${state.totalResults} plugins tagged "${state.activeTag}" across ${totalPagesStr} (sorted by ${sortLabel}, ${sortDir})`;
}

export function updateResultsMeta(state: AppState, visibleCount: number): void {
  const meta = document.getElementById('results-meta');
  if (!meta) return;

  const nextText = formatResultsMeta(state, visibleCount);
  if (meta.textContent !== nextText) {
    meta.textContent = nextText;
  }
}

