import { PluginRequestError } from '../domain/error-classifier';
import { normalizePluginResponse, normalizeSinglePluginResponse } from '../domain/plugin-normalizer';
import type {
  NormalizedPlugin,
  NormalizedPluginCollection,
  PluginQuery,
} from '../domain/plugin-types';

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
}

function checkOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new PluginRequestError(
      'Network connection unavailable. Please check your internet connection and try again.',
      'network'
    );
  }
}

export async function fetchPluginCollection(
  query: PluginQuery,
  page = 1,
  signal?: AbortSignal
): Promise<NormalizedPluginCollection> {
  checkOnline();

  const endpoint = new URL('/api/plugins', getApiBaseUrl());
  endpoint.searchParams.set('mode', query.mode);
  endpoint.searchParams.set('query', query.value.trim());
  if (query.mode !== 'slug') {
    endpoint.searchParams.set('page', String(page));
  }

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

  if (response.status === 404) {
    throw new PluginRequestError(
      'The requested plugin could not be found.',
      'not_found',
      404
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
    if (query.mode === 'slug') {
      const plugin = normalizeSinglePluginResponse(json);
      return {
        plugins: [plugin],
        page: 1,
        totalPages: 1,
        totalResults: 1,
      };
    }
    return normalizePluginResponse(json);
  } catch (error) {
    throw new PluginRequestError(
      error instanceof Error ? error.message : 'Invalid plugin collection structure.',
      'invalid_response'
    );
  }
}

export async function fetchPluginBySlug(
  slug: string,
  signal?: AbortSignal
): Promise<NormalizedPlugin> {
  checkOnline();

  const endpoint = new URL('/api/plugins', getApiBaseUrl());
  endpoint.searchParams.set('mode', 'slug');
  endpoint.searchParams.set('query', slug.trim());

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

  if (response.status === 404) {
    throw new PluginRequestError(
      'The requested plugin could not be found.',
      'not_found',
      404
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
    return normalizeSinglePluginResponse(json);
  } catch (error) {
    throw new PluginRequestError(
      error instanceof Error ? error.message : 'Invalid plugin record structure.',
      'invalid_response'
    );
  }
}

export async function fetchPlugins(
  tag: string,
  page = 1,
  signal?: AbortSignal
): Promise<NormalizedPluginCollection> {
  return fetchPluginCollection({ mode: 'tag', value: tag }, page, signal);
}


