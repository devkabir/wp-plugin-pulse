import type { FreshnessCategory } from './plugin-types';

const MILLISECONDS_PER_DAY = 86_400_000;

export function estimatedInstallsPerDay(activeInstalls: number, addedAt: string | null, now = Date.now()): {
  daysSinceAdded: number;
  estimate: number;
} {
  if (!addedAt) return { daysSinceAdded: 0, estimate: 0 };

  const addedTime = Date.parse(addedAt);
  if (!Number.isFinite(addedTime)) return { daysSinceAdded: 0, estimate: 0 };

  const daysSinceAdded = Math.max(1, Math.floor((now - addedTime) / MILLISECONDS_PER_DAY));
  return {
    daysSinceAdded,
    estimate: activeInstalls / daysSinceAdded,
  };
}

export function supportResolutionRate(total: number, resolved: number): number | null {
  if (total <= 0) return null;
  return Math.min(100, Math.max(0, (resolved / total) * 100));
}

export function freshnessFor(lastUpdatedAt: string | null, now = Date.now()): FreshnessCategory {
  if (!lastUpdatedAt) return 'unknown';
  const updatedTime = Date.parse(lastUpdatedAt);
  if (!Number.isFinite(updatedTime)) return 'unknown';
  const days = Math.max(0, (now - updatedTime) / MILLISECONDS_PER_DAY);
  if (days <= 90) return 'fresh';
  if (days <= 180) return 'moderate';
  if (days <= 365) return 'aging';
  return 'stale';
}

export function relativeUpdatedLabel(lastUpdatedAt: string | null, now = Date.now()): string {
  if (!lastUpdatedAt) return 'Unknown';
  const updatedTime = Date.parse(lastUpdatedAt);
  if (!Number.isFinite(updatedTime)) return 'Unknown';
  const days = Math.max(0, Math.floor((now - updatedTime) / MILLISECONDS_PER_DAY));
  if (days === 0) return 'Today';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
