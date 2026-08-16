import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const CACHE_ROOT = resolve('.cache/plugins');
const API_PATH = '/api/plugins';
const pendingRequests = new Map();

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function cacheFileFor(tag, page) {
  const readableTag = tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'tag';
  const tagHash = createHash('sha256').update(tag).digest('hex').slice(0, 10);

  return resolve(CACHE_ROOT, localDateKey(), `${readableTag}-${tagHash}-page-${page}.json`);
}

function wordpressEndpoint(tag, page) {
  const endpoint = new URL('https://api.wordpress.org/plugins/info/1.2/');
  endpoint.searchParams.set('action', 'query_plugins');
  endpoint.searchParams.set('request[tag]', tag);
  endpoint.searchParams.set('request[per_page]', '100');
  endpoint.searchParams.set('request[page]', String(page));

  return endpoint;
}

async function readCachedResponse(cacheFile) {
  try {
    const data = JSON.parse(await readFile(cacheFile, 'utf8'));
    return Array.isArray(data?.plugins) && data?.info && typeof data.info === 'object' ? data : null;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`Ignoring unreadable plugin cache ${cacheFile}:`, error);
    }
    return null;
  }
}

async function fetchAndCache(tag, page, cacheFile) {
  const response = await fetch(wordpressEndpoint(tag, page));
  if (!response.ok) {
    throw new Error(`WordPress.org returned status ${response.status}.`);
  }

  const data = await response.json();
  if (!Array.isArray(data?.plugins) || !data?.info || typeof data.info !== 'object') {
    throw new Error('WordPress.org returned an invalid plugin response.');
  }

  await mkdir(resolve(cacheFile, '..'), { recursive: true });
  const temporaryFile = `${cacheFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, cacheFile);

  return data;
}

async function getPlugins(tag, page) {
  const cacheFile = cacheFileFor(tag, page);
  const cached = await readCachedResponse(cacheFile);
  if (cached) return { data: cached, cacheStatus: 'HIT' };

  let pending = pendingRequests.get(cacheFile);
  if (!pending) {
    pending = fetchAndCache(tag, page, cacheFile).finally(() => pendingRequests.delete(cacheFile));
    pendingRequests.set(cacheFile, pending);
  }

  return { data: await pending, cacheStatus: 'MISS' };
}

function pluginCacheMiddleware() {
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

async function handlePluginRequest(request, response) {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const tag = requestUrl.searchParams.get('tag')?.trim();
    const pageValue = requestUrl.searchParams.get('page') ?? '1';
    const page = Number(pageValue);
    if (!tag || tag.length > 100) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: 'A tag between 1 and 100 characters is required.' }));
      return;
    }
    if (!/^\d+$/.test(pageValue) || !Number.isSafeInteger(page) || page < 1 || page > 100) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: 'Page must be an integer between 1 and 100.' }));
      return;
    }

    const result = await getPlugins(tag, page);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('X-Plugin-Cache', result.cacheStatus);
    response.end(JSON.stringify(result.data));
  } catch (error) {
    console.error('Unable to load plugin data:', error);
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'Unable to load plugin data.' }));
  }
}

export default defineConfig({
  plugins: [pluginCacheMiddleware()],
});
