import type { AppState } from '../domain/plugin-types';
import { selectVisiblePlugins } from '../domain/plugin-selectors';
import { createPluginRow } from './plugin-row';
import { createErrorRow, createLoadingRow } from './table-status-row';

export function renderPluginTable(state: AppState): void {
  const tbody = document.getElementById('plugins-body');
  const meta = document.getElementById('results-meta');
  if (!(tbody instanceof HTMLTableSectionElement)) throw new Error('Plugin table body was not found.');

  if (state.status === 'loading') {
    tbody.replaceChildren(createLoadingRow());
    if (meta) meta.textContent = '';
    return;
  }
  if (state.status === 'error') {
    tbody.replaceChildren(createErrorRow());
    if (meta) meta.textContent = '';
    return;
  }

  const plugins = selectVisiblePlugins(state);
  tbody.replaceChildren(...plugins.map(createPluginRow));
  if (meta) {
    meta.textContent = plugins.length > 0
      ? `Showing ${plugins.length} of ${state.totalResults} plugins tagged "${state.activeTag}"`
      : `No plugins found for tag "${state.activeTag}"`;
  }
}
