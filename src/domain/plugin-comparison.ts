import { resolveFeatureDictionary } from './feature-dictionary';
import { extractFeatureForPlugin } from './feature-extractor';
import type {
  ComparisonOpportunity,
  ComparisonRow,
  ComparisonValue,
  FeatureComparison,
  FeatureDefinition,
  FreshnessCategory,
  NormalizedPlugin,
  PluginComparison,
  PluginMomentum,
} from './plugin-types';
import { compareTags, normalizeTagSlug } from './tag-intelligence';

function formatFreshness(freshness: FreshnessCategory): string {
  switch (freshness) {
    case 'fresh':
      return 'Fresh (< 30 days)';
    case 'moderate':
      return 'Moderate (< 6 months)';
    case 'aging':
      return 'Aging (< 12 months)';
    case 'stale':
      return 'Stale (12+ months)';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

function formatMomentumComparisonValue(slug: string, momentum?: PluginMomentum): ComparisonValue {
  if (!momentum || !momentum.hasSufficientData) {
    return {
      slug,
      raw: null,
      display: 'Insufficient snapshot history',
      note: momentum?.reason || 'Requires at least 2 observations across 7+ days.',
      status: 'insufficient_data',
    };
  }

  const directionSymbol =
    momentum.direction === 'rising' ? '↗ Rising' : momentum.direction === 'declining' ? '↘ Declining' : '→ Flat';

  const gapNote = momentum.hasGaps ? `, ${momentum.gaps.length} gap(s)` : '';
  const dateRange = `${momentum.startObservationDate?.slice(0, 10)} to ${momentum.endObservationDate?.slice(0, 10)}`;

  return {
    slug,
    raw: momentum.downloadPacePerDay,
    display: `${directionSymbol} (${momentum.downloadPacePerDayDisplay}, ${momentum.intervalDays}d)`,
    note: `Observed ${dateRange} (${momentum.confidence} confidence${gapNote}). Start/End snapshots linked.`,
    status:
      momentum.direction === 'rising'
        ? 'advantage'
        : momentum.direction === 'declining'
          ? 'disadvantage'
          : 'neutral',
  };
}

/**
 * Compares two semantic version strings safely (e.g. "6.6" vs "6.7.1").
 * Returns >0 if a > b, <0 if a < b, 0 if equal or incomparable.
 */
function compareVersions(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const partsA = a.split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = b.split('.').map((p) => parseInt(p, 10) || 0);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA !== valB) return valA - valB;
  }
  return 0;
}

/**
 * Builds deterministic compatibility comparison rows.
 */
function buildCompatibilityRows(
  subject: NormalizedPlugin,
  competitors: readonly NormalizedPlugin[]
): ComparisonRow[] {
  return [
    {
      key: 'tested_wordpress',
      label: 'Tested up to WordPress',
      subject: {
        slug: subject.slug,
        raw: subject.testedWordPress,
        display: subject.testedWordPress ? `WordPress ${subject.testedWordPress}` : 'Not specified',
        status: subject.testedWordPress ? 'neutral' : 'unknown',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.testedWordPress,
        display: comp.testedWordPress ? `WordPress ${comp.testedWordPress}` : 'Not specified',
        status: comp.testedWordPress ? 'neutral' : 'unknown',
      })),
    },
    {
      key: 'requires_wordpress',
      label: 'Minimum WordPress Version',
      subject: {
        slug: subject.slug,
        raw: subject.requiresWordPress,
        display: subject.requiresWordPress ? `WordPress ${subject.requiresWordPress}+` : 'Not specified',
        status: 'neutral',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.requiresWordPress,
        display: comp.requiresWordPress ? `WordPress ${comp.requiresWordPress}+` : 'Not specified',
        status: 'neutral',
      })),
    },
    {
      key: 'requires_php',
      label: 'Requires PHP Version',
      subject: {
        slug: subject.slug,
        raw: subject.requiresPhp,
        display: subject.requiresPhp ? `PHP ${subject.requiresPhp}+` : 'Not specified',
        status: 'neutral',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.requiresPhp,
        display: comp.requiresPhp ? `PHP ${comp.requiresPhp}+` : 'Not specified',
        status: 'neutral',
      })),
    },
    {
      key: 'required_plugins',
      label: 'Required Dependencies',
      subject: {
        slug: subject.slug,
        raw: subject.requiredPlugins,
        display: subject.requiredPlugins.length > 0 ? subject.requiredPlugins.join(', ') : 'None',
        status: 'neutral',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.requiredPlugins,
        display: comp.requiredPlugins.length > 0 ? comp.requiredPlugins.join(', ') : 'None',
        status: 'neutral',
      })),
    },
  ];
}

/**
 * Builds deterministic maintenance comparison rows.
 */
function buildMaintenanceRows(
  subject: NormalizedPlugin,
  competitors: readonly NormalizedPlugin[]
): ComparisonRow[] {
  return [
    {
      key: 'last_updated',
      label: 'Last Updated',
      subject: {
        slug: subject.slug,
        raw: subject.lastUpdatedAt,
        display: subject.lastUpdatedRelative || 'Unknown',
        status:
          subject.freshness === 'fresh'
            ? 'advantage'
            : subject.freshness === 'stale'
              ? 'disadvantage'
              : 'neutral',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.lastUpdatedAt,
        display: comp.lastUpdatedRelative || 'Unknown',
        status:
          comp.freshness === 'fresh'
            ? 'advantage'
            : comp.freshness === 'stale'
              ? 'disadvantage'
              : 'neutral',
      })),
    },
    {
      key: 'freshness',
      label: 'Maintenance Status',
      subject: {
        slug: subject.slug,
        raw: subject.freshness,
        display: formatFreshness(subject.freshness),
        status:
          subject.freshness === 'fresh'
            ? 'advantage'
            : subject.freshness === 'stale'
              ? 'disadvantage'
              : 'neutral',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.freshness,
        display: formatFreshness(comp.freshness),
        status:
          comp.freshness === 'fresh'
            ? 'advantage'
            : comp.freshness === 'stale'
              ? 'disadvantage'
              : 'neutral',
      })),
    },
    {
      key: 'added_at',
      label: 'Directory Listing Date',
      subject: {
        slug: subject.slug,
        raw: subject.addedAt,
        display: subject.addedAt ? subject.addedAt.slice(0, 10) : 'Unknown',
        status: 'neutral',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.addedAt,
        display: comp.addedAt ? comp.addedAt.slice(0, 10) : 'Unknown',
        status: 'neutral',
      })),
    },
  ];
}

/**
 * Builds deterministic trust comparison rows.
 * Explicitly tracks sample counts for ratings and support threads.
 * Sets status to 'insufficient_data' when counts are zero.
 */
function buildTrustRows(
  subject: NormalizedPlugin,
  competitors: readonly NormalizedPlugin[],
  momentumBySlug?: Record<string, PluginMomentum>
): ComparisonRow[] {
  const rows: ComparisonRow[] = [
    {
      key: 'active_installs',
      label: 'Active Installations',
      subject: {
        slug: subject.slug,
        raw: subject.activeInstalls,
        display: `${subject.activeInstallsDisplay}+ active`,
        status: 'neutral',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.activeInstalls,
        display: `${comp.activeInstallsDisplay}+ active`,
        status: 'neutral',
      })),
    },
    {
      key: 'lifetime_install_pace',
      label: 'Lifetime Install Pace',
      subject: {
        slug: subject.slug,
        raw: subject.lifetimeInstallPace,
        display: `${subject.lifetimeInstallPaceDisplay} / day (avg since listing)`,
        note: 'Reported active installs divided by days since the plugin was added. Not recent growth.',
        status: 'neutral',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.lifetimeInstallPace,
        display: `${comp.lifetimeInstallPaceDisplay} / day (avg since listing)`,
        note: 'Reported active installs divided by days since the plugin was added. Not recent growth.',
        status: 'neutral',
      })),
    },
  ];

  if (momentumBySlug) {
    const subjectMom = momentumBySlug[subject.slug];
    const compMomList = competitors.map((comp) => momentumBySlug[comp.slug]);
    const hasAnyMomentum =
      subjectMom?.hasSufficientData || compMomList.some((m) => m?.hasSufficientData);

    if (hasAnyMomentum || subjectMom || compMomList.some(Boolean)) {
      rows.push({
        key: 'observed_momentum',
        label: 'Observed Momentum',
        subject: formatMomentumComparisonValue(subject.slug, subjectMom),
        competitors: competitors.map((comp) =>
          formatMomentumComparisonValue(comp.slug, momentumBySlug[comp.slug])
        ),
        insight:
          'Calculated strictly between stored snapshot observations with at least 7 elapsed days.',
      });
    }
  }

  rows.push(
    {
      key: 'rating_score',
      label: 'Community Rating',
      subject:
        subject.ratingCount === 0
          ? {
              slug: subject.slug,
              raw: null,
              display: 'No ratings',
              sampleCount: 0,
              status: 'insufficient_data',
            }
          : {
              slug: subject.slug,
              raw: subject.ratingScore,
              display: `${subject.ratingScoreDisplay} ★ (${subject.ratingCount.toLocaleString()} reviews)`,
              sampleCount: subject.ratingCount,
              status: subject.ratingScore >= 4.5 ? 'advantage' : 'neutral',
            },
      competitors: competitors.map((comp) =>
        comp.ratingCount === 0
          ? {
              slug: comp.slug,
              raw: null,
              display: 'No ratings',
              sampleCount: 0,
              status: 'insufficient_data',
            }
          : {
              slug: comp.slug,
              raw: comp.ratingScore,
              display: `${comp.ratingScoreDisplay} ★ (${comp.ratingCount.toLocaleString()} reviews)`,
              sampleCount: comp.ratingCount,
              status: comp.ratingScore >= 4.5 ? 'advantage' : 'neutral',
            }
      ),
    },
    {
      key: 'support_resolution',
      label: 'Support Resolution Rate',
      subject:
        subject.supportThreads === 0
          ? {
              slug: subject.slug,
              raw: null,
              display: 'No support threads',
              sampleCount: 0,
              status: 'insufficient_data',
            }
          : {
              slug: subject.slug,
              raw: subject.supportResolutionRate,
              display: `${subject.supportResolutionRate ?? 0}% (${subject.supportThreadsResolved.toLocaleString()} / ${subject.supportThreads.toLocaleString()} resolved)`,
              sampleCount: subject.supportThreads,
              status: (subject.supportResolutionRate ?? 0) >= 85 ? 'advantage' : 'neutral',
            },
      competitors: competitors.map((comp) =>
        comp.supportThreads === 0
          ? {
              slug: comp.slug,
              raw: null,
              display: 'No support threads',
              sampleCount: 0,
              status: 'insufficient_data',
            }
          : {
              slug: comp.slug,
              raw: comp.supportResolutionRate,
              display: `${comp.supportResolutionRate ?? 0}% (${comp.supportThreadsResolved.toLocaleString()} / ${comp.supportThreads.toLocaleString()} resolved)`,
              sampleCount: comp.supportThreads,
              status: (comp.supportResolutionRate ?? 0) >= 85 ? 'advantage' : 'neutral',
            }
      ),
    },
    {
      key: 'lifetime_downloads',
      label: 'Lifetime Downloads',
      subject: {
        slug: subject.slug,
        raw: subject.lifetimeDownloads,
        display: subject.lifetimeDownloadsDisplay,
        status: 'neutral',
      },
      competitors: competitors.map((comp) => ({
        slug: comp.slug,
        raw: comp.lifetimeDownloads,
        display: comp.lifetimeDownloadsDisplay,
        status: 'neutral',
      })),
    }
  );

  return rows;
}

/**
 * Generates actionable comparison opportunities deterministically.
 */
function generateOpportunities(
  subject: NormalizedPlugin,
  competitors: readonly NormalizedPlugin[],
  features: readonly FeatureComparison[],
  tags: PluginComparison['tags']
): ComparisonOpportunity[] {
  const opportunities: ComparisonOpportunity[] = [];

  // 1. Feature opportunities: Competitors have a confirmed feature that subject does not
  for (const feature of features) {
    if (feature.subjectStatus === 'present') continue;

    const competitorsWithFeature = feature.competitors.filter((c) => c.status === 'present');
    if (competitorsWithFeature.length === 0) continue;

    const evidenceSlugs = competitorsWithFeature.map((c) => c.slug).sort();
    const isAbsenceConfirmed = feature.subjectStatus === 'absent';
    const isWidespread =
      competitorsWithFeature.length >= 2 ||
      competitorsWithFeature.length === competitors.length;

    opportunities.push({
      id: `opp-feature-${feature.featureId}`,
      category: 'feature',
      title: `Adopt ${feature.featureName}`,
      reason: `Offered by ${evidenceSlugs.join(', ')}, but not detected in subject plugin.`,
      impact: isWidespread ? 'high' : 'medium',
      confidence: isAbsenceConfirmed ? 'high' : 'medium',
      evidenceSlugs,
      evidence: competitorsWithFeature.flatMap((c) =>
        c.evidence.map((e) => ({
          slug: c.slug,
          field: e.field,
          detail: e.snippet || e.matchedText,
        }))
      ),
    });
  }

  // 2. Tag intelligence opportunities: Missing tags used by multiple competitors
  for (const competitorTag of tags.competitorOnly) {
    const isRecommended =
      competitorTag.usedBy.length >= 2 ||
      (competitors.length === 1 && competitorTag.usedBy.length >= 1);

    if (isRecommended) {
      const tagSlug = normalizeTagSlug(competitorTag.tag);
      opportunities.push({
        id: `opp-tag-${tagSlug}`,
        category: 'tag',
        title: `Consider tag "${competitorTag.tag}"`,
        reason: `Used by competitors (${competitorTag.usedBy.join(', ')}) but omitted from subject tags.`,
        impact: competitorTag.usedBy.length >= 2 ? 'medium' : 'low',
        confidence: 'high',
        evidenceSlugs: [...competitorTag.usedBy],
      });
    }
  }

  // 3. Compatibility opportunities: Competitor tested up to a newer WordPress release
  const higherTestedCompetitors = competitors.filter(
    (c) => compareVersions(c.testedWordPress, subject.testedWordPress) > 0
  );
  if (higherTestedCompetitors.length > 0) {
    const evidenceSlugs = higherTestedCompetitors.map((c) => c.slug).sort();
    const highestTested = higherTestedCompetitors
      .map((c) => c.testedWordPress)
      .filter(Boolean)
      .sort((a, b) => compareVersions(b, a))[0];

    opportunities.push({
      id: 'opp-compat-tested-wp',
      category: 'compatibility',
      title: 'Update Tested WordPress Version',
      reason: `Competitors (${evidenceSlugs.join(', ')}) test up to WordPress ${highestTested}, while subject is tested up to ${subject.testedWordPress || 'unspecified'}.`,
      impact: 'medium',
      confidence: 'high',
      evidenceSlugs,
    });
  }

  // 4. Maintenance opportunities: Subject is stale/aging while competitors are fresh
  if (subject.freshness === 'stale' || subject.freshness === 'aging') {
    const freshCompetitors = competitors.filter((c) => c.freshness === 'fresh');
    if (freshCompetitors.length > 0) {
      const evidenceSlugs = freshCompetitors.map((c) => c.slug).sort();
      opportunities.push({
        id: 'opp-maintenance-freshness',
        category: 'maintenance',
        title: 'Refresh Plugin Release',
        reason: `Subject plugin was last updated ${subject.lastUpdatedRelative}, while active competitors have fresh updates within the last 30 days.`,
        impact: 'high',
        confidence: 'high',
        evidenceSlugs,
      });
    }
  }

  // 5. Support resolution opportunities
  if (
    subject.supportThreads >= 5 &&
    (subject.supportResolutionRate ?? 0) < 70
  ) {
    const highSupportCompetitors = competitors.filter(
      (c) => c.supportThreads >= 5 && (c.supportResolutionRate ?? 0) >= 85
    );
    if (highSupportCompetitors.length > 0) {
      const evidenceSlugs = highSupportCompetitors.map((c) => c.slug).sort();
      opportunities.push({
        id: 'opp-support-resolution',
        category: 'support',
        title: 'Improve Support Forum Resolution Rate',
        reason: `Subject resolves ${subject.supportResolutionRate ?? 0}% of support threads, compared to competitors achieving 85%+ resolution.`,
        impact: 'medium',
        confidence: 'medium',
        evidenceSlugs,
      });
    }
  }

  // Deterministic sorting:
  // 1. Impact desc (high > medium > low)
  // 2. Confidence desc (high > medium > low)
  // 3. Category priority (feature > tag > compatibility > maintenance > support > trust)
  // 4. Alphabetical tie-breaker on ID
  const IMPACT_WEIGHT = { high: 3, medium: 2, low: 1 };
  const CONFIDENCE_WEIGHT = { high: 3, medium: 2, low: 1 };
  const CATEGORY_ORDER: Record<string, number> = {
    feature: 1,
    tag: 2,
    compatibility: 3,
    maintenance: 4,
    support: 5,
    rating: 6,
    trust: 7,
  };

  opportunities.sort((a, b) => {
    const impactDiff = IMPACT_WEIGHT[b.impact] - IMPACT_WEIGHT[a.impact];
    if (impactDiff !== 0) return impactDiff;

    const confDiff = CONFIDENCE_WEIGHT[b.confidence] - CONFIDENCE_WEIGHT[a.confidence];
    if (confDiff !== 0) return confDiff;

    const catDiff = (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99);
    if (catDiff !== 0) return catDiff;

    return a.id.localeCompare(b.id);
  });

  return opportunities;
}

/**
 * Produces a deterministic head-to-head comparison model between a subject plugin
 * and up to three competitor plugins.
 *
 * Requirements:
 * - Pure computation with zero DOM or network dependencies.
 * - Deterministic output order for identical inputs.
 * - Evidence tracking for every confirmed feature.
 * - Explicit sample counts and insufficient_data handling for ratings and support.
 * - No recent-growth, rising, or declining claims.
 */
export function comparePlugins(
  subject: NormalizedPlugin,
  competitors: readonly NormalizedPlugin[],
  customDictionary?: readonly FeatureDefinition[],
  momentumBySlug?: Record<string, PluginMomentum>
): PluginComparison {
  if (!subject) {
    throw new Error('A valid subject plugin is required for comparison.');
  }

  const safeCompetitors = Array.isArray(competitors) ? competitors : [];
  const dictionary = resolveFeatureDictionary([subject, ...safeCompetitors], customDictionary);

  // 1. Tag intelligence
  const tags = compareTags(subject, safeCompetitors);

  // 2. Feature comparison
  const features: FeatureComparison[] = dictionary.map((feature) => {
    const subjectExtraction = extractFeatureForPlugin(subject, feature);
    const competitorExtractions = safeCompetitors.map((comp) => {
      const extraction = extractFeatureForPlugin(comp, feature);
      return {
        slug: comp.slug || comp.name,
        status: extraction.status,
        evidence: extraction.evidence,
      };
    });

    return {
      featureId: feature.id,
      featureName: feature.name,
      category: feature.category,
      description: feature.description,
      subjectStatus: subjectExtraction.status,
      subjectEvidence: subjectExtraction.evidence,
      competitors: competitorExtractions,
    };
  });

  // 3. Compatibility rows
  const compatibility = buildCompatibilityRows(subject, safeCompetitors);

  // 4. Maintenance rows
  const maintenance = buildMaintenanceRows(subject, safeCompetitors);

  // 5. Trust rows (ratings, support, installs, lifetime pace, observed momentum)
  const trust = buildTrustRows(subject, safeCompetitors, momentumBySlug);

  // 6. Strategic opportunities
  const opportunities = generateOpportunities(subject, safeCompetitors, features, tags);

  return {
    subject,
    competitors: [...safeCompetitors],
    tags,
    features,
    compatibility,
    maintenance,
    trust,
    opportunities,
  };
}
