import './style.css';
import { createIcons, Activity, Search, Sun, Moon, Filter, X, Table, LayoutGrid } from 'lucide';
import { fetchPlugins } from './api/plugins';
import { renderPluginTable } from './components/plugin-table';
import { renderCardView } from './components/card-view';
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
  setActiveView,
  setQuery,
  setSorting,
  toggleSort,
} from './state/app-state';
import type { ActiveView, SortDirection, SortKey } from './domain/plugin-types';
import { initTheme } from './utils/theme';

let activeRequest: AbortController | null = null;
let isLoadingAllRemaining = false;

function refreshIcons(): void {
  createIcons({
    icons: { Activity, Search, Sun, Moon, Filter, X, Table, LayoutGrid },
    attrs: { 'stroke-width': 1.75 },
  });
}

function updateViewControls(activeView: ActiveView): void {
  const tableBtn = document.getElementById('view-toggle-table') as HTMLButtonElement | null;
  const cardsBtn = document.getElementById('view-toggle-cards') as HTMLButtonElement | null;

  if (tableBtn) {
    const isTable = activeView === 'table';
    tableBtn.classList.toggle('view-btn--active', isTable);
    tableBtn.setAttribute('aria-pressed', isTable ? 'true' : 'false');
  }

  if (cardsBtn) {
    const isCards = activeView === 'cards';
    cardsBtn.classList.toggle('view-btn--active', isCards);
    cardsBtn.setAttribute('aria-pressed', isCards ? 'true' : 'false');
  }
}

function updateSortSelect(key: SortKey, direction: SortDirection): void {
  const sortSelect = document.getElementById('sort-select') as HTMLSelectElement | null;
  if (sortSelect) {
    sortSelect.value = `${key}-${direction}`;
  }
}

function updateBusyState(isBusy: boolean): void {
  const tableWrapper = document.getElementById('table-view-wrapper');
  const cardsWrapper = document.getElementById('cards-view-wrapper');
  const tagSubmit = document.getElementById('tag-submit') as HTMLButtonElement | null;

  tableWrapper?.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  cardsWrapper?.setAttribute('aria-busy', isBusy ? 'true' : 'false');

  if (tagSubmit) {
    tagSubmit.disabled = isBusy;
    tagSubmit.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
  }
}

function renderApp(): void {
  const tableWrapper = document.getElementById('table-view-wrapper');
  const cardsWrapper = document.getElementById('cards-view-wrapper');
  const tableBody = document.getElementById('plugins-body');
  const cardsContainer = document.getElementById('plugins-cards');

  updateViewControls(appState.activeView);
  updateSortSelect(appState.sortKey, appState.sortDirection);
  updateBusyState(appState.status === 'loading');

  const onRetry = (): void => {
    void loadPlugins(appState.failedTag || appState.activeTag, false);
  };

  // Maintain exactly ONE active interactive view in the accessibility tree
  if (appState.activeView === 'table') {
    if (tableWrapper) tableWrapper.hidden = false;
    if (cardsWrapper) cardsWrapper.hidden = true;
    cardsContainer?.replaceChildren();
    renderPluginTable(appState, undefined, onRetry);
  } else {
    if (cardsWrapper) cardsWrapper.hidden = false;
    if (tableWrapper) tableWrapper.hidden = true;
    tableBody?.replaceChildren();
    renderCardView(appState, undefined, onRetry);
  }

  renderKpiSummary(appState);
  renderPaginationControls(appState, {
    onLoadPage: (page) => void loadPluginPage(page, true),
    onLoadAllRemaining: () => void loadAllRemainingPages(),
    onRetryPage: (page) => void loadPluginPage(page, true),
  });
  refreshIcons();
}

async function loadPlugins(tag = 'form-builder', isRefresh = false): Promise<void> {
  // Guard against duplicate matching submissions while a matching request is active
  if (
    appState.status === 'loading' &&
    appState.activeTag.toLowerCase() === tag.trim().toLowerCase() &&
    !isRefresh
  ) {
    return;
  }

  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  isLoadingAllRemaining = false;

  beginLoading(tag, isRefresh);
  renderApp();

  try {
    const collection = await fetchPlugins(tag, 1, request.signal);
    if (request !== activeRequest) return;
    finishLoading(collection);
    renderApp();
  } catch (error) {
    if (request.signal.aborted || request !== activeRequest) return;
    console.error(error);
    failLoading(error, tag);
    renderApp();
  } finally {
    if (request === activeRequest) {
      activeRequest = null;
      updateBusyState(false);
    }
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
    if (appState.status === 'loading' && appState.activeTag.toLowerCase() === tag.toLowerCase()) return;
    setActiveChip(null);
    void loadPlugins(tag);
  };

  // Tag Chips
  document.getElementById('tag-chips')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest<HTMLButtonElement>('.chip');
    if (!chip?.dataset.tag) return;
    const tag = chip.dataset.tag;
    if (appState.status === 'loading' && appState.activeTag.toLowerCase() === tag.toLowerCase()) return;
    setActiveChip(tag);
    if (tagInput) tagInput.value = '';
    void loadPlugins(tag);
  });

  // Tag Search Input
  document.getElementById('tag-submit')?.addEventListener('click', submitTag);
  tagInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitTag();
  });

  // Retry event
  document.addEventListener('retry-plugin-request', () => {
    void loadPlugins(appState.failedTag || appState.activeTag, false);
  });

  // Client-Side Search Filter Input
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      const query = filterInput.value;
      setQuery(query);
      if (filterClear) {
        filterClear.hidden = query.length === 0;
      }
      renderApp();
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
    renderApp();
  };

  filterClear?.addEventListener('click', handleClearFilter);
  document.addEventListener('clear-plugin-filter', handleClearFilter);

  // View Mode Segmented Control
  const tableBtn = document.getElementById('view-toggle-table');
  const cardsBtn = document.getElementById('view-toggle-cards');

  tableBtn?.addEventListener('click', () => {
    if (appState.activeView === 'table') return;
    setActiveView('table');
    renderApp();
  });

  cardsBtn?.addEventListener('click', () => {
    if (appState.activeView === 'cards') return;
    setActiveView('cards');
    renderApp();
  });

  // Sort Dropdown Selector
  const sortSelect = document.getElementById('sort-select') as HTMLSelectElement | null;
  sortSelect?.addEventListener('change', () => {
    const val = sortSelect.value;
    const lastDash = val.lastIndexOf('-');
    if (lastDash === -1) return;
    const key = val.substring(0, lastDash) as SortKey;
    const dir = val.substring(lastDash + 1) as SortDirection;
    setSorting(key, dir);
    renderApp();
  });

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
    renderApp();
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

