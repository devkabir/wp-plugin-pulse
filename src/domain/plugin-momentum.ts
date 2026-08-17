import { deduplicateSnapshots } from './plugin-snapshots';
import type {
  BandTransition,
  MomentumConfidence,
  MomentumDirection,
  PluginMomentum,
  PluginSnapshot,
  SnapshotGap,
  TrajectoryDirection,
} from './plugin-types';

const MILLISECONDS_PER_DAY = 86_400_000;

export interface MomentumOptions {
  /** Minimum elapsed calendar days between start and end observations (default: 7) */
  minElapsedDays?: number;
  /** Minimum number of stored observations required (default: 2) */
  minObservations?: number;
}

/**
 * Calculates real momentum and observed changes between stored snapshots over time.
 *
 * Rules:
 * - Requires at least two stored observations and seven elapsed days.
 * - Retains raw reported precision; does NOT interpolate data between rounded install bands.
 * - Missing scheduled runs produce visible gaps, not fabricated data points.
 * - Deterministic: reprocessing identical snapshots produces identical output.
 */
export function calculatePluginMomentum(
  snapshots: readonly PluginSnapshot[],
  options: MomentumOptions = {}
): PluginMomentum {
  const minElapsedDays = options.minElapsedDays ?? 7;
  const minObservations = options.minObservations ?? 2;

  // Deduplicate and sort chronologically
  const sorted = deduplicateSnapshots(snapshots);

  if (sorted.length === 0) {
    return createInsufficientDataResult(
      '',
      'insufficient_observations',
      'No stored snapshot observations available for this plugin.'
    );
  }

  const slug = sorted[0].slug;

  if (sorted.length < minObservations) {
    return createInsufficientDataResult(
      slug,
      'insufficient_observations',
      `At least ${minObservations} observations are required to calculate momentum (currently ${sorted.length}).`,
      sorted[0] ?? null,
      sorted[sorted.length - 1] ?? null,
      sorted.length
    );
  }

  const startSnapshot = sorted[0];
  const endSnapshot = sorted[sorted.length - 1];

  const startTime = Date.parse(startSnapshot.observedAt);
  const endTime = Date.parse(endSnapshot.observedAt);
  const intervalMs = Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.max(0, endTime - startTime) : 0;
  const intervalDays = intervalMs / MILLISECONDS_PER_DAY;

  if (intervalDays < minElapsedDays) {
    return createInsufficientDataResult(
      slug,
      'insufficient_interval',
      `At least ${minElapsedDays} elapsed days are required to calculate momentum (currently ${intervalDays.toFixed(1)} days).`,
      startSnapshot,
      endSnapshot,
      sorted.length,
      intervalDays
    );
  }

  // Calculate deltas strictly between stored observations
  const activeInstallsDelta = endSnapshot.activeInstalls - startSnapshot.activeInstalls;
  const activeInstallsCrossedBand = activeInstallsDelta !== 0;

  const bandDirection: TrajectoryDirection =
    activeInstallsDelta > 0 ? 'rising' : activeInstallsDelta < 0 ? 'declining' : 'flat';

  const bandTransition: BandTransition = {
    from: startSnapshot.activeInstalls,
    to: endSnapshot.activeInstalls,
    crossed: activeInstallsCrossedBand,
    direction: bandDirection,
  };

  const downloadedDelta = endSnapshot.downloaded - startSnapshot.downloaded;
  const downloadPacePerDay = intervalDays > 0 ? downloadedDelta / intervalDays : 0;
  const downloadPacePerDayDisplay =
    downloadPacePerDay >= 1000
      ? `${Math.round(downloadPacePerDay).toLocaleString()} / day`
      : `${downloadPacePerDay.toFixed(1)} / day`;

  const ratingDelta = Math.round((endSnapshot.rating - startSnapshot.rating) * 100) / 100;
  const ratingCountDelta = endSnapshot.ratingCount - startSnapshot.ratingCount;
  const supportThreadsDelta = endSnapshot.supportThreads - startSnapshot.supportThreads;
  const supportThreadsResolvedDelta =
    endSnapshot.supportThreadsResolved - startSnapshot.supportThreadsResolved;

  const startResolutionRate =
    startSnapshot.supportThreads > 0
      ? (startSnapshot.supportThreadsResolved / startSnapshot.supportThreads) * 100
      : null;
  const endResolutionRate =
    endSnapshot.supportThreads > 0
      ? (endSnapshot.supportThreadsResolved / endSnapshot.supportThreads) * 100
      : null;

  const supportResolutionRateDelta =
    startResolutionRate !== null && endResolutionRate !== null
      ? Math.round((endResolutionRate - startResolutionRate) * 10) / 10
      : null;

  // Tracked metadata changes
  const versionChanged = startSnapshot.version !== endSnapshot.version;
  const testedWordPressChanged = startSnapshot.testedWordPress !== endSnapshot.testedWordPress;
  const contentChanged = startSnapshot.contentHash !== endSnapshot.contentHash;

  // Gap detection for missing daily scheduled runs
  const gaps: SnapshotGap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevT = Date.parse(sorted[i - 1].observedAt);
    const currT = Date.parse(sorted[i].observedAt);
    if (Number.isFinite(prevT) && Number.isFinite(currT)) {
      const gapDiffDays = (currT - prevT) / MILLISECONDS_PER_DAY;
      // If gap exceeds ~1.75 days (indicating at least one missed 24h cycle)
      if (gapDiffDays >= 1.75) {
        gaps.push({
          startDate: sorted[i - 1].observedAt,
          endDate: sorted[i].observedAt,
          gapDays: Math.round(gapDiffDays * 10) / 10,
          missingDaysCount: Math.max(1, Math.round(gapDiffDays) - 1),
        });
      }
    }
  }

  const hasGaps = gaps.length > 0;
  const maxGapDays = gaps.reduce((max, g) => Math.max(max, g.gapDays), 0);
  const expectedObservations = Math.max(2, Math.round(intervalDays) + 1);
  const actualObservations = sorted.length;
  const coverageRatio = Math.min(1, actualObservations / expectedObservations);

  // Precision thresholds for trajectory
  // Active installs are reported in discrete rounded bands. Do not label rising/declining if no band was crossed.
  const activeInstallsTrajectory: TrajectoryDirection =
    activeInstallsDelta > 0 ? 'rising' : activeInstallsDelta < 0 ? 'declining' : 'flat';

  const downloadTrajectory: TrajectoryDirection =
    downloadedDelta > 0 ? 'rising' : downloadedDelta < 0 ? 'declining' : 'flat';

  // Rating precision: noise within ±0.05 rating score (or ±1% rating) is treated as flat
  const ratingTrajectory: TrajectoryDirection =
    ratingDelta > 1.0 ? 'rising' : ratingDelta < -1.0 ? 'declining' : 'flat';

  // Overall momentum direction
  let direction: MomentumDirection = 'flat';
  if (activeInstallsDelta > 0) {
    direction = 'rising';
  } else if (activeInstallsDelta < 0) {
    direction = 'declining';
  } else {
    // Active installs band unchanged: check downloads velocity and ratings
    if (downloadedDelta > 0 && ratingDelta >= -2.0) {
      direction = 'rising';
    } else if (downloadedDelta < 0 || ratingDelta < -5.0) {
      direction = 'declining';
    } else {
      direction = 'flat';
    }
  }

  // Confidence assessment
  let confidence: MomentumConfidence = 'medium';
  let confidenceScore = 0.65;
  let confidenceReason = '';

  if (intervalDays >= 14 && coverageRatio >= 0.8 && maxGapDays <= 3) {
    confidence = 'high';
    confidenceScore = Math.min(1.0, 0.85 + coverageRatio * 0.15);
    confidenceReason = `Consistent daily observations across ${intervalDays.toFixed(0)} elapsed days with ${(coverageRatio * 100).toFixed(0)}% schedule coverage.`;
  } else if (intervalDays >= 7 && coverageRatio >= 0.5 && maxGapDays <= 7) {
    confidence = 'medium';
    confidenceScore = 0.65;
    confidenceReason = hasGaps
      ? `Observations span ${intervalDays.toFixed(0)} elapsed days with ${gaps.length} detected observation gap(s).`
      : `Observations span ${intervalDays.toFixed(0)} elapsed days with acceptable cadence.`;
  } else {
    confidence = 'low';
    confidenceScore = 0.35;
    confidenceReason = `Sparse observation history with ${(coverageRatio * 100).toFixed(0)}% coverage or long gaps.`;
  }

  return {
    slug,
    hasSufficientData: true,
    status: 'ready',
    startSnapshot,
    endSnapshot,
    observationCount: sorted.length,
    startObservationDate: startSnapshot.observedAt,
    endObservationDate: endSnapshot.observedAt,
    intervalDays: Math.round(intervalDays * 10) / 10,

    activeInstallsDelta,
    bandTransition,
    downloadedDelta,
    downloadPacePerDay: Math.round(downloadPacePerDay * 10) / 10,
    downloadPacePerDayDisplay,
    ratingDelta,
    ratingCountDelta,
    supportThreadsDelta,
    supportThreadsResolvedDelta,
    supportResolutionRateDelta,

    versionChanged,
    previousVersion: startSnapshot.version,
    currentVersion: endSnapshot.version,
    testedWordPressChanged,
    previousTestedWordPress: startSnapshot.testedWordPress,
    currentTestedWordPress: endSnapshot.testedWordPress,
    contentChanged,

    direction,
    activeInstallsTrajectory,
    downloadTrajectory,
    ratingTrajectory,

    confidence,
    confidenceScore,
    confidenceReason,

    hasGaps,
    gaps,
    maxGapDays,
    expectedObservations,
    actualObservations,
    coverageRatio: Math.round(coverageRatio * 100) / 100,
  };
}

function createInsufficientDataResult(
  slug: string,
  status: 'insufficient_observations' | 'insufficient_interval',
  reason: string,
  startSnapshot: PluginSnapshot | null = null,
  endSnapshot: PluginSnapshot | null = null,
  observationCount = 0,
  intervalDays = 0
): PluginMomentum {
  return {
    slug,
    hasSufficientData: false,
    status,
    reason,
    startSnapshot,
    endSnapshot,
    observationCount,
    startObservationDate: startSnapshot?.observedAt ?? null,
    endObservationDate: endSnapshot?.observedAt ?? null,
    intervalDays: Math.round(intervalDays * 10) / 10,

    activeInstallsDelta: 0,
    bandTransition: {
      from: startSnapshot?.activeInstalls ?? 0,
      to: endSnapshot?.activeInstalls ?? 0,
      crossed: false,
      direction: 'flat',
    },
    downloadedDelta: 0,
    downloadPacePerDay: 0,
    downloadPacePerDayDisplay: '0 / day',
    ratingDelta: 0,
    ratingCountDelta: 0,
    supportThreadsDelta: 0,
    supportThreadsResolvedDelta: 0,
    supportResolutionRateDelta: null,

    versionChanged: false,
    previousVersion: startSnapshot?.version ?? null,
    currentVersion: endSnapshot?.version ?? null,
    testedWordPressChanged: false,
    previousTestedWordPress: startSnapshot?.testedWordPress ?? null,
    currentTestedWordPress: endSnapshot?.testedWordPress ?? null,
    contentChanged: false,

    direction: 'insufficient_data',
    activeInstallsTrajectory: 'flat',
    downloadTrajectory: 'flat',
    ratingTrajectory: 'flat',

    confidence: 'low',
    confidenceScore: 0,
    confidenceReason: reason,

    hasGaps: false,
    gaps: [],
    maxGapDays: 0,
    expectedObservations: 0,
    actualObservations: observationCount,
    coverageRatio: 0,
  };
}
