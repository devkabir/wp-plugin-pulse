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

export interface NormalizedPluginCollection {
  plugins: NormalizedPlugin[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export type ErrorKind = 'network' | 'http' | 'invalid_response' | 'unknown';

export interface AppError {
  kind: ErrorKind;
  message: string;
  statusCode?: number;
}

export interface AppState {
  plugins: NormalizedPlugin[];
  activeTag: string;
  query: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
  activeView: ActiveView;
  status: LoadStatus;
  isBackgroundRefreshing: boolean;
  error: AppError | null;
  failedTag: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
  loadedPages: number[];
  loadingMorePage: number | null;
  loadMoreError: { page: number; message: string; error?: AppError } | null;
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
