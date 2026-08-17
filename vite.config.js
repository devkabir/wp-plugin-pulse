import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const CACHE_ROOT = resolve('.cache/plugins');
const API_PATH = '/api/plugins';
const pendingRequests = new Map();

export const COLLECTION_FIELDS = {
  description: 1,
  sections: 1,
  tested: 1,
  requires: 1,
  rating: 1,
  ratings: 1,
  downloaded: 1,
  downloadlink: 1,
  last_updated: 1,
  added: 1,
  tags: 1,
  compatibility: 1,
  homepage: 1,
  donate_link: 1,
  icons: 1,
  short_description: 1,
  requires_php: 1,
  requires_plugins: 1,
  support_threads: 1,
  support_threads_resolved: 1,
  active_installs: 1,
};

export const SLUG_FIELDS = {
  description: 1,
  sections: 1,
  tested: 1,
  requires: 1,
  rating: 1,
  ratings: 1,
  downloaded: 1,
  downloadlink: 1,
  last_updated: 1,
  added: 1,
  tags: 1,
  compatibility: 1,
  homepage: 1,
  donate_link: 1,
  icons: 1,
  short_description: 1,
  requires_php: 1,
  requires_plugins: 1,
  support_threads: 1,
  support_threads_resolved: 1,
  active_installs: 1,
};

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function cacheFileFor(mode, query, page = 1) {
  const fields = mode === 'slug' ? SLUG_FIELDS : COLLECTION_FIELDS;
  const normalizedQuery = query.toLowerCase().trim();
  const readable = normalizedQuery
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'query';

  const hashPayload = JSON.stringify({
    mode,
    query: normalizedQuery,
    page: mode === 'slug' ? null : page,
    fields,
  });
  const hash = createHash('sha256').update(hashPayload).digest('hex').slice(0, 10);

  const filename = mode === 'slug'
    ? `slug-${readable}-${hash}.json`
    : `${mode}-${readable}-${hash}-page-${page}.json`;

  return resolve(CACHE_ROOT, localDateKey(), filename);
}

export function wordpressEndpoint(mode, query, page = 1) {
  const endpoint = new URL('https://api.wordpress.org/plugins/info/1.2/');

  if (mode === 'slug') {
    endpoint.searchParams.set('action', 'plugin_information');
    endpoint.searchParams.set('request[slug]', query);
    for (const [key, val] of Object.entries(SLUG_FIELDS)) {
      endpoint.searchParams.set(`request[fields][${key}]`, String(val));
    }
  } else {
    endpoint.searchParams.set('action', 'query_plugins');
    if (mode === 'tag') {
      endpoint.searchParams.set('request[tag]', query);
    } else if (mode === 'search') {
      endpoint.searchParams.set('request[search]', query);
    }
    endpoint.searchParams.set('request[per_page]', '100');
    endpoint.searchParams.set('request[page]', String(page));
    for (const [key, val] of Object.entries(COLLECTION_FIELDS)) {
      endpoint.searchParams.set(`request[fields][${key}]`, String(val));
    }
  }

  return endpoint;
}

export async function readCachedResponse(cacheFile, mode) {
  try {
    const data = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (mode === 'slug') {
      return data && typeof data === 'object' && !Array.isArray(data) && typeof data.slug === 'string' ? data : null;
    }
    return Array.isArray(data?.plugins) && data?.info && typeof data.info === 'object' ? data : null;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`Ignoring unreadable plugin cache ${cacheFile}:`, error);
    }
    return null;
  }
}

export async function fetchAndCache(mode, query, page, cacheFile) {
  const response = await fetch(wordpressEndpoint(mode, query, page));

  if (response.status === 404) {
    const error = new Error('Plugin not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`WordPress.org returned status ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();

  if (data?.error === 'Plugin not found.' || (mode === 'slug' && data?.error)) {
    const error = new Error(typeof data.error === 'string' ? data.error : 'Plugin not found.');
    error.statusCode = 404;
    throw error;
  }

  if (mode === 'slug') {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !data.slug) {
      const error = new Error('WordPress.org returned an invalid plugin response.');
      error.statusCode = 502;
      throw error;
    }
  } else {
    if (!Array.isArray(data?.plugins) || !data?.info || typeof data.info !== 'object') {
      const error = new Error('WordPress.org returned an invalid plugin response.');
      error.statusCode = 502;
      throw error;
    }
  }

  await mkdir(resolve(cacheFile, '..'), { recursive: true });
  const temporaryFile = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, cacheFile);

  return data;
}

export async function getPlugins(mode, query, page) {
  const cacheFile = cacheFileFor(mode, query, page);
  const cached = await readCachedResponse(cacheFile, mode);
  if (cached) return { data: cached, cacheStatus: 'HIT' };

  let pending = pendingRequests.get(cacheFile);
  if (!pending) {
    pending = fetchAndCache(mode, query, page, cacheFile).finally(() => pendingRequests.delete(cacheFile));
    pendingRequests.set(cacheFile, pending);
  }

  return { data: await pending, cacheStatus: 'MISS' };
}

export function pluginCacheMiddleware() {
  return {
    name: 'plugin-json-cache',
    configureServer(server) {
      server.middlewares.use(API_PATH, handlePluginRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(API_PATH, handlePluginRequest);
    },
  };
}

export async function handlePluginRequest(request, response) {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const mode = requestUrl.searchParams.get('mode');
    const rawQuery = requestUrl.searchParams.get('query') ?? (requestUrl.searchParams.has('tag') ? requestUrl.searchParams.get('tag') : null);
    const query = rawQuery?.trim();

    if (!mode || !['tag', 'search', 'slug'].includes(mode)) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: 'Mode must be one of "tag", "search", or "slug".' }));
      return;
    }

    if (!query || query.length > 100) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: 'A query between 1 and 100 characters is required.' }));
      return;
    }

    let page = 1;
    if (mode === 'slug') {
      if (requestUrl.searchParams.has('page')) {
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ error: 'Page parameter is not allowed for slug queries.' }));
        return;
      }
    } else {
      const pageValue = requestUrl.searchParams.get('page') ?? '1';
      page = Number(pageValue);
      if (!/^\d+$/.test(pageValue) || !Number.isSafeInteger(page) || page < 1 || page > 100) {
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ error: 'Page must be an integer between 1 and 100.' }));
        return;
      }
    }

    const result = await getPlugins(mode, query, page);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('X-Plugin-Cache', result.cacheStatus);
    response.end(JSON.stringify(result.data));
  } catch (error) {
    const statusCode = error?.statusCode === 404 ? 404 : 502;
    if (statusCode !== 404) {
      console.error('Unable to load plugin data:', error);
    }
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: error?.message || 'Unable to load plugin data.' }));
  }
}

export default defineConfig({
  plugins: [pluginCacheMiddleware()],
});
