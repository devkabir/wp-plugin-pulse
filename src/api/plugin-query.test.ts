import { describe, expect, it } from 'bun:test';
import {
  COLLECTION_FIELDS,
  SLUG_FIELDS,
  cacheFileFor,
  handlePluginRequest,
  wordpressEndpoint,
} from '../../vite.config.js';
import { fetchPluginBySlug, fetchPluginCollection, fetchPlugins } from './plugins';
import { PluginRequestError } from '../domain/error-classifier';

describe('WordPress.org endpoint builder', () => {
  it('defines correct field constants', () => {
    expect(COLLECTION_FIELDS.description).toBe(0);
    expect(COLLECTION_FIELDS.sections).toBe(0);
    expect(SLUG_FIELDS.description).toBe(1);
    expect(SLUG_FIELDS.sections).toBe(1);
  });

  it('constructs tag query parameters correctly', () => {
    const url = wordpressEndpoint('tag', 'form-builder', 2);
    expect(url.origin).toBe('https://api.wordpress.org');
    expect(url.pathname).toBe('/plugins/info/1.2/');
    expect(url.searchParams.get('action')).toBe('query_plugins');
    expect(url.searchParams.get('request[tag]')).toBe('form-builder');
    expect(url.searchParams.get('request[per_page]')).toBe('100');
    expect(url.searchParams.get('request[page]')).toBe('2');
    expect(url.searchParams.get('request[fields][description]')).toBe('0');
    expect(url.searchParams.get('request[fields][sections]')).toBe('0');
    expect(url.searchParams.get('request[fields][short_description]')).toBe('1');
    expect(url.searchParams.get('request[fields][icons]')).toBe('1');
    expect(url.searchParams.get('request[fields][active_installs]')).toBe('1');
  });

  it('constructs search query parameters correctly', () => {
    const url = wordpressEndpoint('search', 'contact forms & blocks', 1);
    expect(url.searchParams.get('action')).toBe('query_plugins');
    expect(url.searchParams.get('request[search]')).toBe('contact forms & blocks');
    expect(url.searchParams.get('request[per_page]')).toBe('100');
    expect(url.searchParams.get('request[page]')).toBe('1');
    expect(url.searchParams.get('request[fields][description]')).toBe('0');
    expect(url.searchParams.get('request[fields][sections]')).toBe('0');
  });

  it('constructs slug query parameters with descriptions/sections enabled', () => {
    const url = wordpressEndpoint('slug', 'contact-form-7');
    expect(url.searchParams.get('action')).toBe('plugin_information');
    expect(url.searchParams.get('request[slug]')).toBe('contact-form-7');
    expect(url.searchParams.has('request[page]')).toBe(false);
    expect(url.searchParams.has('request[per_page]')).toBe(false);
    expect(url.searchParams.get('request[fields][description]')).toBe('1');
    expect(url.searchParams.get('request[fields][sections]')).toBe('1');
    expect(url.searchParams.get('request[fields][active_installs]')).toBe('1');
  });

  it('encodes special characters safely in URLs', () => {
    const url = wordpressEndpoint('search', 'c++ & c# plugins');
    expect(url.toString()).toContain('request%5Bsearch%5D=c%2B%2B+%26+c%23+plugins');
  });
});

describe('Cache file isolation across modes and parameters', () => {
  it('generates distinct cache keys for tag, search, and slug with identical query values', () => {
    const tagCache = cacheFileFor('tag', 'seo', 1);
    const searchCache = cacheFileFor('search', 'seo', 1);
    const slugCache = cacheFileFor('slug', 'seo');

    expect(tagCache).not.toBe(searchCache);
    expect(tagCache).not.toBe(slugCache);
    expect(searchCache).not.toBe(slugCache);

    expect(tagCache).toContain('tag-seo-');
    expect(searchCache).toContain('search-seo-');
    expect(slugCache).toContain('slug-seo-');
  });

  it('generates distinct cache keys for different pages of the same tag', () => {
    const page1Cache = cacheFileFor('tag', 'form-builder', 1);
    const page2Cache = cacheFileFor('tag', 'form-builder', 2);

    expect(page1Cache).not.toBe(page2Cache);
    expect(page1Cache).toContain('page-1.json');
    expect(page2Cache).toContain('page-2.json');
  });

  it('normalizes query casing and whitespace in cache keys', () => {
    const cache1 = cacheFileFor('search', 'Contact Form', 1);
    const cache2 = cacheFileFor('search', '  contact form  ', 1);

    expect(cache1).toBe(cache2);
  });
});

describe('API proxy validation and status codes', () => {
  function createMockResponse() {
    return {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      end(payload: string) {
        this.body = payload;
      },
    };
  }

  it('rejects missing or unsupported query mode with HTTP 400', async () => {
    const response = createMockResponse();
    await handlePluginRequest({ url: '/api/plugins?query=test' }, response);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('Mode must be one of');

    const invalidResponse = createMockResponse();
    await handlePluginRequest({ url: '/api/plugins?mode=author&query=test' }, invalidResponse);
    expect(invalidResponse.statusCode).toBe(400);
    expect(JSON.parse(invalidResponse.body).error).toContain('Mode must be one of');
  });

  it('rejects empty, whitespace, or excessively long query strings with HTTP 400', async () => {
    const emptyResponse = createMockResponse();
    await handlePluginRequest({ url: '/api/plugins?mode=tag&query=' }, emptyResponse);
    expect(emptyResponse.statusCode).toBe(400);
    expect(JSON.parse(emptyResponse.body).error).toContain('between 1 and 100 characters');

    const whitespaceResponse = createMockResponse();
    await handlePluginRequest({ url: '/api/plugins?mode=search&query=%20%20%20' }, whitespaceResponse);
    expect(whitespaceResponse.statusCode).toBe(400);
    expect(JSON.parse(whitespaceResponse.body).error).toContain('between 1 and 100 characters');

    const longQuery = 'a'.repeat(101);
    const longResponse = createMockResponse();
    await handlePluginRequest({ url: `/api/plugins?mode=slug&query=${longQuery}` }, longResponse);
    expect(longResponse.statusCode).toBe(400);
    expect(JSON.parse(longResponse.body).error).toContain('between 1 and 100 characters');
  });

  it('rejects invalid page parameters for tag/search collection requests with HTTP 400', async () => {
    const invalidPages = ['0', '-1', '101', 'abc', '1.5'];
    for (const page of invalidPages) {
      const response = createMockResponse();
      await handlePluginRequest({ url: `/api/plugins?mode=tag&query=forms&page=${page}` }, response);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Page must be an integer');
    }
  });

  it('rejects page parameter when provided in slug mode with HTTP 400', async () => {
    const response = createMockResponse();
    await handlePluginRequest({ url: '/api/plugins?mode=slug&query=contact-form-7&page=2' }, response);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('Page parameter is not allowed for slug queries');
  });
});

describe('Client API functions', () => {
  const originalFetch = globalThis.fetch;

  it('fetchPluginCollection sends mode, query, and page params', async () => {
    let requestedUrl = '';
    globalThis.fetch = (async (url: URL | string) => {
      requestedUrl = url.toString();
      return {
        ok: true,
        status: 200,
        json: async () => ({
          info: { page: 1, pages: 1, results: 1 },
          plugins: [{ slug: 'sample-plugin', name: 'Sample' }],
        }),
      } as Response;
    }) as any;

    try {
      const result = await fetchPluginCollection({ mode: 'search', value: 'my plugin' }, 3);
      expect(requestedUrl).toContain('mode=search');
      expect(requestedUrl).toContain('query=my+plugin');
      expect(requestedUrl).toContain('page=3');
      expect(result.plugins.length).toBe(1);
      expect(result.plugins[0].slug).toBe('sample-plugin');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fetchPluginBySlug sends slug mode and query param without page', async () => {
    let requestedUrl = '';
    globalThis.fetch = (async (url: URL | string) => {
      requestedUrl = url.toString();
      return {
        ok: true,
        status: 200,
        json: async () => ({
          slug: 'exact-plugin',
          name: 'Exact Plugin',
          version: '1.0.0',
        }),
      } as Response;
    }) as any;

    try {
      const plugin = await fetchPluginBySlug('exact-plugin');
      expect(requestedUrl).toContain('mode=slug');
      expect(requestedUrl).toContain('query=exact-plugin');
      expect(requestedUrl).not.toContain('page=');
      expect(plugin.slug).toBe('exact-plugin');
      expect(plugin.name).toBe('Exact Plugin');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('translates 404 response to not_found PluginRequestError', async () => {
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Plugin not found.' }),
      } as Response;
    }) as any;

    try {
      await expect(fetchPluginBySlug('nonexistent-plugin')).rejects.toThrow();
      try {
        await fetchPluginBySlug('nonexistent-plugin');
      } catch (err) {
        expect(err).toBeInstanceOf(PluginRequestError);
        expect((err as PluginRequestError).kind).toBe('not_found');
        expect((err as PluginRequestError).statusCode).toBe(404);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('preserves abort error without masking it as a network error', async () => {
    const controller = new AbortController();
    globalThis.fetch = (async (_url: any, options: any) => {
      if (options?.signal?.aborted) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
      throw new Error('Should not reach here');
    }) as any;

    try {
      controller.abort();
      await expect(
        fetchPluginCollection({ mode: 'tag', value: 'forms' }, 1, controller.signal)
      ).rejects.toThrow();

      try {
        await fetchPluginCollection({ mode: 'tag', value: 'forms' }, 1, controller.signal);
      } catch (err: any) {
        expect(err.name).toBe('AbortError');
        expect(err).not.toBeInstanceOf(PluginRequestError);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fetchPlugins backwards compatibility wrapper delegates to fetchPluginCollection in tag mode', async () => {
    let requestedUrl = '';
    globalThis.fetch = (async (url: URL | string) => {
      requestedUrl = url.toString();
      return {
        ok: true,
        status: 200,
        json: async () => ({
          info: { page: 1, pages: 1, results: 0 },
          plugins: [],
        }),
      } as Response;
    }) as any;

    try {
      await fetchPlugins('form-builder', 2);
      expect(requestedUrl).toContain('mode=tag');
      expect(requestedUrl).toContain('query=form-builder');
      expect(requestedUrl).toContain('page=2');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
