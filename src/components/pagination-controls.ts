import type { AppState } from '../domain/plugin-types';

export interface PaginationCallbacks {
  onLoadPage: (page: number) => void;
  onLoadAllRemaining: () => void;
  onRetryPage: (page: number) => void;
}

/**
 * Returns the next unloaded page number between 1 and totalPages,
 * or null if all pages have been loaded.
 */
export function getNextUnloadedPage(loadedPages: number[], totalPages: number): number | null {
  for (let page = 1; page <= totalPages; page++) {
    if (!loadedPages.includes(page)) {
      return page;
    }
  }
  return null;
}

/**
 * Renders the accessible pagination and load-more controls section.
 */
export function renderPaginationControls(
  state: AppState,
  callbacks?: PaginationCallbacks
): void {
  const container = document.getElementById('pagination-controls');
  if (!container) return;

  // Only show pagination when collection is ready with plugins
  if (state.status !== 'ready' || state.plugins.length === 0) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  container.hidden = false;

  const totalPages = state.totalPages;
  const loadedPagesCount = state.loadedPages.length;
  const isFullyLoaded = loadedPagesCount >= totalPages || state.plugins.length >= state.totalResults;
  const nextUnloadedPage = getNextUnloadedPage(state.loadedPages, totalPages);
  const remainingPagesCount = totalPages - loadedPagesCount;
  const isLoading = state.loadingMorePage !== null;

  const wrapper = document.createElement('div');
  wrapper.className = 'pagination-inner';

  // Status banner / description
  const statusEl = document.createElement('div');
  statusEl.className = 'pagination-status';
  statusEl.setAttribute('aria-live', 'polite');

  if (isFullyLoaded) {
    statusEl.innerHTML = `
      <span class="pagination-status__icon" aria-hidden="true">✓</span>
      <span class="pagination-status__text">All <strong>${state.totalResults}</strong> plugins loaded across <strong>${totalPages} ${totalPages === 1 ? 'page' : 'pages'}</strong>.</span>
    `;
  } else {
    statusEl.innerHTML = `
      <span class="pagination-status__text">Loaded <strong>${state.plugins.length}</strong> of <strong>${state.totalResults}</strong> plugins (${loadedPagesCount} of ${totalPages} pages).</span>
    `;
  }
  wrapper.append(statusEl);

  // Partial failure alert (does not discard loaded pages)
  if (state.loadMoreError) {
    const errorBox = document.createElement('div');
    errorBox.className = 'pagination-error';
    errorBox.setAttribute('role', 'alert');

    const errorMsg = document.createElement('p');
    errorMsg.className = 'pagination-error__message';
    errorMsg.textContent = `Page ${state.loadMoreError.page} failed: ${state.loadMoreError.message}`;

    const retryBtn = document.createElement('button');
    retryBtn.id = 'btn-retry-page';
    retryBtn.className = 'pagination-btn pagination-btn--retry';
    retryBtn.type = 'button';
    retryBtn.textContent = `Retry Page ${state.loadMoreError.page}`;
    retryBtn.setAttribute(
      'aria-label',
      `Retry loading page ${state.loadMoreError.page} for tag "${state.activeTag}"`
    );

    const failedPage = state.loadMoreError.page;
    retryBtn.addEventListener('click', () => {
      if (callbacks?.onRetryPage) {
        callbacks.onRetryPage(failedPage);
      } else {
        document.dispatchEvent(
          new CustomEvent('load-plugin-page', { detail: { page: failedPage } })
        );
      }
    });

    errorBox.append(errorMsg, retryBtn);
    wrapper.append(errorBox);
  }

  // Action buttons
  if (!isFullyLoaded && nextUnloadedPage !== null) {
    const actions = document.createElement('div');
    actions.className = 'pagination-actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Load additional plugin pages');

    // "Load Next Page" button
    const loadNextBtn = document.createElement('button');
    loadNextBtn.id = 'btn-load-more';
    loadNextBtn.className = 'pagination-btn pagination-btn--primary';
    loadNextBtn.type = 'button';
    loadNextBtn.disabled = isLoading;
    loadNextBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');

    if (isLoading && state.loadingMorePage === nextUnloadedPage) {
      loadNextBtn.innerHTML = `
        <span class="pagination-spinner" aria-hidden="true"></span>
        <span>Loading Page ${nextUnloadedPage} of ${totalPages}…</span>
      `;
      loadNextBtn.setAttribute('aria-label', `Loading page ${nextUnloadedPage} of ${totalPages}`);
    } else {
      loadNextBtn.textContent = `Load Page ${nextUnloadedPage} of ${totalPages}`;
      loadNextBtn.setAttribute(
        'aria-label',
        `Load page ${nextUnloadedPage} of ${totalPages} (adds up to 100 plugins)`
      );
    }

    loadNextBtn.addEventListener('click', () => {
      if (isLoading) return;
      if (callbacks?.onLoadPage) {
        callbacks.onLoadPage(nextUnloadedPage);
      } else {
        document.dispatchEvent(
          new CustomEvent('load-plugin-page', { detail: { page: nextUnloadedPage } })
        );
      }
    });

    actions.append(loadNextBtn);

    // "Load All Remaining Pages" button if multiple pages remain
    if (remainingPagesCount > 1) {
      const loadAllBtn = document.createElement('button');
      loadAllBtn.id = 'btn-load-all';
      loadAllBtn.className = 'pagination-btn pagination-btn--secondary';
      loadAllBtn.type = 'button';
      loadAllBtn.disabled = isLoading;
      loadAllBtn.textContent = `Load All Remaining Pages (${remainingPagesCount} pages)`;
      loadAllBtn.setAttribute(
        'aria-label',
        `Load all ${remainingPagesCount} remaining pages for tag "${state.activeTag}"`
      );

      loadAllBtn.addEventListener('click', () => {
        if (isLoading) return;
        if (callbacks?.onLoadAllRemaining) {
          callbacks.onLoadAllRemaining();
        } else {
          document.dispatchEvent(new CustomEvent('load-all-plugin-pages'));
        }
      });

      actions.append(loadAllBtn);
    }

    wrapper.append(actions);
  }

  container.replaceChildren(wrapper);
}
