import { beforeEach, describe, expect, it } from 'bun:test';
import { comparePlugins } from '../domain/plugin-comparison';
import type { NormalizedPlugin } from '../domain/plugin-types';
import {
  generateComparisonMarkdown,
  renderComparisonWorkspace,
  renderOpportunities,
} from './plugin-compare';
import {
  closeComparisonSection,
  renderComparisonSection,
} from './comparison-section';

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
  download = '';
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

  hasAttribute(name: string): boolean {
    return this.attributes.has(name) || (name.toLowerCase() === 'id' && Boolean(this.id));
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name.toLowerCase() === 'id') {
      this.id = '';
    }
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

  insertBefore(newNode: MockDOMNode, referenceNode: MockDOMNode | null): void {
    const idx = referenceNode ? this.children.indexOf(referenceNode) : -1;
    if (idx >= 0) {
      this.children.splice(idx, 0, newNode);
    } else {
      this.children.push(newNode);
    }
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

  focus(): void {
    (globalThis as any).document.activeElement = this;
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
    activeElement: null,
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

function createMockPlugin(
  slug: string,
  name: string,
  overrides: Partial<NormalizedPlugin> = {}
): NormalizedPlugin {
  return {
    slug,
    name,
    version: '2.4.1',
    authorName: 'Developer Team',
    authorProfileUrl: `https://profiles.wordpress.org/${slug}-author/`,
    homepageUrl: `https://example.com/${slug}`,
    pluginUrl: `https://wordpress.org/plugins/${slug}/`,
    downloadUrl: `https://downloads.wordpress.org/plugin/${slug}.zip`,
    iconUrl: `https://ps.w.org/${slug}/assets/icon-128x128.png`,
    shortDescription: `${name} is an intuitive drag and drop form builder for WordPress with conditional logic and payments.`,
    description: `Full description for ${name} containing Stripe payments, webhooks, multi-step forms, and Gutenberg blocks.`,
    tags: ['forms', 'contact-form', 'form-builder', 'stripe', 'surveys'],
    activeInstalls: 400000,
    activeInstallsDisplay: '400,000+',
    lifetimeDownloads: 12000000,
    lifetimeDownloadsDisplay: '12M',
    lifetimeInstallPace: 150,
    lifetimeInstallPaceDisplay: '150',
    daysSinceAdded: 2500,
    ratingPercent: 96,
    ratingScore: 4.8,
    ratingScoreDisplay: '4.8',
    ratingCount: 1450,
    ratingDistribution: { 1: 15, 2: 10, 3: 25, 4: 200, 5: 1200 },
    supportThreads: 50,
    supportThreadsResolved: 45,
    supportResolutionRate: 90,
    addedAt: '2017-03-15T00:00:00Z',
    lastUpdatedAt: '2024-02-01T00:00:00Z',
    lastUpdatedRelative: '2 weeks ago',
    freshness: 'fresh',
    requiresWordPress: '5.6',
    testedWordPress: '6.7',
    requiresPhp: '7.4',
    requiredPlugins: [],
    ...overrides,
  };
}

describe('PR 6 — Head-to-Head Comparison UI & Workspace', () => {
  let subject: NormalizedPlugin;
  let comp1: NormalizedPlugin;
  let comp2: NormalizedPlugin;
  let comp3: NormalizedPlugin;

  beforeEach(() => {
    setupMockDOM();
    subject = createMockPlugin('form-pulse', 'Form Pulse', {
      tags: ['forms', 'form-builder', 'conditional-logic'],
      shortDescription: 'Form Pulse drag and drop form builder.',
      description: null, // Description not loaded -> triggers unknown for some features
      activeInstalls: 50000,
      activeInstallsDisplay: '50,000+',
      ratingScore: 4.2,
      ratingCount: 80,
      supportThreads: 10,
      supportThreadsResolved: 6,
      supportResolutionRate: 60,
      testedWordPress: '6.4',
      freshness: 'aging',
      lastUpdatedRelative: '8 months ago',
    });

    comp1 = createMockPlugin('gravity-forms-alt', 'Gravity Alt', {
      tags: ['forms', 'form-builder', 'surveys', 'stripe', 'webhooks'],
      testedWordPress: '6.7',
      freshness: 'fresh',
      ratingScore: 4.9,
      ratingCount: 2200,
      supportThreads: 100,
      supportThreadsResolved: 95,
      supportResolutionRate: 95,
    });

    comp2 = createMockPlugin('fluent-forms-alt', 'Fluent Alt', {
      tags: ['forms', 'form-builder', 'calculations', 'multi-step'],
      testedWordPress: '6.6',
      freshness: 'fresh',
      ratingScore: 4.8,
      ratingCount: 950,
      supportThreads: 40,
      supportThreadsResolved: 38,
      supportResolutionRate: 95,
    });

    comp3 = createMockPlugin('ninja-forms-alt', 'Ninja Alt', {
      tags: ['forms', 'form-builder', 'mailchimp', 'zapier'],
      ratingCount: 0,
      supportThreads: 0,
      testedWordPress: '6.5',
    });
  });

  it('renders comparison with one competitor', () => {
    const comparison = comparePlugins(subject, [comp1]);
    const workspace = renderComparisonWorkspace(comparison);

    expect(workspace).not.toBeNull();
    const table = workspace.querySelector('.cmp-table');
    expect(table).not.toBeNull();

    // Subject + 1 competitor header
    const subjectHeaders = workspace.querySelectorAll('.cmp-table__th--subject');
    const compHeaders = workspace.querySelectorAll('.cmp-table__th--competitor');
    expect(subjectHeaders.length).toBe(1);
    expect(compHeaders.length).toBe(1);

    // Group rows present
    const groupRows = workspace.querySelectorAll('.cmp-table__group-header');
    expect(groupRows.length).toBeGreaterThanOrEqual(5);
  });

  it('renders comparison with two competitors', () => {
    const comparison = comparePlugins(subject, [comp1, comp2]);
    const workspace = renderComparisonWorkspace(comparison);

    const compHeaders = workspace.querySelectorAll('.cmp-table__th--competitor');
    expect(compHeaders.length).toBe(2);
  });

  it('renders comparison with three competitors', () => {
    const comparison = comparePlugins(subject, [comp1, comp2, comp3]);
    const workspace = renderComparisonWorkspace(comparison);

    const compHeaders = workspace.querySelectorAll('.cmp-table__th--competitor');
    expect(compHeaders.length).toBe(3);
  });

  it('distinguishes unknown values from zero and confirmed absence', () => {
    const comparison = comparePlugins(subject, [comp3]);
    const workspace = renderComparisonWorkspace(comparison);

    // comp3 has 0 ratings and 0 support threads -> should display insufficient_data / No data
    const statusBadges = Array.from(workspace.querySelectorAll('.cmp-status-badge'));
    const insufficientBadges = statusBadges.filter((b: any) =>
      b.classList.contains('cmp-status-badge--insufficient_data')
    );
    expect(insufficientBadges.length).toBeGreaterThan(0);

    // Subject has description: null -> should have unknown feature badges
    const featureBadges = Array.from(workspace.querySelectorAll('.cmp-feature-badge'));
    const unknownBadges = featureBadges.filter((b: any) =>
      b.classList.contains('cmp-feature-badge--unknown')
    );
    const presentBadges = featureBadges.filter((b: any) =>
      b.classList.contains('cmp-feature-badge--present')
    );
    expect(unknownBadges.length).toBeGreaterThan(0);
    expect(presentBadges.length).toBeGreaterThan(0);
  });

  it('renders Why? disclosure for every opportunity with source plugins and matched fields', () => {
    const comparison = comparePlugins(subject, [comp1, comp2]);
    const oppContainer = renderOpportunities(comparison.opportunities);

    expect(comparison.opportunities.length).toBeGreaterThan(0);

    const oppCards = oppContainer.querySelectorAll('.cmp-opp-card');
    expect(oppCards.length).toBe(comparison.opportunities.length);

    const whyDetails = oppContainer.querySelectorAll('.cmp-opp-why');
    expect(whyDetails.length).toBe(comparison.opportunities.length);

    const summaries = oppContainer.querySelectorAll('.cmp-opp-why__summary');
    expect(summaries.length).toBe(comparison.opportunities.length);
    expect(summaries[0].textContent).toContain('Why?');
  });

  it('generates Markdown export containing slugs, URLs, observation time, and metric definitions', () => {
    const comparison = comparePlugins(subject, [comp1, comp2]);
    const markdown = generateComparisonMarkdown(comparison);

    // Verify observation time
    expect(markdown).toContain('Observation Time:');

    // Verify metric definitions
    expect(markdown).toContain('## Metric Definitions');
    expect(markdown).toContain('Lifetime Install Pace');
    expect(markdown).toContain('Reported active installs divided by days since the plugin was added');
    expect(markdown).toContain('Community Rating');
    expect(markdown).toContain('Support Resolution Rate');
    expect(markdown).toContain('Maintenance Freshness');

    // Verify plugin slugs and source URLs
    expect(markdown).toContain(subject.slug);
    expect(markdown).toContain(`https://wordpress.org/plugins/${subject.slug}/`);
    expect(markdown).toContain(comp1.slug);
    expect(markdown).toContain(`https://wordpress.org/plugins/${comp1.slug}/`);
    expect(markdown).toContain(comp2.slug);
    expect(markdown).toContain(`https://wordpress.org/plugins/${comp2.slug}/`);

    // Verify tables
    expect(markdown).toContain('## Key Metrics Summary');
    expect(markdown).toContain('## Compatibility & Maintenance');
    expect(markdown).toContain('## Feature Matrix');
    expect(markdown).toContain('## Tags & Positioning');
    expect(markdown).toContain('## Strategic Opportunities');
  });

  it('renders comparison-section and handles close and focus restoration', () => {
    const state: any = {
      plugins: [subject, comp1, comp2],
      comparison: {
        subjectSlug: subject.slug,
        competitorSlugs: [comp1.slug, comp2.slug],
      },
    };

    let closed = false;
    const section = renderComparisonSection(state, {
      onClose: () => {
        closed = true;
      },
    });

    expect(section).not.toBeNull();
    expect(section.id).toBe('comparison-section');

    const closeBtn = section.querySelector('.btn-comparison-close') as any;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(closed).toBe(true);

    // Mock compare button in tray
    const compareBtn = new MockDOMNode('BUTTON');
    compareBtn.id = 'btn-tray-compare';
    (globalThis as any).document._registerElement('btn-tray-compare', compareBtn);

    closeComparisonSection();
    expect(section.hidden).toBe(true);
    expect((globalThis as any).document.activeElement).toBe(compareBtn);
  });
});
