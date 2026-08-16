import { describe, expect, test } from 'bun:test';
import { freshnessFor, lifetimeInstallPace, supportResolutionRate } from './plugin-metrics';

describe('plugin metrics', () => {
  test('calculates a finite pace with a minimum one-day age', () => {
    expect(lifetimeInstallPace(100, '2026-08-16', Date.parse('2026-08-16')).pace).toBe(100);
    expect(lifetimeInstallPace(100, 'invalid', Date.parse('2026-08-16'))).toEqual({
      daysSinceAdded: 0,
      pace: 0,
    });
    expect(lifetimeInstallPace(100, null, Date.parse('2026-08-16'))).toEqual({
      daysSinceAdded: 0,
      pace: 0,
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
