import type { AppState, NormalizedPlugin, SortDirection, SortKey } from './plugin-types';

/**
 * Filter and sort loaded plugins based on current application state.
 * Returns a new array without mutating the source state.
 */
export function selectVisiblePlugins(state: AppState): NormalizedPlugin[] {
  const query = state.query.trim().toLowerCase();

  const filtered = query
    ? state.plugins.filter((plugin) => {
        const searchableFields = [
          plugin.name,
          plugin.slug,
          plugin.authorName,
          plugin.shortDescription,
          plugin.version,
          plugin.requiresWordPress ?? '',
          plugin.testedWordPress ?? '',
          plugin.requiresPhp ?? '',
          ...plugin.requiredPlugins,
          ...plugin.tags,
        ];
        return searchableFields.some((field) => field.toLowerCase().includes(query));
      })
    : [...state.plugins];

  return sortPlugins(filtered, state.sortKey, state.sortDirection);
}

/**
 * Deterministically sorts a collection of plugins by key and direction.
 * - Unavailable/null values are placed at the end in both ascending and descending order.
 * - Equal values use secondary tie-breakers (plugin name, then slug).
 */
export function sortPlugins(
  plugins: NormalizedPlugin[],
  key: SortKey,
  direction: SortDirection
): NormalizedPlugin[] {
  const isAsc = direction === 'asc';

  return [...plugins].sort((left, right) => {
    let diff = 0;

    switch (key) {
      case 'name':
        diff = left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
        break;

      case 'estimatedInstallsPerDay': {
        const leftHas = left.estimatedInstallsPerDay > 0;
        const rightHas = right.estimatedInstallsPerDay > 0;
        if (!leftHas && !rightHas) {
          diff = 0;
        } else if (!leftHas) {
          return 1; // Unavailable always at bottom
        } else if (!rightHas) {
          return -1; // Unavailable always at bottom
        } else {
          diff = left.estimatedInstallsPerDay - right.estimatedInstallsPerDay;
        }
        break;
      }

      case 'activeInstalls':
        diff = left.activeInstalls - right.activeInstalls;
        break;

      case 'ratingScore': {
        const leftHas = left.ratingCount > 0;
        const rightHas = right.ratingCount > 0;
        if (!leftHas && !rightHas) {
          diff = 0;
        } else if (!leftHas) {
          return 1; // Unrated always at bottom
        } else if (!rightHas) {
          return -1;
        } else {
          diff = left.ratingScore - right.ratingScore;
          if (diff === 0) {
            diff = left.ratingCount - right.ratingCount;
          }
        }
        break;
      }

      case 'supportResolution': {
        const leftRate = left.supportResolutionRate;
        const rightRate = right.supportResolutionRate;
        if (leftRate === null && rightRate === null) {
          diff = 0;
        } else if (leftRate === null) {
          return 1; // No threads always at bottom
        } else if (rightRate === null) {
          return -1;
        } else {
          diff = leftRate - rightRate;
          if (diff === 0) {
            diff = left.supportThreadsResolved - right.supportThreadsResolved;
          }
        }
        break;
      }

      case 'lastUpdated': {
        const leftTime = left.lastUpdatedAt ? Date.parse(left.lastUpdatedAt) : 0;
        const rightTime = right.lastUpdatedAt ? Date.parse(right.lastUpdatedAt) : 0;
        const leftValid = Number.isFinite(leftTime) && leftTime > 0;
        const rightValid = Number.isFinite(rightTime) && rightTime > 0;

        if (!leftValid && !rightValid) {
          diff = 0;
        } else if (!leftValid) {
          return 1;
        } else if (!rightValid) {
          return -1;
        } else {
          diff = leftTime - rightTime;
        }
        break;
      }
    }

    const directedDiff = isAsc ? diff : -diff;
    if (directedDiff !== 0) {
      return directedDiff;
    }

    // Tie breaker 1: Name ascending
    const nameDiff = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    if (nameDiff !== 0) return nameDiff;

    // Tie breaker 2: Slug ascending
    return left.slug.localeCompare(right.slug);
  });
}
