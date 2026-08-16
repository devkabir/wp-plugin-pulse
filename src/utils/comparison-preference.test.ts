import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  getDefaultComparisonState,
  getStoredComparison,
  setStoredComparison,
  STORAGE_KEY_COMPARISON,
  validateComparisonState,
} from './comparison-preference';

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

describe('comparison preference and validation utility', () => {
  let originalLocalStorage: any;

  beforeEach(() => {
    originalLocalStorage = (globalThis as any).localStorage;
    (globalThis as any).localStorage = new MockLocalStorage();
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
  });

  describe('validateComparisonState', () => {
    it('returns default empty state for null, undefined, primitives, or arrays', () => {
      expect(validateComparisonState(null)).toEqual({ subjectSlug: null, competitorSlugs: [] });
      expect(validateComparisonState(undefined)).toEqual({ subjectSlug: null, competitorSlugs: [] });
      expect(validateComparisonState('string')).toEqual({ subjectSlug: null, competitorSlugs: [] });
      expect(validateComparisonState(123)).toEqual({ subjectSlug: null, competitorSlugs: [] });
      expect(validateComparisonState([])).toEqual({ subjectSlug: null, competitorSlugs: [] });
    });

    it('sanitizes valid subject and competitor slugs', () => {
      const input = {
        subjectSlug: 'elementor',
        competitorSlugs: ['beaver-builder', 'divi-builder'],
      };
      expect(validateComparisonState(input)).toEqual({
        subjectSlug: 'elementor',
        competitorSlugs: ['beaver-builder', 'divi-builder'],
      });
    });

    it('trims whitespace and ignores empty string slugs', () => {
      const input = {
        subjectSlug: '  woocommerce  ',
        competitorSlugs: ['  shopify-plugin ', '', '   ', 'easy-digital-downloads'],
      };
      expect(validateComparisonState(input)).toEqual({
        subjectSlug: 'woocommerce',
        competitorSlugs: ['shopify-plugin', 'easy-digital-downloads'],
      });
    });

    it('enforces subject cannot also be a competitor invariant', () => {
      const input = {
        subjectSlug: 'contact-form-7',
        competitorSlugs: ['wpforms', 'contact-form-7', 'ninja-forms'],
      };
      expect(validateComparisonState(input)).toEqual({
        subjectSlug: 'contact-form-7',
        competitorSlugs: ['wpforms', 'ninja-forms'],
      });
    });

    it('deduplicates competitor slugs', () => {
      const input = {
        subjectSlug: null,
        competitorSlugs: ['wpforms', 'wpforms', 'ninja-forms', 'wpforms'],
      };
      expect(validateComparisonState(input)).toEqual({
        subjectSlug: null,
        competitorSlugs: ['wpforms', 'ninja-forms'],
      });
    });

    it('caps competitor slugs at maximum 3', () => {
      const input = {
        subjectSlug: 'subject',
        competitorSlugs: ['comp-1', 'comp-2', 'comp-3', 'comp-4', 'comp-5'],
      };
      expect(validateComparisonState(input)).toEqual({
        subjectSlug: 'subject',
        competitorSlugs: ['comp-1', 'comp-2', 'comp-3'],
      });
    });

    it('filters out non-string items in competitor array and handles invalid subject type', () => {
      const input = {
        subjectSlug: 12345,
        competitorSlugs: ['comp-1', null, {}, 42, 'comp-2'],
      };
      expect(validateComparisonState(input)).toEqual({
        subjectSlug: null,
        competitorSlugs: ['comp-1', 'comp-2'],
      });
    });
  });

  describe('getStoredComparison and setStoredComparison', () => {
    it('returns default empty comparison state when storage is empty', () => {
      expect(getStoredComparison()).toEqual(getDefaultComparisonState());
    });

    it('returns valid state persisted in localStorage', () => {
      const state = {
        subjectSlug: 'elementor',
        competitorSlugs: ['beaver-builder'],
      };
      setStoredComparison(state);

      expect(getStoredComparison()).toEqual(state);
    });

    it('handles malformed JSON in localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY_COMPARISON, '{ invalid json');
      expect(getStoredComparison()).toEqual(getDefaultComparisonState());
    });

    it('sanitizes invalid persisted data on retrieval', () => {
      localStorage.setItem(
        STORAGE_KEY_COMPARISON,
        JSON.stringify({
          subjectSlug: 'plugin-a',
          competitorSlugs: ['plugin-a', 'plugin-b', 'plugin-c', 'plugin-d', 'plugin-e'],
        })
      );

      expect(getStoredComparison()).toEqual({
        subjectSlug: 'plugin-a',
        competitorSlugs: ['plugin-b', 'plugin-c', 'plugin-d'],
      });
    });
  });
});
