import type { AppState, SortKey } from '../domain/plugin-types';
import { selectVisiblePlugins } from '../domain/plugin-selectors';
import { createPluginRow } from './plugin-row';
import {
  createEmptyCollectionRow,
  createErrorRow,
  createLoadingRow,
  createNoMatchesRow,
} from './table-status-row';

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Plugin Name',
  estimatedInstallsPerDay: 'Estimated Installs / Day',
  activeInstalls: 'Active Installs',
  ratingScore: 'Rating',
  supportResolution: 'Support Resolution',
  lastUpdated: 'Last Updated',
};

export function updateTableHeaders(state: AppState): void {
  const table = document.getElementById('plugins-table');
  if (!table) return;

  const thList = table.querySelectorAll<HTMLTableCellElement>('thead th[data-sort-key]');
  thList.forEach((th) => {
    const key = th.getAttribute('data-sort-key') as SortKey | null;
    if (!key) return;

    const isActive = state.sortKey === key;
    const sortDirection = isActive ? state.sortDirection : 'none';
    const ariaSortValue = isActive
      ? state.sortDirection === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';

    th.setAttribute('aria-sort', ariaSortValue);

    const button = th.querySelector<HTMLButtonElement>('.th-sort-btn');
    if (button) {
      const colLabel = SORT_LABELS[key] || key;
      const nextDir = isActive && state.sortDirection === 'desc' ? 'ascending' : 'descending';
      button.setAttribute(
        'aria-label',
        isActive
          ? `Sort by ${colLabel}, currently ${sortDirection}. Activate to sort ${nextDir}.`
          : `Sort by ${colLabel}. Activate to sort descending.`
      );
      button.classList.toggle('th-sort-btn--active', isActive);
      button.dataset.direction = isActive ? state.sortDirection : '';
    }
  });
}

export function renderPluginTable(state: AppState, onClearFilter?: () => void): void {
  const tbody = document.getElementById('plugins-body');
  const meta = document.getElementById('results-meta');
  if (!(tbody instanceof HTMLTableSectionElement)) throw new Error('Plugin table body was not found.');

  updateTableHeaders(state);

  if (state.status === 'loading') {
    tbody.replaceChildren(createLoadingRow());
    if (meta) meta.textContent = `Loading plugins tagged "${state.activeTag}"…`;
    return;
  }

  if (state.status === 'error') {
    tbody.replaceChildren(createErrorRow());
    if (meta) meta.textContent = `Failed to load plugins for "${state.activeTag}".`;
    return;
  }

  // Ready state: check if zero plugins loaded from API
  if (state.plugins.length === 0) {
    tbody.replaceChildren(createEmptyCollectionRow(state.activeTag));
    if (meta) {
      meta.textContent = `No plugins found for tag "${state.activeTag}".`;
    }
    return;
  }

  const visiblePlugins = selectVisiblePlugins(state);

  // Ready state: check if filter returned zero matches
  if (visiblePlugins.length === 0) {
    tbody.replaceChildren(
      createNoMatchesRow(state.query, () => {
        if (onClearFilter) {
          onClearFilter();
        } else {
          document.dispatchEvent(new CustomEvent('clear-plugin-filter'));
        }
      })
    );
    if (meta) {
      meta.textContent = `No plugins matching “${state.query}” found among ${state.plugins.length} loaded plugins.`;
    }
    return;
  }

  // Render plugins
  tbody.replaceChildren(...visiblePlugins.map(createPluginRow));

  // Update meta announcement
  if (meta) {
    const sortLabel = SORT_LABELS[state.sortKey] || state.sortKey;
    const sortDir = state.sortDirection === 'asc' ? 'ascending' : 'descending';

    if (state.query.trim()) {
      meta.textContent = `Showing ${visiblePlugins.length} of ${state.plugins.length} loaded plugins matching “${state.query}” (sorted by ${sortLabel}, ${sortDir})`;
    } else if (state.plugins.length < state.totalResults) {
      meta.textContent = `Showing ${state.plugins.length} of ${state.totalResults} plugins tagged "${state.activeTag}" (sorted by ${sortLabel}, ${sortDir})`;
    } else {
      meta.textContent = `Showing ${state.plugins.length} plugins tagged "${state.activeTag}" (sorted by ${sortLabel}, ${sortDir})`;
    }
  }
}
