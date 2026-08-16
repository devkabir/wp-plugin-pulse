import type { KpiSummaryMetrics, NormalizedPlugin } from './plugin-types';

/**
 * Format a large number into a compact display string (e.g., 1_200_000 → "1.2M").
 * Returns "—" for zero or non-finite values.
 */
function compactNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

/**
 * Compute competitive landscape KPI metrics from a normalized plugin collection.
 *
 * All calculations run on the full loaded collection, not any locally filtered subset.
 * Zero denominators and empty collections yield null / em-dash display values,
 * never misleading zeros.
 *
 * Competitive signals computed:
 * - Market size: total active installs across all plugins in this tag.
 * - Market leader: the plugin with the highest estimated installs/day, plus its
 *   install share of the total — a proxy for how monopolized the niche is.
 * - Rating bar: weighted mean rating (by review count) — the quality standard
 *   a new entrant would need to match or beat.
 * - Support bar: aggregate support resolution rate across all plugins.
 * - Gap opportunity: count of plugins not updated in 12+ months — unmaintained
 *   slots a developer could target.
 * - Active maintenance: share updated within 6 months — signals how competitive
 *   the maintenance pace is.
 */
export function computeKpiSummary(plugins: NormalizedPlugin[]): KpiSummaryMetrics {
  const totalLoaded = plugins.length;

  // ── Market size ───────────────────────────────────────────────────────────
  const totalReportedInstalls = plugins.reduce((sum, p) => sum + p.activeInstalls, 0);
  const totalLifetimeDownloads = plugins.reduce((sum, p) => sum + p.lifetimeDownloads, 0);

  // ── Market leader ─────────────────────────────────────────────────────────
  let leader: NormalizedPlugin | null = null;
  for (const p of plugins) {
    if (
      p.estimatedInstallsPerDay > 0 &&
      (leader === null || p.estimatedInstallsPerDay > leader.estimatedInstallsPerDay)
    ) {
      leader = p;
    }
  }

  const topEstimatedInstallsLeader = leader
    ? {
        name: leader.name,
        slug: leader.slug,
        installsPerDay: leader.estimatedInstallsPerDay,
        installsPerDayDisplay: leader.estimatedInstallsPerDayDisplay,
        activeInstalls: leader.activeInstalls,
        activeInstallsDisplay: leader.activeInstallsDisplay,
      }
    : null;

  // Dominant plugin's share of total installs (concentration signal)
  const dominantPluginInstallShare =
    leader && totalReportedInstalls > 0
      ? Math.round((leader.activeInstalls / totalReportedInstalls) * 100)
      : null;

  // ── Rating bar (quality standard to beat) ────────────────────────────────
  let weightedRatingNumerator = 0;
  let weightedRatingDenominator = 0;
  for (const p of plugins) {
    if (p.ratingCount > 0) {
      weightedRatingNumerator += p.ratingScore * p.ratingCount;
      weightedRatingDenominator += p.ratingCount;
    }
  }
  const weightedCommunityRating =
    weightedRatingDenominator > 0
      ? Math.round((weightedRatingNumerator / weightedRatingDenominator) * 10) / 10
      : null;
  const weightedCommunityRatingDisplay =
    weightedCommunityRating !== null ? weightedCommunityRating.toFixed(1) : '—';

  // ── Support bar ───────────────────────────────────────────────────────────
  let totalSupportThreads = 0;
  let totalSupportResolved = 0;
  for (const p of plugins) {
    totalSupportThreads += p.supportThreads;
    totalSupportResolved += p.supportThreadsResolved;
  }
  const overallSupportResolutionRate =
    totalSupportThreads > 0
      ? Math.min(100, Math.max(0, Math.round((totalSupportResolved / totalSupportThreads) * 100)))
      : null;
  const overallSupportResolutionRateDisplay =
    overallSupportResolutionRate !== null ? `${overallSupportResolutionRate}%` : '—';

  // ── Gap & maintenance signals ─────────────────────────────────────────────
  const sixMonthsMs = 180 * 86_400_000;
  const oneYearMs = 365 * 86_400_000;
  const now = Date.now();

  let recentlyUpdatedCount = 0;
  let staleCount = 0;

  for (const p of plugins) {
    if (!p.lastUpdatedAt) {
      staleCount++;
      continue;
    }
    const t = Date.parse(p.lastUpdatedAt);
    if (!Number.isFinite(t)) {
      staleCount++;
      continue;
    }
    const age = now - t;
    if (age <= sixMonthsMs) recentlyUpdatedCount++;
    if (age > oneYearMs) staleCount++;
  }

  const recentlyUpdatedPercent =
    totalLoaded > 0 ? Math.round((recentlyUpdatedCount / totalLoaded) * 100) : 0;

  return {
    totalLoaded,
    totalResults: 0, // caller injects appState.totalResults
    totalReportedInstalls,
    totalReportedInstallsDisplay: compactNumber(totalReportedInstalls),
    totalLifetimeDownloads,
    totalLifetimeDownloadsDisplay: compactNumber(totalLifetimeDownloads),
    topEstimatedInstallsLeader,
    dominantPluginInstallShare,
    weightedCommunityRating,
    weightedCommunityRatingDisplay,
    overallSupportResolutionRate,
    overallSupportResolutionRateDisplay,
    recentlyUpdatedCount,
    recentlyUpdatedPercent,
    staleCount,
  };
}
