import type { WordPressReleaseInfo } from './recommendations';

/**
 * Validates whether a version string is a valid WordPress version format
 * (e.g. "6.6", "6.7.1", "6.8-RC1").
 */
export function isValidWordPressVersion(version: string | null | undefined): boolean {
  if (!version || typeof version !== 'string') return false;
  const trimmed = version.trim();
  return /^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/.test(trimmed);
}

/**
 * Normalizes version string to comparable numeric tuples (e.g. "6.7.1" -> [6, 7, 1]).
 * Strips pre-release suffixes like "-RC1" for numeric comparison.
 */
export function parseVersionParts(version: string): { parts: number[]; isPreRelease: boolean } {
  const trimmed = version.trim();
  const isPreRelease = /-[a-zA-Z0-9.]+$/.test(trimmed);
  const cleanVersion = trimmed.replace(/-[a-zA-Z0-9.]+$/, '');
  const parts = cleanVersion.split('.').map((p) => parseInt(p, 10) || 0);
  return { parts, isPreRelease };
}

/**
 * Compares two WordPress version strings safely (e.g. "6.6" vs "6.7.1").
 * Returns:
 *  > 0 if a > b
 *  < 0 if a < b
 *  0 if equal
 */
export function compareWordPressVersions(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const parsedA = parseVersionParts(a);
  const parsedB = parseVersionParts(b);
  const maxLen = Math.max(parsedA.parts.length, parsedB.parts.length);

  for (let i = 0; i < maxLen; i++) {
    const valA = parsedA.parts[i] ?? 0;
    const valB = parsedB.parts[i] ?? 0;
    if (valA !== valB) return valA - valB;
  }

  // If numeric parts are equal, stable release is newer than pre-release of the same version
  if (parsedA.isPreRelease && !parsedB.isPreRelease) return -1;
  if (!parsedA.isPreRelease && parsedB.isPreRelease) return 1;

  return 0;
}

export interface VersionCheckOutcome {
  status: 'checked' | 'not checked';
  exceedsStable: boolean;
  maxAllowedVersion?: string;
  reason?: string;
}

/**
 * Evaluates whether a plugin's "Tested up to" version is within current WordPress releases.
 * If release information is missing, returns status: 'not checked'.
 */
export function checkTestedUpToCurrentness(
  testedVersion: string | null | undefined,
  releaseInfo?: WordPressReleaseInfo | null
): VersionCheckOutcome {
  if (!releaseInfo || !releaseInfo.currentStable) {
    return {
      status: 'not checked',
      exceedsStable: false,
      reason: 'WordPress release information is unavailable.',
    };
  }

  if (!testedVersion || !isValidWordPressVersion(testedVersion)) {
    return {
      status: 'checked',
      exceedsStable: false,
      reason: 'Tested up to version is missing or invalid.',
    };
  }

  // Allowed ceiling is either current RC (if present) or current stable
  const ceilingVersion = releaseInfo.currentRc && compareWordPressVersions(releaseInfo.currentRc, releaseInfo.currentStable) > 0
    ? releaseInfo.currentRc
    : releaseInfo.currentStable;

  const exceedsStable = compareWordPressVersions(testedVersion, ceilingVersion) > 0;

  return {
    status: 'checked',
    exceedsStable,
    maxAllowedVersion: ceilingVersion,
    reason: exceedsStable
      ? `Tested version ${testedVersion} is higher than the current release/RC (${ceilingVersion}).`
      : undefined,
  };
}

/**
 * Safely parses and normalizes WordPress release info payload with cache metadata.
 */
export function parseWordPressReleaseInfo(data: unknown): WordPressReleaseInfo | null {
  if (!data || typeof data !== 'object') return null;

  const candidate = data as Record<string, unknown>;
  if (typeof candidate.currentStable !== 'string' || !candidate.currentStable.trim()) {
    return null;
  }

  return {
    currentStable: candidate.currentStable.trim(),
    currentRc: typeof candidate.currentRc === 'string' ? candidate.currentRc.trim() : null,
    minimumSupported: typeof candidate.minimumSupported === 'string' ? candidate.minimumSupported.trim() : undefined,
    checkedAt: typeof candidate.checkedAt === 'string' ? candidate.checkedAt : new Date().toISOString(),
    isStale: typeof candidate.isStale === 'boolean' ? candidate.isStale : false,
  };
}
