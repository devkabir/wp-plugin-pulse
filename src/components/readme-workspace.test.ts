import { beforeEach, describe, expect, test } from 'bun:test';
import { renderReadmeWorkspace, downloadReadmeFile } from './readme-workspace';
import { renderReadmeAuditResults } from './readme-audit-results';
import { renderReadmeDiff } from './readme-diff';
import type { ParseDiagnostic } from '../domain/readme-types';
import type { Recommendation } from '../domain/recommendations';

class MockDOMNode {
  tagName: string;
  className = '';
  attributes = new Map<string, string>();
  children: MockDOMNode[] = [];
  private _textContent = '';
  type = '';
  id = '';
  hidden = false;
  disabled = false;
  title = '';
  value = '';
  checked = false;
  style: Record<string, string> = {};
  listeners = new Map<string, Array<(e: any) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get childElementCount(): number {
    return this.children.length;
  }

  get textContent(): string {
    if (this._textContent) return this._textContent;
    return this.children.map((c) => c.textContent).join(' ');
  }

  set textContent(val: string) {
    this._textContent = val;
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
    this._textContent = '';
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

  (globalThis as any).Event = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };

  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  if (typeof (globalThis as any).Blob === 'undefined') {
    (globalThis as any).Blob = class {
      parts: any[];
      type: string;
      constructor(parts: any[], options: any = {}) {
        this.parts = parts;
        this.type = options.type || '';
      }
    };
  }

  if (typeof (globalThis as any).URL.createObjectURL !== 'function') {
    (globalThis as any).URL.createObjectURL = () => 'blob:mock-url';
    (globalThis as any).URL.revokeObjectURL = () => {};
  }

  return { rootElements, body };
}

describe('PR 9 — Readme Workspace and UI Components', () => {
  beforeEach(() => {
    setupMockDOM();
  });

  describe('renderReadmeAuditResults', () => {
    test('renders parser diagnostics before recommendations', () => {
      const diagnostics: ParseDiagnostic[] = [
        {
          code: 'MALFORMED_TITLE',
          message: 'Malformed plugin title format',
          severity: 'error',
          line: 1,
        },
      ];

      const recommendations: Recommendation[] = [
        {
          id: 'rule-test',
          category: 'metadata',
          severity: 'warning',
          impact: 'medium',
          confidence: 'high',
          title: 'Missing description',
          reason: 'Please add a description.',
          evidence: [{ field: 'description', detail: 'Description empty' }],
          requiresConfirmation: false,
        },
      ];

      const el = renderReadmeAuditResults({
        diagnostics,
        recommendations,
        selectedRecIds: new Set(),
      });

      // Verify diagnostics are present
      const diagSection = el.querySelector('.readme-diagnostics-section');
      expect(diagSection).not.toBeNull();
      expect(diagSection?.textContent).toContain('MALFORMED_TITLE');

      // Verify recommendations follow
      const recSection = el.querySelector('.readme-recommendations-section');
      expect(recSection).not.toBeNull();
      expect(recSection?.textContent).toContain('Missing description');

      // In the DOM child order, diagnostics section comes first
      const children = Array.from((el as unknown as MockDOMNode).children);
      expect(children.indexOf(diagSection as unknown as MockDOMNode)).toBeLessThan(
        children.indexOf(recSection as unknown as MockDOMNode)
      );
    });

    test('groups recommendations by errors, warnings, and suggestions', () => {
      const recommendations: Recommendation[] = [
        {
          id: 'rec-err',
          category: 'syntax',
          severity: 'error',
          impact: 'high',
          confidence: 'high',
          title: 'Syntax Error Title',
          reason: 'Reason 1',
          evidence: [{ detail: 'Evidence 1' }],
          requiresConfirmation: false,
          proposedEdit: { start: 0, end: 5, newText: 'fixed' },
        },
        {
          id: 'rec-warn',
          category: 'metadata',
          severity: 'warning',
          impact: 'medium',
          confidence: 'high',
          title: 'Warning Title',
          reason: 'Reason 2',
          evidence: [{ detail: 'Evidence 2' }],
          requiresConfirmation: false,
        },
        {
          id: 'rec-sugg',
          category: 'positioning',
          severity: 'suggestion',
          impact: 'low',
          confidence: 'medium',
          title: 'Suggestion Title',
          reason: 'Reason 3',
          evidence: [{ detail: 'Evidence 3' }],
          requiresConfirmation: false,
        },
      ];

      const el = renderReadmeAuditResults({
        diagnostics: [],
        recommendations,
        selectedRecIds: new Set(['rec-err']),
      });

      expect(el.querySelector('.recommendation-group--error')).not.toBeNull();
      expect(el.querySelector('.recommendation-group--warning')).not.toBeNull();
      expect(el.querySelector('.recommendation-group--suggestion')).not.toBeNull();

      const checkbox = el.querySelector('#rec-check-rec-err') as unknown as MockDOMNode | null;
      expect(checkbox).not.toBeNull();
      expect(checkbox?.checked).toBe(true);
    });
  });

  describe('renderReadmeDiff', () => {
    test('renders additions and deletions with correct statistics', () => {
      const original = '=== Old Plugin ===\nTags: tag1\nStable tag: 1.0';
      const modified = '=== Old Plugin ===\nTags: tag1, tag2\nStable tag: 2.0';

      const diffEl = renderReadmeDiff(original, modified, { filename: 'readme.txt' });

      expect(diffEl.querySelector('.diff-stat-badge--add')).not.toBeNull();
      expect(diffEl.querySelector('.diff-stat-badge--remove')).not.toBeNull();

      const rows = diffEl.querySelectorAll('.diff-row');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe('renderReadmeWorkspace in-memory lifecycle', () => {
    test('initializes with empty state and does not leak outside memory', () => {
      const container = document.createElement('div');
      const workspace = renderReadmeWorkspace(container);

      const state = workspace.getState();
      expect(state.readmeSource).toBe('');
      expect(state.phpSource).toBe('');
      expect(state.auditResult).toBeNull();
      expect(state.selectedRecIds.size).toBe(0);

      // Verify privacy notice is displayed
      const privacy = (container as unknown as MockDOMNode).querySelector('.readme-workspace__privacy-callout');
      expect(privacy).not.toBeNull();
      expect(privacy?.textContent).toContain('never sent over the network');
    });

    test('reset thoroughly wipes state and in-memory source', () => {
      const container = document.createElement('div');
      const workspace = renderReadmeWorkspace(container);

      const textarea = (container as unknown as MockDOMNode).querySelector('#textarea-readme-paste');
      expect(textarea).not.toBeNull();
      if (textarea) {
        textarea.value = '=== Test Plugin ===\nTags: test';
        textarea.dispatchEvent(new (globalThis as any).Event('input'));
      }

      workspace.runAudit();
      expect(workspace.getState().readmeSource).toBe('=== Test Plugin ===\nTags: test');

      workspace.reset();
      expect(workspace.getState().readmeSource).toBe('');
      expect(workspace.getState().auditResult).toBeNull();
      expect(workspace.getState().draftSource).toBe('');
    });

    test('downloadReadmeFile creates blob and download anchor safely', () => {
      let clicked = false;
      const originalCreateElement = (globalThis as any).document.createElement;
      (globalThis as any).document.createElement = (tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          el.click = () => {
            clicked = true;
          };
        }
        return el;
      };

      downloadReadmeFile('=== Draft Readme ===', 'readme.txt');
      expect(clicked).toBe(true);

      (globalThis as any).document.createElement = originalCreateElement;
    });
  });
});
