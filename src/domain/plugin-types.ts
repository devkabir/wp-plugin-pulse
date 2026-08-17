/**
 * Types representing the raw WordPress.org API response and the normalized client domain model.
 */

export interface RawPluginApiResponse {
  info?: {
    page?: number | string;
    pages?: number | string;
    results?: number | string;
  };
  plugins?: RawPluginRecord[];
}

export type QueryMode = 'tag' | 'search' | 'slug';

export type PluginQuery =
  | { mode: 'tag'; value: string }
  | { mode: 'search'; value: string }
  | { mode: 'slug'; value: string };

export type ActiveView = 'table' | 'cards';
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RawPluginRecord {
  name?: string;
  slug?: string;
  version?: string;
  author?: string;
  author_profile?: string;
  requires?: string | boolean | null;
  tested?: string | boolean | null;
  requires_php?: string | boolean | null;
  requires_plugins?: string[] | null;
  rating?: number | string;
  ratings?: Record<string, number | string>;
  num_ratings?: number | string;
  support_threads?: number | string;
  support_threads_resolved?: number | string;
  active_installs?: number | string;
  downloaded?: number | string;
  last_updated?: string;
  added?: string;
  homepage?: string;
  short_description?: string;
  description?: string;
  download_link?: string;
  tags?: Record<string, string> | string[];
  donate_link?: string;
  icons?: {
    '1x'?: string;
    '2x'?: string;
    svg?: string;
    default?: string;
  } | string[];
}

export type FreshnessCategory = 'fresh' | 'moderate' | 'aging' | 'stale' | 'unknown';

export interface NormalizedPlugin {
  name: string;
  slug: string;
  version: string;
  authorName: string;
  authorProfileUrl: string | null;
  homepageUrl: string | null;
  pluginUrl: string;
  downloadUrl: string | null;
  iconUrl: string | null;
  shortDescription: string;
  description?: string | null;
  tags: string[];

  // Adoption metrics
  activeInstalls: number;
  activeInstallsDisplay: string;
  lifetimeDownloads: number;
  lifetimeDownloadsDisplay: string;
  lifetimeInstallPace: number;
  lifetimeInstallPaceDisplay: string;
  daysSinceAdded: number;

  // Rating metrics
  ratingPercent: number; // 0-100
  ratingScore: number; // 0.0 - 5.0
  ratingScoreDisplay: string;
  ratingCount: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };

  // Support metrics
  supportThreads: number;
  supportThreadsResolved: number;
  supportResolutionRate: number | null; // 0-100 or null if 0 threads

  // Maintenance & Compatibility
  addedAt: string | null;
  lastUpdatedAt: string | null;
  lastUpdatedRelative: string;
  freshness: FreshnessCategory;
  requiresWordPress: string | null;
  testedWordPress: string | null;
  requiresPhp: string | null;
  requiredPlugins: string[];
}

export type FeatureSourceField = 'tag' | 'short_description' | 'description';
export type FeatureStatus = 'present' | 'absent' | 'unknown';

export interface FeatureEvidence {
  field: FeatureSourceField;
  matchedText: string;
  snippet?: string;
}

export interface ExtractedFeature {
  featureId: string;
  featureName: string;
  status: FeatureStatus;
  evidence: FeatureEvidence[];
}

export interface FeatureDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  tagSlugs: string[];
  patterns: RegExp[];
}

export interface NormalizedTag {
  slug: string;
  label: string;
}

export interface TagFrequencyItem {
  slug: string;
  label: string;
  count: number;
  pluginSlugs: string[];
}

export interface TagComparison {
  shared: string[];
  subjectOnly: string[];
  competitorOnly: Array<{ tag: string; usedBy: string[] }>;
}

export type ComparisonStatus =
  | 'match'
  | 'advantage'
  | 'disadvantage'
  | 'neutral'
  | 'insufficient_data'
  | 'unknown';

export interface ComparisonValue {
  slug: string;
  raw: string | number | boolean | null | string[];
  display: string;
  sampleCount?: number;
  status?: ComparisonStatus;
  note?: string;
}

export interface ComparisonRow {
  key: string;
  label: string;
  subject: ComparisonValue;
  competitors: ComparisonValue[];
  insight?: string;
}

export interface FeatureComparison {
  featureId: string;
  featureName: string;
  category?: string;
  description: string;
  subjectStatus: FeatureStatus;
  subjectEvidence: FeatureEvidence[];
  competitors: Array<{
    slug: string;
    status: FeatureStatus;
    evidence: FeatureEvidence[];
  }>;
}

export type OpportunityCategory =
  | 'tag'
  | 'feature'
  | 'compatibility'
  | 'maintenance'
  | 'support'
  | 'rating'
  | 'trust';

export type OpportunityImpact = 'high' | 'medium' | 'low';
export type OpportunityConfidence = 'high' | 'medium' | 'low';

export interface ComparisonOpportunity {
  id: string;
  category: OpportunityCategory;
  title: string;
  reason: string;
  impact: OpportunityImpact;
  confidence: OpportunityConfidence;
  evidenceSlugs: string[];
  evidence?: Array<{ slug: string; field?: FeatureSourceField; detail?: string }>;
}

export interface PluginComparison {
  subject: NormalizedPlugin;
  competitors: NormalizedPlugin[];
  tags: {
    shared: string[];
    subjectOnly: string[];
    competitorOnly: Array<{ tag: string; usedBy: string[] }>;
  };
  features: FeatureComparison[];
  compatibility: ComparisonRow[];
  maintenance: ComparisonRow[];
  trust: ComparisonRow[];
  opportunities: ComparisonOpportunity[];
}

export interface NormalizedPluginCollection {
  plugins: NormalizedPlugin[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export type ErrorKind = 'network' | 'http' | 'invalid_response' | 'not_found' | 'unknown';

export interface AppError {
  kind: ErrorKind;
  message: string;
  statusCode?: number;
}

export interface ComparisonState {
  subjectSlug: string | null;
  competitorSlugs: string[];
}

export interface AppState {
  plugins: NormalizedPlugin[];
  activeQuery: PluginQuery;
  query: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
  activeView: ActiveView;
  status: LoadStatus;
  isBackgroundRefreshing: boolean;
  error: AppError | null;
  failedQuery: PluginQuery | null;
  page: number;
  totalPages: number;
  totalResults: number;
  loadedPages: number[];
  loadingMorePage: number | null;
  loadMoreError: { page: number; message: string; error?: AppError } | null;
  comparison: ComparisonState;
}

export interface KpiSummaryMetrics {
  totalLoaded: number;
  totalResults: number;
  totalPages: number;
  loadedPagesCount: number;
  isFullyLoaded: boolean;
  totalReportedInstalls: number;
  totalReportedInstallsDisplay: string;
  totalLifetimeDownloads: number;
  totalLifetimeDownloadsDisplay: string;
  topLifetimeInstallPaceLeader: {
    name: string;
    slug: string;
    lifetimeInstallPace: number;
    lifetimeInstallPaceDisplay: string;
    /** Active installs of this leader plugin */
    activeInstalls: number;
    activeInstallsDisplay: string;
  } | null;
  /** Share of total active installs held by the #1 plugin (0–100), or null */
  dominantPluginInstallShare: number | null;
  weightedCommunityRating: number | null;
  weightedCommunityRatingDisplay: string;
  overallSupportResolutionRate: number | null;
  overallSupportResolutionRateDisplay: string;
  recentlyUpdatedCount: number; // Updated within 6 months
  recentlyUpdatedPercent: number;
  /** Plugins not updated in 12+ months — potential gap opportunities */
  staleCount: number;
}

export type SortKey =
  | 'name'
  | 'lifetimeInstallPace'
  | 'activeInstalls'
  | 'ratingScore'
  | 'supportResolution'
  | 'lastUpdated';

export type SortDirection = 'asc' | 'desc';

/**
 * Historical snapshot representing an observed state of a plugin at a point in time.
 */
export interface PluginSnapshot {
  slug: string;
  observedAt: string;
  activeInstalls: number;
  downloaded: number;
  rating: number;
  ratingCount: number;
  supportThreads: number;
  supportThreadsResolved: number;
  version: string;
  testedWordPress: string | null;
  lastUpdatedAt: string | null;
  contentHash: string;
}

export type MomentumConfidence = 'high' | 'medium' | 'low';
export type MomentumDirection = 'rising' | 'declining' | 'flat' | 'insufficient_data';
export type TrajectoryDirection = 'rising' | 'declining' | 'flat';

export interface SnapshotGap {
  startDate: string;
  endDate: string;
  gapDays: number;
  missingDaysCount: number;
}

export interface BandTransition {
  from: number;
  to: number;
  crossed: boolean;
  direction: TrajectoryDirection;
}

export interface PluginMomentum {
  slug: string;
  hasSufficientData: boolean;
  status: 'ready' | 'insufficient_observations' | 'insufficient_interval';
  reason?: string;
  startSnapshot: PluginSnapshot | null;
  endSnapshot: PluginSnapshot | null;
  observationCount: number;
  startObservationDate: string | null;
  endObservationDate: string | null;
  intervalDays: number;

  // Deltas
  activeInstallsDelta: number;
  bandTransition: BandTransition;
  downloadedDelta: number;
  downloadPacePerDay: number;
  downloadPacePerDayDisplay: string;
  ratingDelta: number;
  ratingCountDelta: number;
  supportThreadsDelta: number;
  supportThreadsResolvedDelta: number;
  supportResolutionRateDelta: number | null;

  // Tracked changes
  versionChanged: boolean;
  previousVersion: string | null;
  currentVersion: string | null;
  testedWordPressChanged: boolean;
  previousTestedWordPress: string | null;
  currentTestedWordPress: string | null;
  contentChanged: boolean;

  // Meaningful trajectories
  direction: MomentumDirection;
  activeInstallsTrajectory: TrajectoryDirection;
  downloadTrajectory: TrajectoryDirection;
  ratingTrajectory: TrajectoryDirection;

  // Precision and confidence
  confidence: MomentumConfidence;
  confidenceScore: number;
  confidenceReason: string;

  // Observation cadence & gaps
  hasGaps: boolean;
  gaps: SnapshotGap[];
  maxGapDays: number;
  expectedObservations: number;
  actualObservations: number;
  coverageRatio: number;
}
