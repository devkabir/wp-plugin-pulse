import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { classifyError, PluginRequestError } from './error-classifier';
import {
  appState,
  beginLoading,
  failLoading,
  finishLoading,
} from '../state/app-state';
import {
  createTableEmptyTagRow,
  createTableErrorRow,
  createTableNoMatchesRow,
  createTableSkeletons,
} from '../components/table-status-row';
import { createCardErrorState, createCardLoadingState } from '../components/card-view';
import { formatResultsMeta } from '../utils/results-meta';
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
    const isTag = /^[a-zA-Z]+$/.test(selector);

    for (const child of this.children) {
      if (isClass && child.classList.contains(selector.slice(1))) return child;
      if (isTag && child.tagName.toLowerCase() === selector.toLowerCase()) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(selector: string): MockDOMNode[] {
    const results: MockDOMNode[] = [];
    const isClass = selector.startsWith('.');
    const isTag = /^[a-zA-Z]+$/.test(selector);

    for (const child of this.children) {
      if (isClass && child.classList.contains(selector.slice(1))) results.push(child);
      if (isTag && child.tagName.toLowerCase() === selector.toLowerCase()) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }
}

function setupMockDOM(): void {
  (globalThis as any).document = {
    createElement: (tag: string) => new MockDOMNode(tag),
    createDocumentFragment: () => new MockDOMNode('#fragment'),
  };
}


function createMockPlugin(overrides: Partial<NormalizedPlugin> = {}): NormalizedPlugin {
  return {
    name: 'Form Builder Pro',
    slug: 'form-builder-pro',
    version: '2.5.0',
    authorName: 'PluginDev',
    authorProfileUrl: 'https://profiles.wordpress.org/plugindev',
    homepageUrl: null,
    pluginUrl: 'https://wordpress.org/plugins/form-builder-pro/',
    downloadUrl: 'https://downloads.wordpress.org/plugin/form-builder-pro.2.5.0.zip',
    iconUrl: 'https://ps.w.org/form-builder-pro/assets/icon-128x128.png',
    shortDescription: 'Modern visual form builder for WordPress.',
    tags: ['forms', 'contact', 'builder'],
    activeInstalls: 50000,
    activeInstallsDisplay: '50,000+',
    lifetimeDownloads: 500000,
    lifetimeDownloadsDisplay: '500,000',
    lifetimeInstallPace: 125,
    lifetimeInstallPaceDisplay: '125',
    daysSinceAdded: 400,
    ratingPercent: 96,
    ratingScore: 4.8,
    ratingScoreDisplay: '4.8',
    ratingCount: 250,
    ratingDistribution: { 1: 5, 2: 2, 3: 3, 4: 15, 5: 225 },
    supportThreads: 20,
    supportThreadsResolved: 18,
    supportResolutionRate: 90,
    addedAt: '2025-01-01',
    lastUpdatedAt: '2026-08-10',
    lastUpdatedRelative: '6 days ago',
    freshness: 'fresh',
    requiresWordPress: '6.0',
    testedWordPress: '6.6',
    requiresPhp: '7.4',
    requiredPlugins: [],
    ...overrides,
  };
}

describe('Milestone 8 — Error classification and retry paths', () => {
  it('classifies network disconnection errors', () => {
    const error = new PluginRequestError('Network error', 'network');
    const classified = classifyError(error);
    expect(classified.kind).toBe('network');
    expect(classified.message).toBe('Network error');
  });

  it('classifies HTTP status code errors', () => {
    const error = new PluginRequestError('Plugin request failed with HTTP 500.', 'http', 500);
    const classified = classifyError(error);
    expect(classified.kind).toBe('http');
    expect(classified.statusCode).toBe(500);
  });

  it('classifies malformed and invalid JSON / collection responses', () => {
    const error = new Error('Plugin request returned an invalid plugin collection.');
    const classified = classifyError(error);
    expect(classified.kind).toBe('invalid_response');
    expect(classified.message).toContain('invalid or malformed');
  });

  it('classifies generic fetch failures as network errors', () => {
    const error = new TypeError('Failed to fetch');
    const classified = classifyError(error);
    expect(classified.kind).toBe('network');
  });

  it('tracks failedTag and error in appState and clears them upon successful finishLoading', () => {
    beginLoading('seo');
    failLoading(new PluginRequestError('Network down', 'network'), 'seo');

    expect(appState.status).toBe('error');
    expect(appState.failedTag).toBe('seo');
    expect(appState.error?.kind).toBe('network');

    // Simulate retry
    beginLoading('seo');
    expect(appState.status).toBe('loading');
    expect(appState.error).toBeNull();

    finishLoading({
      plugins: [createMockPlugin({ name: 'SEO Master', slug: 'seo-master' })],
      page: 1,
      totalPages: 1,
      totalResults: 1,
    });

    expect(appState.status).toBe('ready');
    expect(appState.failedTag).toBeNull();
    expect(appState.error).toBeNull();
  });
});

describe('Milestone 8 — Background refresh and stale state', () => {
  beforeEach(() => {
    beginLoading('form-builder');
    finishLoading({
      plugins: [
        createMockPlugin({ name: 'Form A', slug: 'form-a' }),
        createMockPlugin({ name: 'Form B', slug: 'form-b' }),
      ],
      page: 1,
      totalPages: 2,
      totalResults: 200,
    });
  });

  it('preserves existing content during background refresh with isBackgroundRefreshing true', () => {
    expect(appState.plugins.length).toBe(2);

    beginLoading('form-builder', true);
    expect(appState.status).toBe('loading');
    expect(appState.isBackgroundRefreshing).toBe(true);
    expect(appState.plugins.length).toBe(2);
  });

  it('clears previous content when switching to a different tag', () => {
    beginLoading('ecommerce');
    expect(appState.status).toBe('loading');
    expect(appState.isBackgroundRefreshing).toBe(false);
    expect(appState.plugins.length).toBe(0);
    expect(appState.activeTag).toBe('ecommerce');
  });
});

describe('Milestone 8 — Layout-matched skeletons and table semantics', () => {
  let origDoc: any;

  beforeEach(() => {
    origDoc = (globalThis as any).document;
    setupMockDOM();
  });

  afterEach(() => {
    (globalThis as any).document = origDoc;
  });

  it('renders table skeletons with exactly 6 columns and aria-hidden="true"', () => {
    const frag = createTableSkeletons(5);
    expect(frag.childElementCount).toBe(5);

    const rows = Array.from(frag.children);
    for (const row of rows) {
      expect(row.tagName).toBe('TR');
      expect(row.getAttribute('aria-hidden')).toBe('true');
      expect(row.children.length).toBe(6);
      for (const cell of Array.from(row.children)) {
        expect(cell.tagName).toBe('TD');
      }
    }
  });

  it('renders valid table error row with colspan 6, role alert, and operable retry button', () => {
    let retried = false;
    const row = createTableErrorRow(
      { kind: 'network', message: 'Network connection unavailable.' },
      'form-builder',
      () => {
        retried = true;
      }
    );

    expect(row.tagName).toBe('TR');
    const cell = row.querySelector('td');
    expect(cell).not.toBeNull();
    expect(cell?.getAttribute('colspan')).toBe('6');
    expect(cell?.getAttribute('role')).toBe('alert');

    const retryBtn = row.querySelector<HTMLButtonElement>('.btn-retry-tag');
    expect(retryBtn).not.toBeNull();
    retryBtn?.click();
    expect(retried).toBe(true);
  });

  it('renders valid table empty tag row and no-matches row with colspan 6', () => {
    const emptyRow = createTableEmptyTagRow('unknown-tag');
    expect(emptyRow.querySelector('td')?.getAttribute('colspan')).toBe('6');

    let cleared = false;
    const noMatchRow = createTableNoMatchesRow('nonexistent', () => {
      cleared = true;
    });
    expect(noMatchRow.querySelector('td')?.getAttribute('colspan')).toBe('6');
    noMatchRow.querySelector<HTMLButtonElement>('.btn-clear-filter')?.click();
    expect(cleared).toBe(true);
  });

  it('renders card error state with operable retry button', () => {
    let retried = false;
    const cardError = createCardErrorState(
      { kind: 'http', message: 'Server error', statusCode: 500 },
      'form-builder',
      () => {
        retried = true;
      }
    );

    const retryBtn = cardError.querySelector<HTMLButtonElement>('.btn-retry-tag');
    expect(retryBtn).not.toBeNull();
    retryBtn?.click();
    expect(retried).toBe(true);
  });

  it('renders card skeletons in cards grid', () => {
    const loadingWrap = createCardLoadingState();
    expect(loadingWrap.classList.contains('cards-grid')).toBe(true);
    expect(loadingWrap.querySelectorAll('.plugin-card--skeleton').length).toBe(6);
  });
});

describe('Milestone 8 — Live status announcements and results meta', () => {
  it('formats loading announcement for fresh load vs background refresh', () => {
    appState.status = 'loading';
    appState.activeTag = 'form-builder';
    appState.isBackgroundRefreshing = false;
    expect(formatResultsMeta(appState, 0)).toBe('Loading plugins tagged "form-builder"…');

    appState.isBackgroundRefreshing = true;
    expect(formatResultsMeta(appState, 10)).toBe('Updating plugins tagged "form-builder"…');
  });

  it('formats concise error announcement', () => {
    appState.status = 'error';
    appState.activeTag = 'security';
    appState.failedTag = 'security';
    appState.error = { kind: 'network', message: 'Unable to reach server.' };

    expect(formatResultsMeta(appState, 0)).toBe('Failed to load plugins for "security": Unable to reach server.');
  });

  it('formats empty directory announcement when 0 plugins found', () => {
    appState.status = 'ready';
    appState.activeTag = 'empty-tag';
    appState.plugins = [];
    expect(formatResultsMeta(appState, 0)).toBe('No plugins found for tag "empty-tag".');
  });

  it('formats no filter matches announcement', () => {
    appState.status = 'ready';
    appState.activeTag = 'form-builder';
    appState.plugins = [createMockPlugin()];
    appState.query = 'xyz';
    expect(formatResultsMeta(appState, 0)).toBe('No plugins matching “xyz” found among 1 loaded plugins.');
  });
});
