import './style.css';
import { createIcons, Activity, Search, Sun, Moon, Filter, X } from 'lucide';
import { fetchPlugins } from './api/plugins';
import { renderPluginTable } from './components/plugin-table';
import { renderKpiSummary } from './components/kpi-summary';
import {
  appState,
  beginLoading,
  clearQuery,
  failLoading,
  finishLoading,
  setQuery,
  toggleSort,
} from './state/app-state';
import type { SortKey } from './domain/plugin-types';
import { initTheme } from './utils/theme';

let activeRequest: AbortController | null = null;

async function loadPlugins(tag = 'form-builder'): Promise<void> {
  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  beginLoading(tag);
  renderPluginTable(appState);
  renderKpiSummary(appState);

  try {
    const collection = await fetchPlugins(tag, 1, request.signal);
    if (request !== activeRequest) return;
    finishLoading(collection);
    renderPluginTable(appState);
    renderKpiSummary(appState);
  } catch (error) {
    if (request.signal.aborted || request !== activeRequest) return;
    console.error(error);
    failLoading(error);
    renderPluginTable(appState);
    renderKpiSummary(appState);
  } finally {
    if (request === activeRequest) activeRequest = null;
  }
}

function setActiveChip(activeTag: string | null): void {
  document.querySelectorAll<HTMLButtonElement>('#tag-chips .chip').forEach((chip) => {
    chip.classList.toggle('chip--active', chip.dataset.tag === activeTag);
  });
}

function initControls(): void {
  const tagInput = document.getElementById('tag-input') as HTMLInputElement | null;
  const filterInput = document.getElementById('filter-input') as HTMLInputElement | null;
  const filterClear = document.getElementById('filter-clear') as HTMLButtonElement | null;
  const pluginsTable = document.getElementById('plugins-table');

  const submitTag = (): void => {
    const tag = tagInput?.value.trim();
    if (!tag) return;
    setActiveChip(null);
    void loadPlugins(tag);
  };

  // Tag Chips
  document.getElementById('tag-chips')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest<HTMLButtonElement>('.chip');
    if (!chip?.dataset.tag) return;
    setActiveChip(chip.dataset.tag);
    if (tagInput) tagInput.value = '';
    void loadPlugins(chip.dataset.tag);
  });

  // Tag Search Input
  document.getElementById('tag-submit')?.addEventListener('click', submitTag);
  tagInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitTag();
  });

  // Client-Side Search Filter Input
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      const query = filterInput.value;
      setQuery(query);
      if (filterClear) {
        filterClear.hidden = query.length === 0;
      }
      renderPluginTable(appState);
    });
  }

  // Clear Filter Button
  const handleClearFilter = (): void => {
    clearQuery();
    if (filterInput) {
      filterInput.value = '';
      filterInput.focus();
    }
    if (filterClear) {
      filterClear.hidden = true;
    }
    renderPluginTable(appState);
  };

  filterClear?.addEventListener('click', handleClearFilter);
  document.addEventListener('clear-plugin-filter', handleClearFilter);

  // Table Column Sort Headers
  pluginsTable?.querySelector('thead')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLButtonElement>('.th-sort-btn');
    if (!btn) return;

    const th = btn.closest<HTMLTableCellElement>('th[data-sort-key]');
    const sortKey = th?.getAttribute('data-sort-key') as SortKey | null;
    if (!sortKey) return;

    toggleSort(sortKey);
    renderPluginTable(appState);
  });

  // Actionable Tag Chips in Plugin Rows
  document.addEventListener('select-tag', (event) => {
    const customEvent = event as CustomEvent<{ tag: string }>;
    const tag = customEvent.detail?.tag;
    if (!tag) return;

    setActiveChip(tag);
    if (tagInput) tagInput.value = '';
    void loadPlugins(tag);
  });
}

initTheme();
createIcons({ icons: { Activity, Search, Sun, Moon, Filter, X }, attrs: { 'stroke-width': 1.75 } });
initControls();
void loadPlugins();
