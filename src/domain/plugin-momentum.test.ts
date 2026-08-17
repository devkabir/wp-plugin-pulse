import { describe, expect, it } from 'bun:test';
import { calculatePluginMomentum } from './plugin-momentum';
import type { PluginSnapshot } from './plugin-types';

describe('PR 11 — Historical Snapshots and Real Momentum: Delta & Momentum Calculations', () => {
  const createDailySnapshots = (
    slug: string,
    startDate: string,
    days: number,
    generator: (dayIndex: number) => Partial<PluginSnapshot>
  ): PluginSnapshot[] => {
    const baseTime = Date.parse(startDate);
    const snapshots: PluginSnapshot[] = [];
    for (let i = 0; i < days; i++) {
      const observedAt = new Date(baseTime + i * 86_400_000).toISOString();
      const custom = generator(i);
      snapshots.push({
        slug,
        observedAt,
        activeInstalls: custom.activeInstalls ?? 100000,
        downloaded: custom.downloaded ?? 200000 + i * 500,
        rating: custom.rating ?? 94,
        ratingCount: custom.ratingCount ?? 150 + i,
        supportThreads: custom.supportThreads ?? 20,
        supportThreadsResolved: custom.supportThreadsResolved ?? 18,
        version: custom.version ?? '1.0.0',
        testedWordPress: custom.testedWordPress ?? '6.6',
        lastUpdatedAt: custom.lastUpdatedAt ?? '2026-08-01T00:00:00.000Z',
        contentHash: custom.contentHash ?? 'content-hash-v1',
      });
    }
    return snapshots;
  };

  it('requires at least two observations and seven elapsed days before showing momentum', () => {
    const singleSnapshot: PluginSnapshot[] = [
      {
        slug: 'test-plugin',
        observedAt: '2026-08-01T00:00:00.000Z',
        activeInstalls: 50000,
        downloaded: 100000,
        rating: 90,
        ratingCount: 50,
        supportThreads: 10,
        supportThreadsResolved: 8,
        version: '1.0.0',
        testedWordPress: '6.5',
        lastUpdatedAt: null,
        contentHash: 'hash1',
      },
    ];

    const result1 = calculatePluginMomentum(singleSnapshot);
    expect(result1.hasSufficientData).toBe(false);
    expect(result1.status).toBe('insufficient_observations');
    expect(result1.reason).toContain('At least 2 observations are required');

    // Two observations but only 3 days elapsed
    const shortIntervalSnapshots: PluginSnapshot[] = [
      singleSnapshot[0],
      {
        ...singleSnapshot[0],
        observedAt: '2026-08-04T00:00:00.000Z',
        downloaded: 101000,
      },
    ];

    const result2 = calculatePluginMomentum(shortIntervalSnapshots);
    expect(result2.hasSufficientData).toBe(false);
    expect(result2.status).toBe('insufficient_interval');
    expect(result2.intervalDays).toBe(3);
    expect(result2.reason).toContain('At least 7 elapsed days are required');
  });

  it('calculates deltas strictly between stored observations and links start/end snapshots', () => {
    // 14 days of observations
    const snapshots = createDailySnapshots('form-builder', '2026-08-01T00:00:00.000Z', 15, (day) => ({
      activeInstalls: 100000, // Stays in same rounded band
      downloaded: 300000 + day * 1200,
      rating: 96,
      ratingCount: 200 + day * 2,
      supportThreads: 25 + day,
      supportThreadsResolved: 20 + day,
      version: day >= 7 ? '2.1.0' : '2.0.0',
      testedWordPress: day >= 10 ? '6.7' : '6.6',
      contentHash: day >= 7 ? 'hash-v2' : 'hash-v1',
    }));

    const momentum = calculatePluginMomentum(snapshots);

    expect(momentum.hasSufficientData).toBe(true);
    expect(momentum.status).toBe('ready');
    expect(momentum.intervalDays).toBe(14);
    expect(momentum.observationCount).toBe(15);

    // Links to start and end snapshots
    expect(momentum.startSnapshot).toBeDefined();
    expect(momentum.startSnapshot?.observedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(momentum.endSnapshot).toBeDefined();
    expect(momentum.endSnapshot?.observedAt).toBe('2026-08-15T00:00:00.000Z');

    // Retains raw reported precision: install delta is 0 (no band crossed)
    expect(momentum.activeInstallsDelta).toBe(0);
    expect(momentum.bandTransition.crossed).toBe(false);
    expect(momentum.bandTransition.from).toBe(100000);
    expect(momentum.bandTransition.to).toBe(100000);
    expect(momentum.activeInstallsTrajectory).toBe('flat');

    // Download deltas
    expect(momentum.downloadedDelta).toBe(14 * 1200); // 16,800
    expect(momentum.downloadPacePerDay).toBe(1200);
    expect(momentum.downloadPacePerDayDisplay).toBe('1,200 / day');

    // Metadata changes
    expect(momentum.versionChanged).toBe(true);
    expect(momentum.previousVersion).toBe('2.0.0');
    expect(momentum.currentVersion).toBe('2.1.0');
    expect(momentum.testedWordPressChanged).toBe(true);
    expect(momentum.previousTestedWordPress).toBe('6.6');
    expect(momentum.currentTestedWordPress).toBe('6.7');
    expect(momentum.contentChanged).toBe(true);

    // High confidence with 100% daily coverage
    expect(momentum.confidence).toBe('high');
    expect(momentum.hasGaps).toBe(false);
    expect(momentum.gaps).toHaveLength(0);
  });

  it('detects install band transitions and labels trajectory rising/declining only when crossing thresholds', () => {
    // Plugin crosses install band from 100k to 200k
    const snapshotsRising = createDailySnapshots('popular-plugin', '2026-08-01T00:00:00.000Z', 10, (day) => ({
      activeInstalls: day >= 5 ? 200000 : 100000,
      downloaded: 500000 + day * 5000,
    }));

    const momentumRising = calculatePluginMomentum(snapshotsRising);
    expect(momentumRising.activeInstallsDelta).toBe(100000);
    expect(momentumRising.bandTransition.crossed).toBe(true);
    expect(momentumRising.bandTransition.from).toBe(100000);
    expect(momentumRising.bandTransition.to).toBe(200000);
    expect(momentumRising.activeInstallsTrajectory).toBe('rising');
    expect(momentumRising.direction).toBe('rising');

    // Plugin whose reported installs stay flat: does NOT invent fake install precision
    const snapshotsFlat = createDailySnapshots('steady-plugin', '2026-08-01T00:00:00.000Z', 8, () => ({
      activeInstalls: 50000,
      downloaded: 100000, // zero new downloads
      rating: 90,
    }));

    const momentumFlat = calculatePluginMomentum(snapshotsFlat);
    expect(momentumFlat.activeInstallsDelta).toBe(0);
    expect(momentumFlat.bandTransition.crossed).toBe(false);
    expect(momentumFlat.activeInstallsTrajectory).toBe('flat');
    expect(momentumFlat.downloadTrajectory).toBe('flat');
    expect(momentumFlat.direction).toBe('flat');
  });

  it('produces visible gaps when scheduled runs are missing instead of interpolating data', () => {
    const snap1: PluginSnapshot = {
      slug: 'gap-plugin',
      observedAt: '2026-08-01T00:00:00.000Z',
      activeInstalls: 10000,
      downloaded: 20000,
      rating: 90,
      ratingCount: 30,
      supportThreads: 5,
      supportThreadsResolved: 4,
      version: '1.0.0',
      testedWordPress: '6.5',
      lastUpdatedAt: null,
      contentHash: 'hash1',
    };

    // Missing days 2-6 (5 missing days gap)
    const snap2: PluginSnapshot = {
      slug: 'gap-plugin',
      observedAt: '2026-08-07T00:00:00.000Z',
      activeInstalls: 10000,
      downloaded: 23000,
      rating: 90,
      ratingCount: 32,
      supportThreads: 6,
      supportThreadsResolved: 5,
      version: '1.0.0',
      testedWordPress: '6.5',
      lastUpdatedAt: null,
      contentHash: 'hash1',
    };

    const snap3: PluginSnapshot = {
      slug: 'gap-plugin',
      observedAt: '2026-08-08T00:00:00.000Z',
      activeInstalls: 10000,
      downloaded: 23500,
      rating: 90,
      ratingCount: 33,
      supportThreads: 6,
      supportThreadsResolved: 5,
      version: '1.0.0',
      testedWordPress: '6.5',
      lastUpdatedAt: null,
      contentHash: 'hash1',
    };

    const momentum = calculatePluginMomentum([snap1, snap2, snap3]);

    expect(momentum.hasSufficientData).toBe(true);
    expect(momentum.intervalDays).toBe(7);
    expect(momentum.hasGaps).toBe(true);
    expect(momentum.gaps).toHaveLength(1);
    expect(momentum.gaps[0].startDate).toBe('2026-08-01T00:00:00.000Z');
    expect(momentum.gaps[0].endDate).toBe('2026-08-07T00:00:00.000Z');
    expect(momentum.gaps[0].gapDays).toBe(6);
    expect(momentum.gaps[0].missingDaysCount).toBe(5);

    // Delta is strictly between stored start & end observations (23,500 - 20,000 = 3,500)
    expect(momentum.downloadedDelta).toBe(3500);
    expect(momentum.downloadPacePerDay).toBe(500); // 3500 / 7 days
    expect(momentum.confidence).toBe('low');
    expect(momentum.confidenceReason).toContain('Sparse observation history');
  });

  it('assigns medium confidence when interval is sufficient and gaps are moderate', () => {
    // 6 observations over 8 days (75% coverage, one 2-day weekend gap)
    const snap1: PluginSnapshot = {
      slug: 'weekend-gap',
      observedAt: '2026-08-01T00:00:00.000Z',
      activeInstalls: 10000,
      downloaded: 20000,
      rating: 90,
      ratingCount: 30,
      supportThreads: 5,
      supportThreadsResolved: 4,
      version: '1.0.0',
      testedWordPress: '6.5',
      lastUpdatedAt: null,
      contentHash: 'hash1',
    };
    const snap2 = { ...snap1, observedAt: '2026-08-02T00:00:00.000Z', downloaded: 20500 };
    const snap3 = { ...snap1, observedAt: '2026-08-03T00:00:00.000Z', downloaded: 21000 };
    // Missed Aug 4, resumes Aug 5 (2 days gap)
    const snap4 = { ...snap1, observedAt: '2026-08-05T00:00:00.000Z', downloaded: 22000 };
    const snap5 = { ...snap1, observedAt: '2026-08-06T00:00:00.000Z', downloaded: 22500 };
    const snap6 = { ...snap1, observedAt: '2026-08-08T00:00:00.000Z', downloaded: 23500 };

    const momentum = calculatePluginMomentum([snap1, snap2, snap3, snap4, snap5, snap6]);
    expect(momentum.hasSufficientData).toBe(true);
    expect(momentum.intervalDays).toBe(7);
    expect(momentum.confidence).toBe('medium');
    expect(momentum.hasGaps).toBe(true);
    expect(momentum.gaps).toHaveLength(2);
  });

  it('reprocessing snapshots deterministically produces identical deltas across multiple runs', () => {
    const snapshots = createDailySnapshots('deterministic-check', '2026-08-01T00:00:00.000Z', 10, (day) => ({
      activeInstalls: 20000,
      downloaded: 50000 + day * 350,
      ratingCount: 80 + day,
    }));

    const run1 = calculatePluginMomentum(snapshots);
    const run2 = calculatePluginMomentum(snapshots);
    const run3 = calculatePluginMomentum([...snapshots].reverse()); // Reversing input should not change output

    expect(run1).toEqual(run2);
    expect(run1).toEqual(run3);
  });
});
