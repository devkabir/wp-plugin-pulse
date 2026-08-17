import type { NormalizedPlugin, PluginSnapshot, RawPluginRecord } from './plugin-types';

/**
 * Fast 64-bit deterministic hash (cyrb53-variant) returning a 16-character hexadecimal string.
 * Synchronous, platform-independent, and pure.
 */
export function computeDeterministicHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`;
}

export interface ContentHashInput {
  slug: string;
  version?: string;
  testedWordPress?: string | null;
  requiresWordPress?: string | null;
  requiresPhp?: string | null;
  tags?: string[];
  shortDescription?: string;
  description?: string | null;
  lastUpdatedAt?: string | null;
}

/**
 * Computes a normalized hash representing description, tags, version, and compatibility.
 * Normalized fields are trimmed, tags sorted alphabetically, and nulls standardized.
 */
export function computeContentHash(input: ContentHashInput): string {
  const normalizedTags = Array.isArray(input.tags)
    ? [...input.tags].map((t) => t.trim().toLowerCase()).sort()
    : [];

  const canonicalPayload = JSON.stringify({
    slug: input.slug.trim().toLowerCase(),
    version: (input.version ?? '').trim(),
    testedWordPress: input.testedWordPress?.trim() || null,
    requiresWordPress: input.requiresWordPress?.trim() || null,
    requiresPhp: input.requiresPhp?.trim() || null,
    tags: normalizedTags,
    shortDescription: (input.shortDescription ?? '').trim().replace(/\s+/g, ' '),
    description: (input.description ?? '').trim().replace(/\s+/g, ' '),
    lastUpdatedAt: input.lastUpdatedAt?.trim() || null,
  });

  return computeDeterministicHash(canonicalPayload);
}

/**
 * Extracts a UTC calendar date string (YYYY-MM-DD) from an ISO timestamp.
 */
export function extractSnapshotDateKey(observedAt: string): string {
  const parsed = Date.parse(observedAt);
  if (!Number.isFinite(parsed)) {
    return observedAt.slice(0, 10);
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

export interface SnapshotCreationOptions {
  observedAt?: string;
  contentHash?: string;
  tags?: string[];
  description?: string | null;
  requiresWordPress?: string | null;
  requiresPhp?: string | null;
}

/**
 * Creates a valid PluginSnapshot from a NormalizedPlugin or RawPluginRecord.
 * Retains raw reported numbers without interpolation.
 */
export function createPluginSnapshot(
  plugin: NormalizedPlugin | RawPluginRecord,
  options: SnapshotCreationOptions = {}
): PluginSnapshot {
  const observedAt = options.observedAt ?? new Date().toISOString();

  // Handle NormalizedPlugin vs RawPluginRecord
  if ('authorName' in plugin) {
    // NormalizedPlugin
    const contentHash =
      options.contentHash ??
      computeContentHash({
        slug: plugin.slug,
        version: plugin.version,
        testedWordPress: plugin.testedWordPress,
        requiresWordPress: options.requiresWordPress ?? plugin.requiresWordPress,
        requiresPhp: options.requiresPhp ?? plugin.requiresPhp,
        tags: options.tags ?? plugin.tags,
        shortDescription: plugin.shortDescription,
        description: options.description ?? plugin.description,
        lastUpdatedAt: plugin.lastUpdatedAt,
      });

    return {
      slug: plugin.slug,
      observedAt,
      activeInstalls: plugin.activeInstalls,
      downloaded: plugin.lifetimeDownloads,
      rating: plugin.ratingPercent,
      ratingCount: plugin.ratingCount,
      supportThreads: plugin.supportThreads,
      supportThreadsResolved: plugin.supportThreadsResolved,
      version: plugin.version,
      testedWordPress: plugin.testedWordPress,
      lastUpdatedAt: plugin.lastUpdatedAt,
      contentHash,
    };
  }

  // RawPluginRecord
  const slug = typeof plugin.slug === 'string' ? plugin.slug.trim() : '';
  const version = typeof plugin.version === 'string' ? plugin.version.trim() : '0.0.0';
  const activeInstalls =
    typeof plugin.active_installs === 'number'
      ? plugin.active_installs
      : Number(plugin.active_installs) || 0;
  const downloaded =
    typeof plugin.downloaded === 'number' ? plugin.downloaded : Number(plugin.downloaded) || 0;
  const rating = typeof plugin.rating === 'number' ? plugin.rating : Number(plugin.rating) || 0;
  const ratingCount =
    typeof plugin.num_ratings === 'number' ? plugin.num_ratings : Number(plugin.num_ratings) || 0;
  const supportThreads =
    typeof plugin.support_threads === 'number'
      ? plugin.support_threads
      : Number(plugin.support_threads) || 0;
  const supportThreadsResolved =
    typeof plugin.support_threads_resolved === 'number'
      ? plugin.support_threads_resolved
      : Number(plugin.support_threads_resolved) || 0;
  const testedWordPress =
    typeof plugin.tested === 'string' && plugin.tested.trim() ? plugin.tested.trim() : null;
  const requiresWordPress =
    typeof plugin.requires === 'string' && plugin.requires.trim() ? plugin.requires.trim() : null;
  const requiresPhp =
    typeof plugin.requires_php === 'string' && plugin.requires_php.trim()
      ? plugin.requires_php.trim()
      : null;
  const lastUpdatedAt =
    typeof plugin.last_updated === 'string' && plugin.last_updated.trim()
      ? plugin.last_updated.trim()
      : null;

  let tagsArray: string[] = [];
  if (Array.isArray(plugin.tags)) {
    tagsArray = plugin.tags.filter((t): t is string => typeof t === 'string');
  } else if (plugin.tags && typeof plugin.tags === 'object') {
    tagsArray = Object.values(plugin.tags).filter((t): t is string => typeof t === 'string');
  }

  const contentHash =
    options.contentHash ??
    computeContentHash({
      slug,
      version,
      testedWordPress,
      requiresWordPress,
      requiresPhp,
      tags: options.tags ?? tagsArray,
      shortDescription: typeof plugin.short_description === 'string' ? plugin.short_description : '',
      description:
        options.description ?? (typeof plugin.description === 'string' ? plugin.description : null),
      lastUpdatedAt,
    });

  return {
    slug,
    observedAt,
    activeInstalls: Math.max(0, activeInstalls),
    downloaded: Math.max(0, downloaded),
    rating: Math.max(0, Math.min(100, rating)),
    ratingCount: Math.max(0, ratingCount),
    supportThreads: Math.max(0, supportThreads),
    supportThreadsResolved: Math.max(0, supportThreadsResolved),
    version,
    testedWordPress,
    lastUpdatedAt,
    contentHash,
  };
}

/**
 * Deduplicates identical snapshots by slug / calendar date (UTC) / content hash.
 * If multiple snapshots exist for the same slug, date, and content hash with identical numbers,
 * only the latest observation is kept.
 * Returns observations sorted chronologically.
 */
export function deduplicateSnapshots(snapshots: readonly PluginSnapshot[]): PluginSnapshot[] {
  if (snapshots.length === 0) return [];

  // Sort by observedAt ascending
  const sorted = [...snapshots].sort((a, b) => {
    const timeA = Date.parse(a.observedAt);
    const timeB = Date.parse(b.observedAt);
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }
    return a.observedAt.localeCompare(b.observedAt);
  });

  const seen = new Map<string, PluginSnapshot>();

  for (const snap of sorted) {
    const dateKey = extractSnapshotDateKey(snap.observedAt);
    const dedupeKey = `${snap.slug}:${dateKey}:${snap.contentHash}:${snap.activeInstalls}:${snap.downloaded}:${snap.rating}:${snap.ratingCount}:${snap.supportThreads}:${snap.supportThreadsResolved}`;
    seen.set(dedupeKey, snap);
  }

  return Array.from(seen.values()).sort((a, b) => {
    const timeA = Date.parse(a.observedAt);
    const timeB = Date.parse(b.observedAt);
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }
    return a.observedAt.localeCompare(b.observedAt);
  });
}

/**
 * Interface for Snapshot storage implementations.
 */
export interface SnapshotStore {
  recordSnapshot(snapshot: PluginSnapshot): boolean;
  recordSnapshots(snapshots: PluginSnapshot[]): number;
  getSnapshots(slug: string): PluginSnapshot[];
  getAllWatchedSlugs(): string[];
  clear(slug?: string): void;
  exportJson(): string;
  importJson(json: string): number;
}

/**
 * In-memory / localStorage snapshot storage manager.
 */
export class MemorySnapshotStore implements SnapshotStore {
  private snapshotsBySlug = new Map<string, PluginSnapshot[]>();
  private storageKey: string | null = null;

  constructor(storageKey?: string) {
    if (storageKey) {
      this.storageKey = storageKey;
      this.loadFromStorage();
    }
  }

  public recordSnapshot(snapshot: PluginSnapshot): boolean {
    const slug = snapshot.slug.trim().toLowerCase();
    const existing = this.snapshotsBySlug.get(slug) || [];
    const beforeCount = existing.length;
    const deduplicated = deduplicateSnapshots([...existing, snapshot]);
    this.snapshotsBySlug.set(slug, deduplicated);
    this.saveToStorage();
    return deduplicated.length > beforeCount;
  }

  public recordSnapshots(snapshots: PluginSnapshot[]): number {
    let addedCount = 0;
    for (const snap of snapshots) {
      if (this.recordSnapshot(snap)) {
        addedCount++;
      }
    }
    return addedCount;
  }

  public getSnapshots(slug: string): PluginSnapshot[] {
    const normalizedSlug = slug.trim().toLowerCase();
    return deduplicateSnapshots(this.snapshotsBySlug.get(normalizedSlug) || []);
  }

  public getAllWatchedSlugs(): string[] {
    return Array.from(this.snapshotsBySlug.keys()).sort();
  }

  public clear(slug?: string): void {
    if (slug) {
      this.snapshotsBySlug.delete(slug.trim().toLowerCase());
    } else {
      this.snapshotsBySlug.clear();
    }
    this.saveToStorage();
  }

  public exportJson(): string {
    const obj: Record<string, PluginSnapshot[]> = {};
    for (const [slug, snaps] of this.snapshotsBySlug.entries()) {
      obj[slug] = snaps;
    }
    return JSON.stringify(obj, null, 2);
  }

  public importJson(json: string): number {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null) return 0;
      let count = 0;
      for (const [slug, snaps] of Object.entries(parsed)) {
        if (Array.isArray(snaps)) {
          for (const s of snaps) {
            if (s && typeof s === 'object' && typeof s.observedAt === 'string') {
              const snapshot: PluginSnapshot = {
                slug: slug || s.slug || '',
                observedAt: s.observedAt,
                activeInstalls: Number(s.activeInstalls) || 0,
                downloaded: Number(s.downloaded) || 0,
                rating: Number(s.rating) || 0,
                ratingCount: Number(s.ratingCount) || 0,
                supportThreads: Number(s.supportThreads) || 0,
                supportThreadsResolved: Number(s.supportThreadsResolved) || 0,
                version: String(s.version || '0.0.0'),
                testedWordPress: s.testedWordPress ? String(s.testedWordPress) : null,
                lastUpdatedAt: s.lastUpdatedAt ? String(s.lastUpdatedAt) : null,
                contentHash: String(s.contentHash || ''),
              };
              if (this.recordSnapshot(snapshot)) count++;
            }
          }
        }
      }
      return count;
    } catch {
      return 0;
    }
  }

  private loadFromStorage(): void {
    if (!this.storageKey || typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (raw) {
        this.importJson(raw);
      }
    } catch {
      // Storage unavailable or disabled
    }
  }

  private saveToStorage(): void {
    if (!this.storageKey || typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(this.storageKey, this.exportJson());
    } catch {
      // Storage quota exceeded or disabled
    }
  }
}
