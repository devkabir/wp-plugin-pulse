import type { AppState, SortKey } from '../domain/plugin-types';
import { selectVisiblePlugins } from '../domain/plugin-selectors';
import { createPluginRow } from './plugin-row';
import {
  createEmptyCollectionRow,
  createErrorRow,
  createLoadingRow,
  createNoMatchesRow,
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

export function renderPluginTable(state: AppState, onClearFilter?: () => void): void {
  const tbody = document.getElementById('plugins-body');
  if (!(tbody instanceof HTMLTableSectionElement)) throw new Error('Plugin table body was not found.');

  updateTableHeaders(state);

  if (state.status === 'loading') {
    tbody.replaceChildren(createLoadingRow());
    updateResultsMeta(state, 0);
    return;
  }

  if (state.status === 'error') {
    tbody.replaceChildren(createErrorRow());
    updateResultsMeta(state, 0);
    return;
  }

  // Ready state: check if zero plugins loaded from API
  if (state.plugins.length === 0) {
    tbody.replaceChildren(createEmptyCollectionRow(state.activeTag));
    updateResultsMeta(state, 0);
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
    updateResultsMeta(state, 0);
    return;
  }

  // Render plugins
  tbody.replaceChildren(...visiblePlugins.map(createPluginRow));
  updateResultsMeta(state, visiblePlugins.length);
}
