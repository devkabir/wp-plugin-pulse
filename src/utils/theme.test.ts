import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  getStoredTheme,
  setStoredTheme,
  applyTheme,
  toggleTheme,
  THEME_STORAGE_KEY,
} from './theme';

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

class MockElement {
  attributes = new Map<string, string>();
  style: Record<string, string> = {};

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

describe('theme utility', () => {
  let originalLocalStorage: any;
  let originalDocument: any;
  let originalWindow: any;
  let mockDocElement: MockElement;
  let mockMetaElement: MockElement;
  let mockButtonElement: MockElement;

  beforeEach(() => {
    originalLocalStorage = (globalThis as any).localStorage;
    originalDocument = (globalThis as any).document;
    originalWindow = (globalThis as any).window;

    (globalThis as any).localStorage = new MockLocalStorage();

    mockDocElement = new MockElement();
    mockMetaElement = new MockElement();
    mockButtonElement = new MockElement();

    (globalThis as any).document = {
      documentElement: mockDocElement,
      querySelector: (selector: string) => {
        if (selector === 'meta[name="color-scheme"]') return mockMetaElement;
        return null;
      },
      getElementById: (id: string) => {
        if (id === 'theme-toggle') return mockButtonElement;
        return null;
      },
    };

    (globalThis as any).window = {
      matchMedia: (query: string) => ({
        matches: query.includes('dark'),
        addEventListener: () => {},
      }),
    };
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  it('reads and writes stored theme in localStorage', () => {
    expect(getStoredTheme()).toBeNull();
    setStoredTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(getStoredTheme()).toBe('dark');

    setStoredTheme('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(getStoredTheme()).toBe('light');

    setStoredTheme(null);
    expect(getStoredTheme()).toBeNull();
  });

  it('applies theme attributes to html root, meta color-scheme, and updates toggle button', () => {
    applyTheme('dark');
    expect(mockDocElement.getAttribute('data-theme')).toBe('dark');
    expect(mockDocElement.style.colorScheme).toBe('dark');
    expect(mockMetaElement.getAttribute('content')).toBe('dark');
    expect(mockButtonElement.getAttribute('aria-label')).toBe('Switch to light theme');

    applyTheme('light');
    expect(mockDocElement.getAttribute('data-theme')).toBe('light');
    expect(mockDocElement.style.colorScheme).toBe('light');
    expect(mockMetaElement.getAttribute('content')).toBe('light');
    expect(mockButtonElement.getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('toggles theme between light and dark and persists the choice', () => {
    setStoredTheme('light');
    const next1 = toggleTheme();
    expect(next1).toBe('dark');
    expect(getStoredTheme()).toBe('dark');
    expect(mockDocElement.getAttribute('data-theme')).toBe('dark');

    const next2 = toggleTheme();
    expect(next2).toBe('light');
    expect(getStoredTheme()).toBe('light');
    expect(mockDocElement.getAttribute('data-theme')).toBe('light');
  });
});
