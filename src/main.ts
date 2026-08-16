import './style.css';
import { createIcons, Activity, Search, Sun, Moon, Filter, X } from 'lucide';
import { fetchPlugins } from './api/plugins';
import { renderPluginTable } from './components/plugin-table';
import { renderKpiSummary } from './components/kpi-summary';
import { getNextUnloadedPage, renderPaginationControls } from './components/pagination-controls';
import {
  appState,
  appendLoadedPage,
  beginLoading,
  beginLoadingPage,
  clearQuery,
  failLoading,
  failLoadingPage,
  finishLoading,
  setQuery,
  toggleSort,
} from './state/app-state';
import type { SortKey } from './domain/plugin-types';
import { initTheme } from './utils/theme';

let activeRequest: AbortController | null = null;
let isLoadingAllRemaining = false;

function refreshIcons(): void {
  createIcons({ icons: { Activity, Search, Sun, Moon, Filter, X }, attrs: { 'stroke-width': 1.75 } });
}

function renderApp(): void {
  renderPluginTable(appState);
  renderKpiSummary(appState);
  renderPaginationControls(appState, {
    onLoadPage: (page) => void loadPluginPage(page, true),
    onLoadAllRemaining: () => void loadAllRemainingPages(),
    onRetryPage: (page) => void loadPluginPage(page, true),
  });
  refreshIcons();
}

async function loadPlugins(tag = 'form-builder'): Promise<void> {
  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  isLoadingAllRemaining = false;

  beginLoading(tag);
  renderApp();

  try {
    const collection = await fetchPlugins(tag, 1, request.signal);
    if (request !== activeRequest) return;
    finishLoading(collection);
    renderApp();
  } catch (error) {
    if (request.signal.aborted || request !== activeRequest) return;
    console.error(error);
    failLoading(error);
    renderApp();
  } finally {
    if (request === activeRequest) activeRequest = null;
  }
}

async function loadPluginPage(page: number, shouldFocus = true): Promise<boolean> {
  if (appState.loadingMorePage !== null || appState.loadedPages.includes(page)) {
    return false;
  }

  beginLoadingPage(page);
  renderApp();

  try {
    const collection = await fetchPlugins(appState.activeTag, page);
    appendLoadedPage(collection);
    renderApp();

    if (shouldFocus) {
      if (appState.loadedPages.length < appState.totalPages) {
        const nextBtn = document.getElementById('btn-load-more');
        nextBtn?.focus();
      } else {
        const statusEl = document.querySelector<HTMLElement>('.pagination-status');
        if (statusEl) {
          statusEl.setAttribute('tabindex', '-1');
          statusEl.focus();
        }
      }
    }
    return true;
  } catch (error) {
    console.error(`Error loading page ${page}:`, error);
    failLoadingPage(page, error);
    renderApp();

    const retryBtn = document.getElementById('btn-retry-page');
    retryBtn?.focus();
    return false;
  }
}

async function loadAllRemainingPages(): Promise<void> {
  if (isLoadingAllRemaining || appState.loadingMorePage !== null) return;
  isLoadingAllRemaining = true;

  try {
    while (appState.loadedPages.length < appState.totalPages) {
      const nextPage = getNextUnloadedPage(appState.loadedPages, appState.totalPages);
      if (nextPage === null) break;

      const success = await loadPluginPage(nextPage, false);
      if (!success) {
        // Stop on partial failure; existing loaded pages are preserved
        break;
      }
    }

    if (appState.loadedPages.length >= appState.totalPages) {
      const statusEl = document.querySelector<HTMLElement>('.pagination-status');
      if (statusEl) {
        statusEl.setAttribute('tabindex', '-1');
        statusEl.focus();
      }
    }
  } finally {
    isLoadingAllRemaining = false;
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

  // Pagination Custom Events
  document.addEventListener('load-plugin-page', (event) => {
    const customEvent = event as CustomEvent<{ page: number }>;
    const page = customEvent.detail?.page;
    if (page && Number.isInteger(page)) {
      void loadPluginPage(page, true);
    }
  });

  document.addEventListener('load-all-plugin-pages', () => {
    void loadAllRemainingPages();
  });
}

initTheme();
refreshIcons();
initControls();
void loadPlugins();

