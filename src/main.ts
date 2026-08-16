import './style.css';
import { createIcons, Activity, Search, Sun, Moon, Filter, X, Table, LayoutGrid } from 'lucide';
import { fetchPluginBySlug, fetchPluginCollection } from './api/plugins';
import { renderPluginTable } from './components/plugin-table';
import { renderCardView } from './components/card-view';
import { renderKpiSummary } from './components/kpi-summary';
import { getNextUnloadedPage, renderPaginationControls } from './components/pagination-controls';
import { announceComparisonStatus, renderComparisonTray } from './components/comparison-tray';
import {
  closeComparisonSection,
  renderComparisonSection,
} from './components/comparison-section';
import {
  appState,
  appendLoadedPage,
  beginLoading,
  beginLoadingPage,
  clearComparison,
  clearQuery,
  failLoading,
  failLoadingPage,
  finishLoading,
  mergePluginCollections,
  normalizeQuery,
  removeCompetitor,
  setActiveView,
  setComparisonSubject,
  setQuery,
  setSorting,
  toggleCompetitor,
  toggleSort,
} from './state/app-state';
import type { ActiveView, NormalizedPlugin, PluginQuery, QueryMode, SortDirection, SortKey } from './domain/plugin-types';
import { initTheme } from './utils/theme';

let activeRequest: AbortController | null = null;
let isLoadingAllRemaining = false;
let isComparisonOpen = false;

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
  const searchSubmit = (document.getElementById('search-submit') || document.getElementById('tag-submit')) as HTMLButtonElement | null;
  const searchModeSelect = document.getElementById('search-mode-select') as HTMLSelectElement | null;

  tableWrapper?.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  cardsWrapper?.setAttribute('aria-busy', isBusy ? 'true' : 'false');

  if (searchSubmit) {
    searchSubmit.disabled = isBusy;
    searchSubmit.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
  }
  if (searchModeSelect) {
    searchModeSelect.disabled = isBusy;
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
    void loadPlugins(appState.failedQuery || appState.activeQuery, false);
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

  const comparisonSection = document.getElementById('comparison-section');
  if (isComparisonOpen) {
    if (comparisonSection) {
      comparisonSection.hidden = false;
      renderComparisonSection(appState, {
        onClose: () => handleCloseComparison(),
        onSetSubject: (slug) => {
          setComparisonSubject(slug);
          renderApp();
        },
        onRemoveCompetitor: (slug) => {
          removeCompetitor(slug);
          renderApp();
        },
      });
    }
  } else {
    if (comparisonSection) {
      comparisonSection.hidden = true;
    }
  }

  renderComparisonTray(appState);
  refreshIcons();
}

async function loadPlugins(
  query: PluginQuery | string = { mode: 'tag', value: 'form-builder' },
  isRefresh = false
): Promise<void> {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery.value) return;

  // Guard against duplicate matching submissions while a matching request is active
  if (
    appState.status === 'loading' &&
    appState.activeQuery.mode === normalizedQuery.mode &&
    appState.activeQuery.value.toLowerCase() === normalizedQuery.value.toLowerCase() &&
    !isRefresh
  ) {
    return;
  }

  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  isLoadingAllRemaining = false;

  beginLoading(normalizedQuery, isRefresh);

  // Sync inputs with the query
  const searchModeSelect = document.getElementById('search-mode-select') as HTMLSelectElement | null;
  const filterInput = document.getElementById('filter-input') as HTMLInputElement | null;
  const filterClear = document.getElementById('filter-clear') as HTMLButtonElement | null;

  if (searchModeSelect) {
    searchModeSelect.value = normalizedQuery.mode;
  }

  // Reset client filter when server query changes (Requirement 7)
  if (filterInput) {
    filterInput.value = '';
  }
  if (filterClear) {
    filterClear.hidden = true;
  }

  setActiveChip(normalizedQuery.mode === 'tag' ? normalizedQuery.value : null);
  renderApp();

  try {
    const collection = await fetchPluginCollection(normalizedQuery, 1, request.signal);
    if (request !== activeRequest) return;
    finishLoading(collection);
    renderApp();
  } catch (error) {
    if (request.signal.aborted || request !== activeRequest) return;
    console.error(error);
    failLoading(error, normalizedQuery);
    renderApp();
  } finally {
    if (request === activeRequest) {
      activeRequest = null;
      updateBusyState(false);
    }
  }
}

async function loadPluginPage(page: number, shouldFocus = true): Promise<boolean> {
  // Slug mode bypasses pagination (Requirement 6)
  if (appState.activeQuery.mode === 'slug') {
    return false;
  }

  if (appState.loadingMorePage !== null || appState.loadedPages.includes(page)) {
    return false;
  }

  const queryAtStart = { ...appState.activeQuery };

  beginLoadingPage(page);
  renderApp();

  try {
    const collection = await fetchPluginCollection(queryAtStart, page);
    // Ignore response if user switched queries in the meantime (Requirement 7 / 9)
    if (
      appState.activeQuery.mode !== queryAtStart.mode ||
      appState.activeQuery.value !== queryAtStart.value
    ) {
      return false;
    }
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
    if (
      appState.activeQuery.mode !== queryAtStart.mode ||
      appState.activeQuery.value !== queryAtStart.value
    ) {
      return false;
    }
    console.error(`Error loading page ${page}:`, error);
    failLoadingPage(page, error);
    renderApp();

    const retryBtn = document.getElementById('btn-retry-page');
    retryBtn?.focus();
    return false;
  }
}

async function loadAllRemainingPages(): Promise<void> {
  if (isLoadingAllRemaining || appState.loadingMorePage !== null || appState.activeQuery.mode === 'slug') return;
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
    chip.classList.toggle(
      'chip--active',
      appState.activeQuery.mode === 'tag' && chip.dataset.tag?.toLowerCase() === activeTag?.toLowerCase()
    );
  });
}

function initControls(): void {
  const searchInput = (document.getElementById('search-input') || document.getElementById('tag-input')) as HTMLInputElement | null;
  const searchSubmit = (document.getElementById('search-submit') || document.getElementById('tag-submit')) as HTMLButtonElement | null;
  const searchModeSelect = document.getElementById('search-mode-select') as HTMLSelectElement | null;
  const filterInput = document.getElementById('filter-input') as HTMLInputElement | null;
  const filterClear = document.getElementById('filter-clear') as HTMLButtonElement | null;
  const pluginsTable = document.getElementById('plugins-table');

  const updateSearchPlaceholder = (mode: QueryMode): void => {
    if (!searchInput) return;
    if (mode === 'slug') {
      searchInput.placeholder = 'Search by plugin slug (e.g. contact-form-7)…';
    } else if (mode === 'search') {
      searchInput.placeholder = 'Search WordPress.org by keyword…';
    } else {
      searchInput.placeholder = 'Search WordPress.org by tag…';
    }
  };

  searchModeSelect?.addEventListener('change', () => {
    const mode = (searchModeSelect.value as QueryMode) || 'tag';
    updateSearchPlaceholder(mode);
  });

  const submitSearch = (): void => {
    const val = searchInput?.value.trim();
    if (!val) return;
    const mode = (searchModeSelect?.value as QueryMode) || 'tag';
    const query: PluginQuery = { mode, value: val };

    if (
      appState.status === 'loading' &&
      appState.activeQuery.mode === query.mode &&
      appState.activeQuery.value.toLowerCase() === query.value.toLowerCase()
    ) {
      return;
    }

    void loadPlugins(query);
  };

  // Tag Chips (Requirement 5: Tag chips always submit { mode: 'tag', value: chipTag })
  document.getElementById('tag-chips')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest<HTMLButtonElement>('.chip');
    if (!chip?.dataset.tag) return;
    const tag = chip.dataset.tag;
    const query: PluginQuery = { mode: 'tag', value: tag };
    if (
      appState.status === 'loading' &&
      appState.activeQuery.mode === 'tag' &&
      appState.activeQuery.value.toLowerCase() === tag.toLowerCase()
    ) {
      return;
    }
    if (searchModeSelect) searchModeSelect.value = 'tag';
    if (searchInput) searchInput.value = '';
    void loadPlugins(query);
  });

  // Server Search Input & Submit
  searchSubmit?.addEventListener('click', submitSearch);
  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitSearch();
  });

  // Retry event
  document.addEventListener('retry-plugin-request', () => {
    void loadPlugins(appState.failedQuery || appState.activeQuery, false);
  });

  // Client-Side Search Filter Input (Requirement 3: "Filter loaded results")
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

    if (searchModeSelect) searchModeSelect.value = 'tag';
    if (searchInput) searchInput.value = '';
    void loadPlugins({ mode: 'tag', value: tag });
  });

  // Comparison Selection Events
  document.addEventListener('select-subject', (event) => {
    const customEvent = event as CustomEvent<{ slug: string | null; name?: string }>;
    const slug = customEvent.detail?.slug ?? null;
    const name = customEvent.detail?.name || (slug ? slug : 'Plugin');

    setComparisonSubject(slug);
    if (slug) {
      announceComparisonStatus(`${name} set as My Plugin.`);
    } else {
      announceComparisonStatus('My Plugin deselected.');
    }
    renderApp();
  });

  document.addEventListener('toggle-competitor', (event) => {
    const customEvent = event as CustomEvent<{ slug: string; name?: string }>;
    const slug = customEvent.detail?.slug;
    if (!slug) return;
    const name = customEvent.detail?.name || slug;

    if (appState.comparison.subjectSlug === slug) {
      announceComparisonStatus('Subject plugin cannot also be added as a competitor.');
      return;
    }

    const isCurrentlyCompetitor = appState.comparison.competitorSlugs.includes(slug);
    if (!isCurrentlyCompetitor && appState.comparison.competitorSlugs.length >= 3) {
      announceComparisonStatus('Cannot add more than 3 competitors to comparison.');
      return;
    }

    const success = toggleCompetitor(slug);
    if (success) {
      if (isCurrentlyCompetitor) {
        announceComparisonStatus(
          `${name} removed from comparison (${appState.comparison.competitorSlugs.length} of 3 competitors).`
        );
      } else {
        announceComparisonStatus(
          `${name} added to comparison (${appState.comparison.competitorSlugs.length} of 3 competitors).`
        );
      }
      renderApp();
    }
  });

  document.addEventListener('remove-competitor', (event) => {
    const customEvent = event as CustomEvent<{ slug: string; name?: string }>;
    const slug = customEvent.detail?.slug;
    if (!slug) return;
    const name = customEvent.detail?.name || slug;

    removeCompetitor(slug);
    announceComparisonStatus(
      `${name} removed from comparison (${appState.comparison.competitorSlugs.length} of 3 competitors).`
    );
    renderApp();
  });

  document.addEventListener('clear-comparison', () => {
    clearComparison();
    if (isComparisonOpen) {
      handleCloseComparison();
    }
    announceComparisonStatus('All comparison selections cleared.');
    renderApp();
  });

  document.addEventListener('open-comparison', () => {
    void handleOpenComparison();
  });

  document.addEventListener('close-comparison', () => {
    handleCloseComparison();
  });

  // Global Escape key listener to close comparison workspace if open
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isComparisonOpen) {
      handleCloseComparison();
    }
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

function handleCloseComparison(): void {
  isComparisonOpen = false;
  closeComparisonSection();
  renderApp();
  announceComparisonStatus('Comparison workspace closed.');
}

async function handleOpenComparison(): Promise<void> {
  const { subjectSlug, competitorSlugs } = appState.comparison;
  if (!subjectSlug || competitorSlugs.length === 0) return;

  const allSlugs = [subjectSlug, ...competitorSlugs];
  const missingSlugs = allSlugs.filter(
    (slug) => !appState.plugins.some((p) => p.slug === slug)
  );

  if (missingSlugs.length > 0) {
    announceComparisonStatus(
      `Fetching ${missingSlugs.length} missing plugin record${missingSlugs.length > 1 ? 's' : ''} before comparison opens…`
    );
    const compareBtn = document.getElementById('btn-tray-compare') as HTMLButtonElement | null;
    if (compareBtn) {
      compareBtn.disabled = true;
      compareBtn.textContent = 'Loading…';
    }

    try {
      const results = await Promise.allSettled(
        missingSlugs.map((slug) => fetchPluginBySlug(slug))
      );
      const fetchedPlugins: NormalizedPlugin[] = [];
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value) {
          fetchedPlugins.push(res.value);
        }
      }

      if (fetchedPlugins.length > 0) {
        appState.plugins = mergePluginCollections(appState.plugins, fetchedPlugins);
      }
    } catch (err) {
      console.error('Error fetching missing plugins for comparison:', err);
    }
  }

  const loadedCount = appState.plugins.filter((p) => allSlugs.includes(p.slug)).length;
  announceComparisonStatus(
    `Comparison ready with ${loadedCount} of ${allSlugs.length} plugins.`
  );

  isComparisonOpen = true;
  renderApp();

  const comparisonSection = document.getElementById('comparison-section');
  if (comparisonSection) {
    comparisonSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Focus comparison heading for keyboard users
  const heading = document.getElementById('comparison-heading');
  heading?.focus({ preventScroll: true });

  document.dispatchEvent(
    new CustomEvent('comparison-ready', {
      detail: {
        subjectSlug,
        competitorSlugs,
        plugins: appState.plugins.filter((p) => allSlugs.includes(p.slug)),
      },
    })
  );
}

initTheme();
refreshIcons();
initControls();
void loadPlugins();


