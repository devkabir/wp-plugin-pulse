import { decodeHtmlEntities } from '../utils/decode-html-entities';
import { freshnessFor, lifetimeInstallPace, relativeUpdatedLabel, supportResolutionRate } from './plugin-metrics';
import type { NormalizedPlugin, NormalizedPluginCollection, RawPluginApiResponse, RawPluginRecord } from './plugin-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function integer(value: unknown, fallback: number): number {
  const number = nonNegativeNumber(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? decodeHtmlEntities(value).trim() : fallback;
}

/**
 * WordPress.org returns last_updated as a non-ISO string like "2026-08-12 9:48am GMT".
 * Date.parse() returns NaN for this format in all environments, so we normalise it first.
 */
function parseWordPressDate(value: string): number {
  // Fast path: already ISO-parseable (e.g. "2016-03-14")
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;

  // Slow path: "YYYY-MM-DD h:mmam GMT" or "YYYY-MM-DD h:mmpm GMT"
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(am|pm)\s+GMT$/i,
  );
  if (!match) return NaN;
  let hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  const isPm = match[4].toLowerCase() === 'pm';
  if (isPm && hours !== 12) hours += 12;
  if (!isPm && hours === 12) hours = 0;
  const iso = `${match[1]}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`;
  return Date.parse(iso);
}

function date(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ms = parseWordPressDate(value);
  if (!Number.isFinite(ms)) return null;
  // Normalise to ISO so downstream consumers always get a consistent format
  return new Date(ms).toISOString();
}

function url(value: unknown, allowedHosts?: string[]): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (allowedHosts && !allowedHosts.includes(parsed.hostname)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function normalizeTags(value: RawPluginRecord['tags']): string[] {
  const tags = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  return [...new Set(tags.map((tag) => text(tag)).filter(Boolean))];
}

function normalizePlugin(raw: RawPluginRecord, now: number): NormalizedPlugin {
  const slug = text(raw.slug);
  const activeInstalls = nonNegativeNumber(raw.active_installs);
  const lifetimeDownloads = nonNegativeNumber(raw.downloaded);
  const ratingPercent = Math.min(100, nonNegativeNumber(raw.rating));
  const supportThreads = nonNegativeNumber(raw.support_threads);
  const supportThreadsResolved = nonNegativeNumber(raw.support_threads_resolved);
  const addedAt = date(raw.added);
  const lastUpdatedAt = date(raw.last_updated);
  const pace = lifetimeInstallPace(activeInstalls, addedAt, now);
  const ratings = isRecord(raw.ratings) ? raw.ratings : {};
  const icons = isRecord(raw.icons) ? raw.icons : {};

  return {
    name: text(raw.name, 'Untitled plugin') || 'Untitled plugin',
    slug,
    version: text(raw.version, 'Unknown') || 'Unknown',
    authorName: text(raw.author, 'Unknown author') || 'Unknown author',
    authorProfileUrl: url(raw.author_profile, ['profiles.wordpress.org']),
    homepageUrl: url(raw.homepage),
    pluginUrl: slug ? `https://wordpress.org/plugins/${encodeURIComponent(slug)}/` : 'https://wordpress.org/plugins/',
    downloadUrl: url(raw.download_link, ['downloads.wordpress.org']),
    iconUrl: url(icons.svg) ?? url(icons['2x']) ?? url(icons['1x']) ?? url(icons.default),
    shortDescription: text(raw.short_description),
    tags: normalizeTags(raw.tags),
    activeInstalls,
    activeInstallsDisplay: activeInstalls.toLocaleString(),
    lifetimeDownloads,
    lifetimeDownloadsDisplay: lifetimeDownloads.toLocaleString(),
    lifetimeInstallPace: pace.pace,
    lifetimeInstallPaceDisplay: pace.pace.toFixed(1),
    daysSinceAdded: pace.daysSinceAdded,
    ratingPercent,
    ratingScore: ratingPercent / 20,
    ratingScoreDisplay: (ratingPercent / 20).toFixed(1),
    ratingCount: nonNegativeNumber(raw.num_ratings),
    ratingDistribution: {
      1: nonNegativeNumber(ratings['1']),
      2: nonNegativeNumber(ratings['2']),
      3: nonNegativeNumber(ratings['3']),
      4: nonNegativeNumber(ratings['4']),
      5: nonNegativeNumber(ratings['5']),
    },
    supportThreads,
    supportThreadsResolved,
    supportResolutionRate: supportResolutionRate(supportThreads, supportThreadsResolved),
    addedAt,
    lastUpdatedAt,
    lastUpdatedRelative: relativeUpdatedLabel(lastUpdatedAt, now),
    freshness: freshnessFor(lastUpdatedAt, now),
    requiresWordPress: text(raw.requires) || null,
    testedWordPress: text(raw.tested) || null,
    requiresPhp: text(raw.requires_php) || null,
    requiredPlugins: Array.isArray(raw.requires_plugins)
      ? raw.requires_plugins.map((item) => text(item)).filter(Boolean)
      : [],
  };
}

export function normalizeSinglePluginResponse(value: unknown, now = Date.now()): NormalizedPlugin {
  if (!isRecord(value)) {
    throw new Error('Plugin request returned an invalid plugin record.');
  }
  if (value.error) {
    throw new Error(typeof value.error === 'string' ? value.error : 'Plugin not found.');
  }
  const slug = text(value.slug);
  if (!slug) {
    throw new Error('Plugin record is missing a valid slug.');
  }

  return normalizePlugin(value as RawPluginRecord, now);
}

export function normalizePluginResponse(value: unknown, now = Date.now()): NormalizedPluginCollection {
  if (!isRecord(value) || !Array.isArray(value.plugins)) {
    throw new Error('Plugin request returned an invalid plugin collection.');
  }
  if (!isRecord(value.info)) {
    throw new Error('Plugin request returned invalid pagination metadata.');
  }

  const response = value as RawPluginApiResponse;
  const page = integer(response.info?.page, 1);
  const totalPages = integer(response.info?.pages, 1);
  const totalResults = Math.max(value.plugins.length, nonNegativeNumber(response.info?.results));

  return {
    plugins: value.plugins.map((plugin) => normalizePlugin(isRecord(plugin) ? plugin as RawPluginRecord : {}, now)),
    page,
    totalPages: Math.max(page, totalPages),
    totalResults,
  };
}

