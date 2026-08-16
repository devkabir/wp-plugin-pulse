import type { AppState, SortKey } from '../domain/plugin-types';
import { selectVisiblePlugins } from '../domain/plugin-selectors';
import { createPluginRow } from './plugin-row';
import {
  createTableEmptyTagRow,
  createTableErrorRow,
  createTableNoMatchesRow,
  createTableSkeletons,
} from './table-status-row';
import { SORT_LABELS, updateResultsMeta } from '../utils/results-meta';

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

export function renderPluginTable(
  state: AppState,
  onClearFilter?: () => void,
  onRetry?: () => void
): void {
  const tbody = document.getElementById('plugins-body');
  const tableWrapper = document.getElementById('table-view-wrapper');
  if (!(tbody instanceof HTMLTableSectionElement)) throw new Error('Plugin table body was not found.');

  updateTableHeaders(state);

  // Background refresh: preserve existing rendered rows but mark wrapper as stale
  if (state.status === 'loading' && state.isBackgroundRefreshing && state.plugins.length > 0) {
    tableWrapper?.classList.add('is-stale');
    const visiblePlugins = selectVisiblePlugins(state);
    tbody.replaceChildren(...visiblePlugins.map(createPluginRow));
    updateResultsMeta(state, visiblePlugins.length);
    return;
  }

  tableWrapper?.classList.remove('is-stale');

  // Fresh loading: show layout-matched table skeletons
  if (state.status === 'loading') {
    tbody.replaceChildren(createTableSkeletons(6));
    updateResultsMeta(state, 0);
    return;
  }

  // Error state: show informative error row with operable retry button
  if (state.status === 'error') {
    tbody.replaceChildren(
      createTableErrorRow(
        state.error,
        state.failedQuery || state.activeQuery,
        onRetry ?? (() => document.dispatchEvent(new CustomEvent('retry-plugin-request')))
      )
    );
    updateResultsMeta(state, 0);
    return;
  }

  // Ready state: check if zero plugins loaded from API
  if (state.plugins.length === 0) {
    tbody.replaceChildren(createTableEmptyTagRow(state.activeQuery));
    updateResultsMeta(state, 0);
    return;
  }

  const visiblePlugins = selectVisiblePlugins(state);

  // Ready state: check if filter returned zero matches
  if (visiblePlugins.length === 0) {
    tbody.replaceChildren(
      createTableNoMatchesRow(state.query, () => {
        if (onClearFilter) {
          onClearFilter();
        } else {
          document.dispatchEvent(new CustomEvent('clear-plugin-filter'));
        }
      })
    );
    updateResultsMeta(state, 0);
    return;
  }

  // Render plugin rows
  tbody.replaceChildren(...visiblePlugins.map(createPluginRow));
  updateResultsMeta(state, visiblePlugins.length);
}

