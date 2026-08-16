import type { AppState } from '../domain/plugin-types';
import { selectVisiblePlugins } from '../domain/plugin-selectors';
import { createPluginCard } from './plugin-card';
import { updateResultsMeta } from '../utils/results-meta';

function createCardSkeletons(): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 6; i++) {
    const card = document.createElement('article');
    card.className = 'plugin-card plugin-card--skeleton';
    card.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.className = 'plugin-card__skeleton-header';
    const icon = document.createElement('div');
    icon.className = 'plugin-card__skeleton-icon';
    const title = document.createElement('div');
    title.className = 'plugin-card__skeleton-title';
    header.append(icon, title);

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
  wrap.append(createCardSkeletons());
  return wrap;
}

export function createCardErrorState(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'card-status-box card-status-box--error';

  const icon = document.createElement('div');
  icon.className = 'card-status-icon';
  icon.textContent = '⚠';
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('p');
  text.className = 'card-status-message';
  text.textContent = 'Unable to load plugins. Please try again.';

  wrap.append(icon, text);
  return createCardStatusState('card-status--error', wrap, 'alert');
}

export function createCardEmptyTagState(tag: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'card-status-box card-status-box--empty';

  const text = document.createElement('p');
  text.className = 'card-status-message';
  text.textContent = `No plugins found in the WordPress.org directory for tag “${tag}”.`;

  wrap.append(text);
  return createCardStatusState('card-status--empty-tag', wrap);
}

export function createCardNoMatchesState(query: string, onClear: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'card-status-box card-status-box--no-matches';

  const text = document.createElement('p');
  text.className = 'card-status-message';
  text.textContent = `No plugins matching “${query}” found.`;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn-clear-filter';
  clearBtn.textContent = 'Clear filter';
  clearBtn.addEventListener('click', onClear);

  wrap.append(text, clearBtn);
  return createCardStatusState('card-status--no-matches', wrap);
}

export function renderCardView(state: AppState, onClearFilter?: () => void): void {
  const container = document.getElementById('plugins-cards');
  if (!(container instanceof HTMLElement)) {
    throw new Error('Plugins card container (#plugins-cards) was not found.');
  }

  if (state.status === 'loading') {
    container.replaceChildren(createCardLoadingState());
    updateResultsMeta(state, 0);
    return;
  }

  if (state.status === 'error') {
    container.replaceChildren(createCardErrorState());
    updateResultsMeta(state, 0);
    return;
  }

  // Ready state: check if zero plugins loaded
  if (state.plugins.length === 0) {
    container.replaceChildren(createCardEmptyTagState(state.activeTag));
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
