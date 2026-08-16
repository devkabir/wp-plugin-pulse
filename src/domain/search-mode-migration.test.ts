import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  appState,
  beginLoading,
  finishLoading,
  failLoading,
  normalizeQuery,
} from '../state/app-state';
import { formatResultsMeta } from '../utils/results-meta';
import { renderPaginationControls } from '../components/pagination-controls';
import { createTableErrorRow, createTableEmptyRow } from '../components/table-status-row';
import { createCardErrorState, createCardEmptyRow } from '../components/card-view';
import type { NormalizedPlugin } from './plugin-types';

class MockDOMNode {
  tagName: string;
  className = '';
  attributes = new Map<string, string>();
  children: MockDOMNode[] = [];
  textContent = '';
  type = '';
  id = '';
  colSpan = 1;
  hidden = false;
  listeners = new Map<string, Array<() => void>>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get childElementCount(): number {
    return this.children.length;
  }

  get classList() {
    return {
      contains: (cls: string) => this.className.split(/\s+/).includes(cls),
      add: (cls: string) => {
        if (!this.classList.contains(cls)) {
          this.className = `${this.className} ${cls}`.trim();
        }
      },
      remove: (cls: string) => {
        this.className = this.className
          .split(/\s+/)
          .filter((c) => c !== cls)
          .join(' ');
      },
    };
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name.toLowerCase() === 'colspan') {
      this.colSpan = parseInt(value, 10) || 1;
    }
  }

  getAttribute(name: string): string | null {
    if (name.toLowerCase() === 'colspan') {
      return String(this.colSpan);
    }
    return this.attributes.get(name) ?? null;
  }

  append(...items: Array<MockDOMNode | string>): void {
    for (const item of items) {
      if (item instanceof MockDOMNode) {
        if (item.tagName === '#FRAGMENT') {
          this.children.push(...item.children);
        } else {
          this.children.push(item);
        }
      } else if (typeof item === 'string') {
        const textNode = new MockDOMNode('#text');
        textNode.textContent = item;
        this.children.push(textNode);
      }
    }
  }

  replaceChildren(...items: Array<MockDOMNode | string>): void {
    this.children = [];
    this.append(...items);
  }

  addEventListener(event: string, handler: () => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  click(): void {
    const handlers = this.listeners.get('click') ?? [];
    for (const handler of handlers) handler();
  }

  querySelector(selector: string): MockDOMNode | null {
    const isClass = selector.startsWith('.');
    const isId = selector.startsWith('#');
    const isTag = /^[a-zA-Z]+$/.test(selector);

    for (const child of this.children) {
      if (isClass && child.classList.contains(selector.slice(1))) return child;
      if (isId && child.id === selector.slice(1)) return child;
      if (isTag && child.tagName.toLowerCase() === selector.toLowerCase()) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(selector: string): MockDOMNode[] {
    const results: MockDOMNode[] = [];
    const isClass = selector.startsWith('.');
    const isId = selector.startsWith('#');
    const isTag = /^[a-zA-Z]+$/.test(selector);

    for (const child of this.children) {
      if (isClass && child.classList.contains(selector.slice(1))) results.push(child);
      if (isId && child.id === selector.slice(1)) results.push(child);
      if (isTag && child.tagName.toLowerCase() === selector.toLowerCase()) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }
}

function setupMockDOM(): void {
  const rootElements = new Map<string, MockDOMNode>();
  (globalThis as any).document = {
    createElement: (tag: string) => new MockDOMNode(tag),
    createDocumentFragment: () => new MockDOMNode('#fragment'),
    getElementById: (id: string) => rootElements.get(id) ?? null,
    _registerElement: (id: string, el: MockDOMNode) => rootElements.set(id, el),
  };
}

function createMockPlugin(overrides: Partial<NormalizedPlugin> = {}): NormalizedPlugin {
  return {
    name: 'Form Craft',
    slug: 'form-craft',
    version: '1.0.0',
    authorName: 'Developer',
    authorProfileUrl: null,
    homepageUrl: null,
    pluginUrl: 'https://wordpress.org/plugins/form-craft/',
    downloadUrl: null,
    iconUrl: null,
    shortDescription: 'Modern forms',
    tags: ['forms', 'builder'],
    activeInstalls: 50000,
    activeInstallsDisplay: '50,000+',
    lifetimeDownloads: 100000,
    lifetimeDownloadsDisplay: '100,000',
    lifetimeInstallPace: 50,
    lifetimeInstallPaceDisplay: '50/day',
    daysSinceAdded: 1000,
    ratingPercent: 90,
    ratingScore: 4.5,
    ratingScoreDisplay: '4.5',
    ratingCount: 120,
    ratingDistribution: { 1: 2, 2: 3, 3: 5, 4: 20, 5: 90 },
    supportThreads: 20,
    supportThreadsResolved: 18,
    supportResolutionRate: 90,
    addedAt: '2020-01-01',
    lastUpdatedAt: '2024-01-01',
    lastUpdatedRelative: '1 month ago',
    freshness: 'fresh',
    requiresWordPress: '5.0',
    testedWordPress: '6.5',
    requiresPhp: '7.4',
    requiredPlugins: [],
    ...overrides,
  };
}

describe('PR 3 — Search Mode State and Query Normalization', () => {
  beforeEach(() => {
    beginLoading({ mode: 'tag', value: 'form-builder' });
  });

  it('normalizes string queries to tag mode by default', () => {
    expect(normalizeQuery('seo')).toEqual({ mode: 'tag', value: 'seo' });
    expect(normalizeQuery('  woocommerce  ')).toEqual({ mode: 'tag', value: 'woocommerce' });
  });

  it('normalizes PluginQuery objects correctly trimming whitespace', () => {
    expect(normalizeQuery({ mode: 'search', value: ' contact form ' })).toEqual({
      mode: 'search',
      value: 'contact form',
    });
    expect(normalizeQuery({ mode: 'slug', value: ' akismet ' })).toEqual({
      mode: 'slug',
      value: 'akismet',
    });
  });

  it('resets loaded pages, pagination, and client filter when a new query begins', () => {
    appState.query = 'my-client-filter';
    appState.plugins = [createMockPlugin()];
    appState.loadedPages = [1, 2];
    appState.page = 2;
    appState.totalPages = 5;
    appState.totalResults = 500;

    beginLoading({ mode: 'search', value: 'stripe' });

    expect(appState.activeQuery).toEqual({ mode: 'search', value: 'stripe' });
    expect(appState.query).toBe('');
    expect(appState.plugins.length).toBe(0);
    expect(appState.loadedPages.length).toBe(0);
    expect(appState.page).toBe(1);
    expect(appState.totalPages).toBe(1);
    expect(appState.totalResults).toBe(0);
    expect(appState.status).toBe('loading');
  });

  it('preserves background refresh state when refreshing the same query mode and value', () => {
    finishLoading({
      plugins: [createMockPlugin()],
      page: 1,
      totalPages: 1,
      totalResults: 1,
    });

    beginLoading({ mode: 'tag', value: 'form-builder' }, true);
    expect(appState.status).toBe('loading');
    expect(appState.isBackgroundRefreshing).toBe(true);
    expect(appState.plugins.length).toBe(1);
  });

  it('tracks exact failedQuery on failure and clears on finishLoading', () => {
    failLoading(new Error('Slug not found'), { mode: 'slug', value: 'invalid-slug' });

    expect(appState.status).toBe('error');
    expect(appState.failedQuery).toEqual({ mode: 'slug', value: 'invalid-slug' });

    finishLoading({
      plugins: [createMockPlugin({ slug: 'valid-plugin' })],
      page: 1,
      totalPages: 1,
      totalResults: 1,
    });

    expect(appState.status).toBe('ready');
    expect(appState.failedQuery).toBeNull();
  });
});

describe('PR 3 — Results Meta Copy Across Query Modes', () => {
  it('formats loading messages for tag, search, and slug modes', () => {
    appState.status = 'loading';
    appState.isBackgroundRefreshing = false;

    appState.activeQuery = { mode: 'tag', value: 'security' };
    expect(formatResultsMeta(appState, 0)).toBe('Loading plugins tagged "security"…');

    appState.activeQuery = { mode: 'search', value: 'forms' };
    expect(formatResultsMeta(appState, 0)).toBe('Loading plugins matching keyword "forms"…');

    appState.activeQuery = { mode: 'slug', value: 'akismet' };
    expect(formatResultsMeta(appState, 0)).toBe('Loading plugin with slug "akismet"…');
  });

  it('formats background refresh messages for all modes', () => {
    appState.status = 'loading';
    appState.isBackgroundRefreshing = true;

    appState.activeQuery = { mode: 'tag', value: 'security' };
    expect(formatResultsMeta(appState, 0)).toBe('Updating plugins tagged "security"…');

    appState.activeQuery = { mode: 'search', value: 'forms' };
    expect(formatResultsMeta(appState, 0)).toBe('Updating plugins matching keyword "forms"…');

    appState.activeQuery = { mode: 'slug', value: 'akismet' };
    expect(formatResultsMeta(appState, 0)).toBe('Updating plugin with slug "akismet"…');
  });

  it('formats error messages including mode and query', () => {
    appState.status = 'error';
    appState.error = { kind: 'not_found', message: 'The requested plugin could not be found.' };

    appState.activeQuery = { mode: 'slug', value: 'missing-plugin' };
    appState.failedQuery = { mode: 'slug', value: 'missing-plugin' };
    expect(formatResultsMeta(appState, 0)).toBe(
      'Failed to load plugin for slug "missing-plugin": The requested plugin could not be found.'
    );

    appState.activeQuery = { mode: 'search', value: 'xyz123' };
    appState.failedQuery = { mode: 'search', value: 'xyz123' };
    appState.error = { kind: 'network', message: 'Network offline.' };
    expect(formatResultsMeta(appState, 0)).toBe(
      'Failed to load plugins for keyword "xyz123": Network offline.'
    );
  });

  it('formats empty directory messages for all modes', () => {
    appState.status = 'ready';
    appState.plugins = [];

    appState.activeQuery = { mode: 'tag', value: 'empty-tag' };
    expect(formatResultsMeta(appState, 0)).toBe('No plugins found for tag "empty-tag".');

    appState.activeQuery = { mode: 'search', value: 'empty-search' };
    expect(formatResultsMeta(appState, 0)).toBe('No plugins found for keyword "empty-search".');

    appState.activeQuery = { mode: 'slug', value: 'empty-slug' };
    expect(formatResultsMeta(appState, 0)).toBe('No plugin found for slug "empty-slug".');
  });

  it('formats single plugin display for slug mode', () => {
    appState.status = 'ready';
    appState.activeQuery = { mode: 'slug', value: 'contact-form-7' };
    appState.plugins = [createMockPlugin({ slug: 'contact-form-7' })];
    appState.query = '';
    appState.totalResults = 1;
    appState.totalPages = 1;

    expect(formatResultsMeta(appState, 1)).toBe('Showing plugin with slug "contact-form-7"');
  });
});

describe('PR 3 — Pagination Controls and Slug Mode Bypassing', () => {
  let origDoc: any;
  let container: any;

  beforeEach(() => {
    origDoc = (globalThis as any).document;
    setupMockDOM();
    container = (globalThis as any).document.createElement('section');
    container.id = 'pagination-controls';
    (globalThis as any).document._registerElement('pagination-controls', container);
  });

  afterEach(() => {
    (globalThis as any).document = origDoc;
  });

  it('hides and bypasses pagination in slug mode', () => {
    appState.status = 'ready';
    appState.activeQuery = { mode: 'slug', value: 'contact-form-7' };
    appState.plugins = [createMockPlugin({ slug: 'contact-form-7' })];
    appState.totalPages = 1;
    appState.totalResults = 1;
    appState.loadedPages = [1];

    renderPaginationControls(appState);
    expect(container.hidden).toBe(true);
    expect(container.children.length).toBe(0);
  });

  it('renders pagination controls for tag and search multi-page results', () => {
    appState.status = 'ready';
    appState.activeQuery = { mode: 'search', value: 'forms' };
    appState.plugins = [createMockPlugin()];
    appState.totalPages = 3;
    appState.totalResults = 300;
    appState.loadedPages = [1];
    appState.loadingMorePage = null;
    appState.loadMoreError = null;

    renderPaginationControls(appState);
    expect(container.hidden).toBe(false);
    expect(container.querySelector('#btn-load-more')).not.toBeNull();
    expect(container.querySelector('#btn-load-all')).not.toBeNull();
  });
});

describe('PR 3 — Status Row and Card View Error/Empty State Details', () => {
  let origDoc: any;

  beforeEach(() => {
    origDoc = (globalThis as any).document;
    setupMockDOM();
  });

  afterEach(() => {
    (globalThis as any).document = origDoc;
  });

  it('creates table error row with query mode and operable retry', () => {
    let retried = false;
    const row = createTableErrorRow(
      { kind: 'http', message: '500 Internal Error' },
      { mode: 'search', value: 'payments' },
      () => {
        retried = true;
      }
    );

    expect(row.querySelector('.table-status-message')?.textContent).toContain('500 Internal Error');
    const retryBtn = row.querySelector<HTMLButtonElement>('#btn-retry-table');
    expect(retryBtn?.getAttribute('aria-label')).toBe('Retry loading plugins for keyword payments');
    retryBtn?.click();
    expect(retried).toBe(true);
  });

  it('creates table empty row for slug mode', () => {
    const row = createTableEmptyRow({ mode: 'slug', value: 'nonexistent-plugin' });
    expect(row.querySelector('.table-status-message')?.textContent).toBe(
      'No plugins found in the WordPress.org directory for slug “nonexistent-plugin”.'
    );
  });

  it('creates card error state with query mode and operable retry', () => {
    let retried = false;
    const card = createCardErrorState(
      null,
      { mode: 'slug', value: 'broken-slug' },
      () => {
        retried = true;
      }
    );

    expect(card.querySelector('.card-status-message')?.textContent).toBe(
      'Unable to load plugin with slug “broken-slug”. Please try again.'
    );
    const retryBtn = card.querySelector<HTMLButtonElement>('#btn-retry-cards');
    expect(retryBtn?.getAttribute('aria-label')).toBe('Retry loading plugin for slug broken-slug');
    retryBtn?.click();
    expect(retried).toBe(true);
  });

  it('creates card empty state for search mode', () => {
    const card = createCardEmptyRow({ mode: 'search', value: 'obscure-term' });
    expect(card.querySelector('.card-status-message')?.textContent).toBe(
      'No plugins found in the WordPress.org directory for keyword “obscure-term”.'
    );
  });
});
