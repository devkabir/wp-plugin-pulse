import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { getStoredView, setStoredView, STORAGE_KEY_VIEW } from './view-preference';

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

describe('view preference utility', () => {
  let originalLocalStorage: any;

  beforeEach(() => {
    originalLocalStorage = (globalThis as any).localStorage;
    (globalThis as any).localStorage = new MockLocalStorage();
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
  });

  it('defaults to table when no preference is stored', () => {
    expect(getStoredView()).toBe('table');
  });

  it('returns stored view if valid', () => {
    localStorage.setItem(STORAGE_KEY_VIEW, 'cards');
    expect(getStoredView()).toBe('cards');

    localStorage.setItem(STORAGE_KEY_VIEW, 'table');
    expect(getStoredView()).toBe('table');
  });

  it('falls back to table if stored value is invalid', () => {
    localStorage.setItem(STORAGE_KEY_VIEW, 'invalid-view');
    expect(getStoredView()).toBe('table');
  });

  it('persists preferred view to localStorage', () => {
    setStoredView('cards');
    expect(localStorage.getItem(STORAGE_KEY_VIEW)).toBe('cards');
    expect(getStoredView()).toBe('cards');

    setStoredView('table');
    expect(localStorage.getItem(STORAGE_KEY_VIEW)).toBe('table');
    expect(getStoredView()).toBe('table');
  });
});
