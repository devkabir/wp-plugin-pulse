import type { ComparisonState } from '../domain/plugin-types';

export const STORAGE_KEY_COMPARISON = 'wp_plugin_pulse_comparison';
export const MAX_COMPETITORS = 3;

export function getDefaultComparisonState(): ComparisonState {
  return {
    subjectSlug: null,
    competitorSlugs: [],
  };
}

/**
 * Validates raw data against the ComparisonState schema and enforces all invariants:
 * - subjectSlug is a non-empty string or null
 * - competitorSlugs contains unique strings
 * - subjectSlug cannot be present in competitorSlugs
 * - maximum of 3 competitor slugs
 */
export function validateComparisonState(data: unknown): ComparisonState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return getDefaultComparisonState();
  }

  const record = data as Record<string, unknown>;

  let subjectSlug: string | null = null;
  if (typeof record.subjectSlug === 'string' && record.subjectSlug.trim().length > 0) {
    subjectSlug = record.subjectSlug.trim();
  }

  const competitorSlugs: string[] = [];
  if (Array.isArray(record.competitorSlugs)) {
    for (const item of record.competitorSlugs) {
      if (typeof item === 'string') {
        const slug = item.trim();
        if (slug.length > 0 && slug !== subjectSlug && !competitorSlugs.includes(slug)) {
          competitorSlugs.push(slug);
          if (competitorSlugs.length >= MAX_COMPETITORS) {
            break;
          }
        }
      }
    }
  }

  return {
    subjectSlug,
    competitorSlugs,
  };
}

/**
 * Retrieves the stored comparison state from localStorage.
 * Returns default empty state if missing, malformed, or invalid.
 */
export function getStoredComparison(): ComparisonState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPARISON);
    if (!raw) {
      return getDefaultComparisonState();
    }
    const parsed: unknown = JSON.parse(raw);
    return validateComparisonState(parsed);
  } catch {
    // Return safe default on JSON parse error or storage access issue
    return getDefaultComparisonState();
  }
}

/**
 * Persists the comparison selection slugs to localStorage.
 */
export function setStoredComparison(state: ComparisonState): void {
  try {
    const sanitized = validateComparisonState(state);
    localStorage.setItem(
      STORAGE_KEY_COMPARISON,
      JSON.stringify({
        subjectSlug: sanitized.subjectSlug,
        competitorSlugs: sanitized.competitorSlugs,
      })
    );
  } catch {
    // Ignore storage exceptions (e.g. storage quota, private mode restrictions)
  }
}
