import { normalizePluginResponse } from '../domain/plugin-normalizer';
import type { NormalizedPluginCollection } from '../domain/plugin-types';

export async function fetchPlugins(tag: string, page = 1, signal?: AbortSignal): Promise<NormalizedPluginCollection> {
  const endpoint = new URL('/api/plugins', window.location.origin);
  endpoint.searchParams.set('tag', tag);
  endpoint.searchParams.set('page', String(page));

  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new Error(`Plugin request failed with status ${response.status}.`);
  return normalizePluginResponse(await response.json());
}
