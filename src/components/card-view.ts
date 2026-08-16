import type { AppError, AppState, PluginQuery } from '../domain/plugin-types';
import { selectVisiblePlugins } from '../domain/plugin-selectors';
import { createPluginCard } from './plugin-card';
import { updateResultsMeta } from '../utils/results-meta';

function formatQueryPhrase(query: PluginQuery | string): { phrase: string; target: string; ariaLabel: string } {
  if (typeof query === 'string') {
    return {
      phrase: `tag “${query}”`,
      target: `plugins for tag “${query}”`,
      ariaLabel: `plugins for tag ${query}`,
    };
  }
  if (query.mode === 'slug') {
    return {
      phrase: `slug “${query.value}”`,
      target: `plugin with slug “${query.value}”`,
      ariaLabel: `plugin for slug ${query.value}`,
    };
  }
  if (query.mode === 'search') {
    return {
      phrase: `keyword “${query.value}”`,
      target: `plugins for keyword “${query.value}”`,
      ariaLabel: `plugins for keyword ${query.value}`,
    };
  }
  return {
    phrase: `tag “${query.value}”`,
    target: `plugins for tag “${query.value}”`,
    ariaLabel: `plugins for tag ${query.value}`,
  };
}

function createCardSkeletons(count = 6): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const card = document.createElement('article');
    card.className = 'plugin-card plugin-card--skeleton';
    card.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.className = 'plugin-card__skeleton-header';
    const icon = document.createElement('div');
    icon.className = 'plugin-card__skeleton-icon';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'plugin-card__skeleton-title-wrap';
    const title = document.createElement('div');
    title.className = 'plugin-card__skeleton-title';
    const author = document.createElement('div');
    author.className = 'plugin-card__skeleton-author';
    titleWrap.append(title, author);
    header.append(icon, titleWrap);

    const desc = document.createElement('div');
    desc.className = 'plugin-card__skeleton-desc';

    const metrics = document.createElement('div');
    metrics.className = 'plugin-card__skeleton-metrics';
    for (let m = 0; m < 4; m++) {
      const box = document.createElement('div');
      box.className = 'plugin-card__skeleton-metric-box';
      metrics.append(box);
    }

    card.append(header, desc, metrics);
    frag.append(card);
  }
  return frag;
}

function createCardStatusState(
  className: string,
  content: HTMLElement | string,
  role = 'status'
): HTMLElement {
  const container = document.createElement('div');
  container.className = `card-status-container ${className}`;
  container.setAttribute('role', role);
  container.setAttribute('aria-live', 'polite');

  if (typeof content === 'string') {
    const p = document.createElement('p');
    p.className = 'card-status-message';
    p.textContent = content;
    container.append(p);
  } else {
    container.append(content);
  }

  return container;
}

export function createCardLoadingState(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cards-grid';
  wrap.append(createCardSkeletons(6));
  return wrap;
}

export function createCardErrorState(
  error: AppError | null,
  query: PluginQuery | string,
  onRetry: () => void
): HTMLElement {
  const { target, ariaLabel } = formatQueryPhrase(query);
  const wrap = document.createElement('div');
  wrap.className = 'card-status-box card-status-box--error';

  const icon = document.createElement('div');
  icon.className = 'card-status-icon';
  icon.textContent = error?.kind === 'network' ? '⚡' : '⚠';
  icon.setAttribute('aria-hidden', 'true');

  const heading = document.createElement('h3');
  heading.className = 'card-status-title';
  if (error?.kind === 'network') {
    heading.textContent = 'Network Connection Error';
  } else if (error?.kind === 'invalid_response') {
    heading.textContent = 'Invalid API Response';
  } else if (error?.kind === 'http') {
    heading.textContent = error.statusCode ? `Server Error (HTTP ${error.statusCode})` : 'Server Error';
  } else {
    heading.textContent = 'Failed to Load Plugins';
  }

  const text = document.createElement('p');
  text.className = 'card-status-message';
  text.textContent = error?.message || `Unable to load ${target}. Please try again.`;

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'btn-retry-tag';
  retryBtn.id = 'btn-retry-cards';
  retryBtn.setAttribute('aria-label', `Retry loading ${ariaLabel}`);
  retryBtn.textContent = 'Retry Request';
  retryBtn.addEventListener('click', onRetry);

  wrap.append(icon, heading, text, retryBtn);
  return createCardStatusState('card-status--error', wrap, 'alert');
}

export function createCardEmptyRow(query: PluginQuery | string): HTMLElement {
  const { phrase } = formatQueryPhrase(query);
  const wrap = document.createElement('div');
  wrap.className = 'card-status-box card-status-box--empty';

  const icon = document.createElement('div');
  icon.className = 'card-status-icon';
  icon.textContent = '📂';
  icon.setAttribute('aria-hidden', 'true');

  const heading = document.createElement('h3');
  heading.className = 'card-status-title';
  heading.textContent = 'No Plugins Found';

  const text = document.createElement('p');
  text.className = 'card-status-message';
  text.textContent = `No plugins found in the WordPress.org directory for ${phrase}.`;

  wrap.append(icon, heading, text);
  return createCardStatusState('card-status--empty-tag', wrap);
}

export const createCardEmptyTagState = createCardEmptyRow;

export function createCardNoMatchesState(query: string, onClear: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'card-status-box card-status-box--no-matches';

  const icon = document.createElement('div');
  icon.className = 'card-status-icon';
  icon.textContent = '🔍';
  icon.setAttribute('aria-hidden', 'true');

  const heading = document.createElement('h3');
  heading.className = 'card-status-title';
  heading.textContent = 'No Matching Plugins';

  const text = document.createElement('p');
  text.className = 'card-status-message';
  text.textContent = `No loaded plugins matched your filter “${query}”.`;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn-clear-filter';
  clearBtn.textContent = 'Clear Filter';
  clearBtn.addEventListener('click', onClear);

  wrap.append(icon, heading, text, clearBtn);
  return createCardStatusState('card-status--no-matches', wrap);
}

export function renderCardView(
  state: AppState,
  onClearFilter?: () => void,
  onRetry?: () => void
): void {
  const container = document.getElementById('plugins-cards');
  const cardsWrapper = document.getElementById('cards-view-wrapper');
  if (!(container instanceof HTMLElement)) {
    throw new Error('Plugins card container (#plugins-cards) was not found.');
  }

  // Background refresh: preserve existing rendered cards but mark wrapper as stale
  if (state.status === 'loading' && state.isBackgroundRefreshing && state.plugins.length > 0) {
    cardsWrapper?.classList.add('is-stale');
    const visiblePlugins = selectVisiblePlugins(state);
    container.replaceChildren(...visiblePlugins.map(createPluginCard));
    updateResultsMeta(state, visiblePlugins.length);
    return;
  }

  cardsWrapper?.classList.remove('is-stale');

  // Fresh loading: show layout-matched skeleton cards
  if (state.status === 'loading') {
    container.replaceChildren(createCardLoadingState());
    updateResultsMeta(state, 0);
    return;
  }

  // Error state: show error state with retry button
  if (state.status === 'error') {
    container.replaceChildren(
      createCardErrorState(
        state.error,
        state.failedQuery || state.activeQuery,
        onRetry ?? (() => document.dispatchEvent(new CustomEvent('retry-plugin-request')))
      )
    );
    updateResultsMeta(state, 0);
    return;
  }

  // Ready state: check if zero plugins loaded
  if (state.plugins.length === 0) {
    container.replaceChildren(createCardEmptyRow(state.activeQuery));
    updateResultsMeta(state, 0);
    return;
  }

  const visiblePlugins = selectVisiblePlugins(state);

  // Ready state: check if filter returned zero matches
  if (visiblePlugins.length === 0) {
    container.replaceChildren(
      createCardNoMatchesState(state.query, () => {
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

  // Render cards grid
  container.replaceChildren(...visiblePlugins.map(createPluginCard));
  updateResultsMeta(state, visiblePlugins.length);
}

