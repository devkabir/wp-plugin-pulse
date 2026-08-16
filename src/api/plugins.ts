import { PluginRequestError } from '../domain/error-classifier';
import { normalizePluginResponse } from '../domain/plugin-normalizer';
import type { NormalizedPluginCollection } from '../domain/plugin-types';

export async function fetchPlugins(tag: string, page = 1, signal?: AbortSignal): Promise<NormalizedPluginCollection> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new PluginRequestError(
      'Network connection unavailable. Please check your internet connection and try again.',
      'network'
    );
  }

  const endpoint = new URL('/api/plugins', window.location.origin);
  endpoint.searchParams.set('tag', tag);
  endpoint.searchParams.set('page', String(page));

  let response: Response;
  try {
    response = await fetch(endpoint, { signal });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new PluginRequestError(
      'Network connection error. Unable to reach the WordPress.org API.',
      'network'
    );
  }

  if (!response.ok) {
    throw new PluginRequestError(
      `Plugin request failed with HTTP ${response.status}. Please try again.`,
      'http',
      response.status
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new PluginRequestError(
      'Received an invalid or malformed response from the WordPress.org Plugin API.',
      'invalid_response'
    );
  }

  try {
    return normalizePluginResponse(json);
  } catch (error) {
    throw new PluginRequestError(
      error instanceof Error ? error.message : 'Invalid plugin collection structure.',
      'invalid_response'
    );
  }
}

