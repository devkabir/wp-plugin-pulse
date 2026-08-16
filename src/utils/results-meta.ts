import type { AppState, PluginQuery, SortKey } from '../domain/plugin-types';

export const SORT_LABELS: Record<SortKey, string> = {
  name: 'Plugin Name',
  lifetimeInstallPace: 'Lifetime Install Pace',
  activeInstalls: 'Active Installs',
  ratingScore: 'Rating',
  supportResolution: 'Support Resolution',
  lastUpdated: 'Last Updated',
};

export function formatQueryQualifier(query: PluginQuery): string {
  if (query.mode === 'slug') {
    return `with slug "${query.value}"`;
  }
  if (query.mode === 'search') {
    return `matching keyword "${query.value}"`;
  }
  return `tagged "${query.value}"`;
}

export function formatResultsMeta(state: AppState, visibleCount: number): string {
  const activeQ = state.activeQuery;

  if (state.status === 'loading') {
    if (state.isBackgroundRefreshing) {
      if (activeQ.mode === 'slug') {
        return `Updating plugin with slug "${activeQ.value}"…`;
      }
      if (activeQ.mode === 'search') {
        return `Updating plugins matching keyword "${activeQ.value}"…`;
      }
      return `Updating plugins tagged "${activeQ.value}"…`;
    }
    if (activeQ.mode === 'slug') {
      return `Loading plugin with slug "${activeQ.value}"…`;
    }
    if (activeQ.mode === 'search') {
      return `Loading plugins matching keyword "${activeQ.value}"…`;
    }
    return `Loading plugins tagged "${activeQ.value}"…`;
  }

  if (state.status === 'error') {
    const q = state.failedQuery || activeQ;
    const modeLabel = q.mode === 'slug' ? 'slug' : q.mode === 'search' ? 'keyword' : 'tag';
    const prefix = q.mode === 'slug' ? 'plugin' : 'plugins';
    const msg = state.error?.message;
    return msg ? `Failed to load ${prefix} for ${modeLabel} "${q.value}": ${msg}` : `Failed to load ${prefix} for ${modeLabel} "${q.value}".`;
  }

  if (state.plugins.length === 0) {
    if (activeQ.mode === 'slug') {
      return `No plugin found for slug "${activeQ.value}".`;
    }
    if (activeQ.mode === 'search') {
      return `No plugins found for keyword "${activeQ.value}".`;
    }
    return `No plugins found for tag "${activeQ.value}".`;
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
    if (activeQ.mode === 'slug') {
      return `Showing 1 plugin with slug "${activeQ.value}" matching “${state.query}” (sorted by ${sortLabel}, ${sortDir})`;
    }
    if (isPartial) {
      return `Showing ${visibleCount} of ${state.plugins.length} loaded plugins (${state.totalResults} total across ${totalPagesStr}, ${loadedPagesCount} loaded) matching “${state.query}” (sorted by ${sortLabel}, ${sortDir} among loaded plugins)`;
    }
    return `Showing ${visibleCount} of ${state.totalResults} plugins across ${totalPagesStr} matching “${state.query}” (sorted by ${sortLabel}, ${sortDir})`;
  }

  if (activeQ.mode === 'slug') {
    return `Showing plugin with slug "${activeQ.value}"`;
  }

  if (isPartial) {
    return `Showing ${state.plugins.length} of ${state.totalResults} plugins ${formatQueryQualifier(activeQ)} (${loadedPagesCount} of ${totalPagesStr} loaded — sorted by ${sortLabel}, ${sortDir} among loaded plugins)`;
  }

  return `Showing all ${state.totalResults} plugins ${formatQueryQualifier(activeQ)} across ${totalPagesStr} (sorted by ${sortLabel}, ${sortDir})`;
}

export function updateResultsMeta(state: AppState, visibleCount: number): void {
  const meta = document.getElementById('results-meta');
  if (!meta) return;

  const nextText = formatResultsMeta(state, visibleCount);
  if (meta.textContent !== nextText) {
    meta.textContent = nextText;
  }
}

