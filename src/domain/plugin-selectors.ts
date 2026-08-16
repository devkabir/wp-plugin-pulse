import type { AppState, NormalizedPlugin } from './plugin-types';

export function selectVisiblePlugins(state: AppState): NormalizedPlugin[] {
  const query = state.query.trim().toLocaleLowerCase();
  const filtered = query
    ? state.plugins.filter((plugin) => [plugin.name, plugin.slug, plugin.authorName, plugin.shortDescription, ...plugin.tags]
      .some((value) => value.toLocaleLowerCase().includes(query)))
    : [...state.plugins];

  return filtered.sort((left, right) => {
    let result: number;
    switch (state.sortKey) {
      case 'name': result = left.name.localeCompare(right.name); break;
      case 'estimatedInstallsPerDay': result = left.estimatedInstallsPerDay - right.estimatedInstallsPerDay; break;
      case 'activeInstalls': result = left.activeInstalls - right.activeInstalls; break;
      case 'ratingScore': result = left.ratingScore - right.ratingScore; break;
      case 'supportResolution': result = (left.supportResolutionRate ?? -1) - (right.supportResolutionRate ?? -1); break;
      case 'lastUpdated': result = (Date.parse(left.lastUpdatedAt ?? '') || 0) - (Date.parse(right.lastUpdatedAt ?? '') || 0); break;
    }
    return (state.sortDirection === 'asc' ? result : -result) || left.name.localeCompare(right.name);
  });
}
