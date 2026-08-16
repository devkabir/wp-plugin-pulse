import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  appState,
  clearComparison,
  removeCompetitor,
  setComparisonSubject,
  toggleCompetitor,
} from '../state/app-state';
import { createPluginRow } from '../components/plugin-row';
import { createPluginCard } from '../components/plugin-card';
import { announceComparisonStatus, renderComparisonTray } from '../components/comparison-tray';
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
  disabled = false;
  title = '';
  href = '';
  src = '';
  target = '';
  rel = '';
  style: Record<string, string> = {};
  listeners = new Map<string, Array<(e: any) => void>>();

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
      toggle: (cls: string, force?: boolean) => {
        const has = this.classList.contains(cls);
        const next = force !== undefined ? force : !has;
        if (next) this.classList.add(cls);
        else this.classList.remove(cls);
      },
    };
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name.toLowerCase() === 'id') {
      this.id = value;
    }
  }

  getAttribute(name: string): string | null {
    if (name.toLowerCase() === 'id') {
      return this.id || this.attributes.get('id') || null;
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

  addEventListener(event: string, handler: (e: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  dispatchEvent(event: any): boolean {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      handler(event);
    }
    return true;
  }

  click(): void {
    const event = {
      type: 'click',
      stopPropagation: () => {},
      preventDefault: () => {},
      target: this,
    };
    this.dispatchEvent(event);
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

  set innerHTML(_html: string) {
    this.children = [];
  }
}

function setupMockDOM(): { rootElements: Map<string, MockDOMNode>; body: MockDOMNode } {
  const rootElements = new Map<string, MockDOMNode>();
  const body = new MockDOMNode('BODY');
  const main = new MockDOMNode('MAIN');
  body.append(main);

  (globalThis as any).document = {
    body,
    createElement: (tag: string) => {
      const node = new MockDOMNode(tag);
      return node;
    },
    createElementNS: (_ns: string, tag: string) => {
      const node = new MockDOMNode(tag);
      return node;
    },
    createDocumentFragment: () => new MockDOMNode('#fragment'),
    getElementById: (id: string) => {
      if (rootElements.has(id)) return rootElements.get(id)!;
      return body.querySelector(`#${id}`);
    },
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector),
    _registerElement: (id: string, el: MockDOMNode) => rootElements.set(id, el),
  };

  (globalThis as any).CustomEvent = class {
    type: string;
    detail: any;
    bubbles: boolean;
    constructor(type: string, params: any = {}) {
      this.type = type;
      this.detail = params.detail;
      this.bubbles = params.bubbles ?? false;
    }
  };

  return { rootElements, body };
}

function createMockPlugin(slug: string, name: string): NormalizedPlugin {
  return {
    slug,
    name,
    version: '1.0.0',
    authorName: 'Author',
    authorProfileUrl: null,
    homepageUrl: null,
    pluginUrl: `https://wordpress.org/plugins/${slug}/`,
    downloadUrl: null,
    iconUrl: null,
    shortDescription: `Description for ${name}`,
    tags: ['forms'],
    activeInstalls: 50000,
    activeInstallsDisplay: '50,000+',
    lifetimeDownloads: 100000,
    lifetimeDownloadsDisplay: '100k',
    lifetimeInstallPace: 50,
    lifetimeInstallPaceDisplay: '50',
    daysSinceAdded: 1000,
    ratingPercent: 90,
    ratingScore: 4.5,
    ratingScoreDisplay: '4.5',
    ratingCount: 100,
    ratingDistribution: { 1: 5, 2: 5, 3: 10, 4: 20, 5: 60 },
    supportThreads: 10,
    supportThreadsResolved: 8,
    supportResolutionRate: 80,
    addedAt: '2020-01-01',
    lastUpdatedAt: '2023-01-01',
    lastUpdatedRelative: '1 month ago',
    freshness: 'fresh',
    requiresWordPress: '5.0',
    testedWordPress: '6.5',
    requiresPhp: '7.4',
    requiredPlugins: [],
  };
}

class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('PR 4 — Comparison State Invariants and Actions', () => {
  let originalLocalStorage: any;

  beforeEach(() => {
    setupMockDOM();
    originalLocalStorage = (globalThis as any).localStorage;
    (globalThis as any).localStorage = new MockLocalStorage();
    clearComparison();
    appState.plugins = [
      createMockPlugin('elementor', 'Elementor'),
      createMockPlugin('beaver-builder', 'Beaver Builder'),
      createMockPlugin('divi-builder', 'Divi Builder'),
      createMockPlugin('brizy', 'Brizy'),
      createMockPlugin('oxygen', 'Oxygen'),
    ];
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
  });

  it('sets and removes comparison subject', () => {
    setComparisonSubject('elementor');
    expect(appState.comparison.subjectSlug).toBe('elementor');

    setComparisonSubject(null);
    expect(appState.comparison.subjectSlug).toBeNull();
  });

  it('enforces subject cannot also be a competitor', () => {
    toggleCompetitor('elementor');
    expect(appState.comparison.competitorSlugs).toContain('elementor');

    // Setting elementor as subject should remove it from competitors
    setComparisonSubject('elementor');
    expect(appState.comparison.subjectSlug).toBe('elementor');
    expect(appState.comparison.competitorSlugs).not.toContain('elementor');

    // Cannot add current subject as competitor
    const result = toggleCompetitor('elementor');
    expect(result).toBe(false);
    expect(appState.comparison.competitorSlugs).not.toContain('elementor');
  });

  it('enforces unique competitors and caps competitors at maximum three', () => {
    expect(toggleCompetitor('beaver-builder')).toBe(true);
    expect(toggleCompetitor('divi-builder')).toBe(true);
    expect(toggleCompetitor('brizy')).toBe(true);

    expect(appState.comparison.competitorSlugs).toEqual(['beaver-builder', 'divi-builder', 'brizy']);

    // Attempt to add 4th competitor
    const fourth = toggleCompetitor('oxygen');
    expect(fourth).toBe(false);
    expect(appState.comparison.competitorSlugs).toHaveLength(3);
    expect(appState.comparison.competitorSlugs).not.toContain('oxygen');
  });

  it('toggles existing competitor off', () => {
    toggleCompetitor('beaver-builder');
    expect(appState.comparison.competitorSlugs).toContain('beaver-builder');

    toggleCompetitor('beaver-builder');
    expect(appState.comparison.competitorSlugs).not.toContain('beaver-builder');
  });

  it('removes specific competitor via removeCompetitor', () => {
    toggleCompetitor('beaver-builder');
    toggleCompetitor('divi-builder');
    expect(appState.comparison.competitorSlugs).toHaveLength(2);

    removeCompetitor('beaver-builder');
    expect(appState.comparison.competitorSlugs).toEqual(['divi-builder']);
  });

  it('clears entire comparison state', () => {
    setComparisonSubject('elementor');
    toggleCompetitor('beaver-builder');
    toggleCompetitor('divi-builder');

    expect(appState.comparison.subjectSlug).toBe('elementor');
    expect(appState.comparison.competitorSlugs).toHaveLength(2);

    clearComparison();
    expect(appState.comparison.subjectSlug).toBeNull();
    expect(appState.comparison.competitorSlugs).toEqual([]);
  });
});

describe('PR 4 — Row and Card Selection UI', () => {
  const plugin = createMockPlugin('contact-form-7', 'Contact Form 7');

  beforeEach(() => {
    setupMockDOM();
  });

  it('renders unselected row actions with proper accessibility attributes', () => {
    const row = createPluginRow(plugin, { subjectSlug: null, competitorSlugs: [] });
    expect(row.classList.contains('is-subject')).toBe(false);
    expect(row.classList.contains('is-competitor')).toBe(false);

    const subjectBtn = row.querySelector('.btn-set-subject') as any;
    expect(subjectBtn).not.toBeNull();
    expect(subjectBtn.getAttribute('aria-pressed')).toBe('false');
    expect(subjectBtn.textContent).toContain('Set as My Plugin');

    const competitorBtn = row.querySelector('.btn-set-competitor') as any;
    expect(competitorBtn).not.toBeNull();
    expect(competitorBtn.getAttribute('aria-pressed')).toBe('false');
    expect(competitorBtn.textContent).toContain('Add to comparison');
    expect(competitorBtn.disabled).toBe(false);
  });

  it('renders selected subject row with active classes and aria-pressed', () => {
    const row = createPluginRow(plugin, { subjectSlug: 'contact-form-7', competitorSlugs: [] });
    expect(row.classList.contains('is-subject')).toBe(true);

    const subjectBtn = row.querySelector('.btn-set-subject') as any;
    expect(subjectBtn.classList.contains('btn-set-subject--active')).toBe(true);
    expect(subjectBtn.getAttribute('aria-pressed')).toBe('true');
    expect(subjectBtn.textContent).toContain('My Plugin');

    // Competitor button on subject is disabled
    const competitorBtn = row.querySelector('.btn-set-competitor') as any;
    expect(competitorBtn.disabled).toBe(true);
  });

  it('renders competitor row with active status and allows removal', () => {
    const row = createPluginRow(plugin, { subjectSlug: 'wpforms', competitorSlugs: ['contact-form-7'] });
    expect(row.classList.contains('is-competitor')).toBe(true);

    const competitorBtn = row.querySelector('.btn-set-competitor') as any;
    expect(competitorBtn.classList.contains('btn-set-competitor--active')).toBe(true);
    expect(competitorBtn.getAttribute('aria-pressed')).toBe('true');
    expect(competitorBtn.textContent).toContain('In comparison');
  });

  it('disables competitor button on unselected plugins when competitor limit is reached', () => {
    const comparison = {
      subjectSlug: 'wpforms',
      competitorSlugs: ['comp-1', 'comp-2', 'comp-3'],
    };
    const row = createPluginRow(plugin, comparison);
    const competitorBtn = row.querySelector('.btn-set-competitor') as any;
    expect(competitorBtn.disabled).toBe(true);
  });

  it('renders card view with matching selection states and actions', () => {
    const card = createPluginCard(plugin, { subjectSlug: 'contact-form-7', competitorSlugs: [] });
    expect(card.classList.contains('plugin-card--subject')).toBe(true);

    const subjectBtn = card.querySelector('.btn-set-subject') as any;
    expect(subjectBtn).not.toBeNull();
    expect(subjectBtn.getAttribute('aria-pressed')).toBe('true');

    const competitorBtn = card.querySelector('.btn-set-competitor') as any;
    expect(competitorBtn.disabled).toBe(true);
  });
});

describe('PR 4 — Comparison Tray Component', () => {
  beforeEach(() => {
    setupMockDOM();
    const tray = (globalThis as any).document.createElement('aside');
    tray.id = 'comparison-tray';
    (globalThis as any).document.body.append(tray);
  });

  it('disables compare button when no subject is selected', () => {
    const state: any = {
      plugins: [createMockPlugin('elementor', 'Elementor')],
      comparison: { subjectSlug: null, competitorSlugs: ['elementor'] },
    };
    renderComparisonTray(state);

    const compareBtn = (globalThis as any).document.getElementById('btn-tray-compare') as any;
    expect(compareBtn.disabled).toBe(true);
  });

  it('disables compare button when subject is selected but zero competitors', () => {
    const state: any = {
      plugins: [createMockPlugin('elementor', 'Elementor')],
      comparison: { subjectSlug: 'elementor', competitorSlugs: [] },
    };
    renderComparisonTray(state);

    const compareBtn = (globalThis as any).document.getElementById('btn-tray-compare') as any;
    expect(compareBtn.disabled).toBe(true);
  });

  it('enables compare button when subject and at least one competitor exist', () => {
    const state: any = {
      plugins: [
        createMockPlugin('elementor', 'Elementor'),
        createMockPlugin('beaver-builder', 'Beaver Builder'),
      ],
      comparison: { subjectSlug: 'elementor', competitorSlugs: ['beaver-builder'] },
    };
    renderComparisonTray(state);

    const compareBtn = (globalThis as any).document.getElementById('btn-tray-compare') as any;
    expect(compareBtn.disabled).toBe(false);
    expect(compareBtn.classList.contains('btn-tray-compare--enabled')).toBe(true);
  });

  it('renders keyboard-focusable remove buttons for subject and competitors', () => {
    let removedSubject: string | null = 'not-called';
    let removedComp: string | null = null;

    const state: any = {
      plugins: [
        createMockPlugin('elementor', 'Elementor'),
        createMockPlugin('beaver-builder', 'Beaver Builder'),
      ],
      comparison: { subjectSlug: 'elementor', competitorSlugs: ['beaver-builder'] },
    };

    renderComparisonTray(state, {
      onSetSubject: (val: string | null) => {
        removedSubject = val;
      },
      onRemoveCompetitor: (val: string) => {
        removedComp = val;
      },
    });

    const removeBtns = (globalThis as any).document.querySelectorAll('.comparison-pill__remove') as any[];
    expect(removeBtns.length).toBe(2);

    // Click subject remove button
    removeBtns[0].click();
    expect(removedSubject as string | null).toBeNull();

    // Click competitor remove button
    removeBtns[1].click();
    expect(removedComp as string | null).toBe('beaver-builder');
  });

  it('updates aria-live announcement correctly', async () => {
    announceComparisonStatus('Contact Form 7 set as My Plugin.');
    await new Promise((resolve) => setTimeout(resolve, 80));

    const liveEl = (globalThis as any).document.getElementById('comparison-live');
    expect(liveEl).not.toBeNull();
    expect(liveEl?.textContent).toBe('Contact Form 7 set as My Plugin.');
  });
});
