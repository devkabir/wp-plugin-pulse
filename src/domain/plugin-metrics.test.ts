import { describe, expect, test } from 'bun:test';
import { estimatedInstallsPerDay, freshnessFor, supportResolutionRate } from './plugin-metrics';

describe('plugin metrics', () => {
  test('calculates a finite estimate with a minimum one-day age', () => {
    expect(estimatedInstallsPerDay(100, '2026-08-16', Date.parse('2026-08-16')).estimate).toBe(100);
    expect(estimatedInstallsPerDay(100, 'invalid', Date.parse('2026-08-16'))).toEqual({
      daysSinceAdded: 0,
      estimate: 0,
    });
  });

  test('returns no support rate for a zero denominator and clamps malformed totals', () => {
    expect(supportResolutionRate(0, 0)).toBeNull();
    expect(supportResolutionRate(10, 12)).toBe(100);
  });

  test('categorizes freshness without leaking invalid dates', () => {
    const now = Date.parse('2026-08-16T00:00:00Z');
    expect(freshnessFor('2026-08-01T00:00:00Z', now)).toBe('fresh');
    expect(freshnessFor('not-a-date', now)).toBe('unknown');
  });
});
