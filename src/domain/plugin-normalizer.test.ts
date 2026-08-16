import { describe, expect, test } from 'bun:test';
import { normalizePluginResponse } from './plugin-normalizer';

describe('plugin response contract', () => {
  test('rejects a malformed collection', () => {
    expect(() => normalizePluginResponse({ info: {}, plugins: null })).toThrow('invalid plugin collection');
  });

  test('rejects missing pagination metadata', () => {
    expect(() => normalizePluginResponse({ plugins: [] })).toThrow('invalid pagination metadata');
  });

  test('normalizes pagination metadata for an empty collection', () => {
    expect(normalizePluginResponse({
      info: { page: '1', pages: '3', results: '255' },
      plugins: [],
    })).toEqual({ plugins: [], page: 1, totalPages: 3, totalResults: 255 });
  });

  test('parses WordPress.org non-ISO last_updated format', () => {
    const result = normalizePluginResponse({
      info: { page: 1, pages: 1, results: 1 },
      plugins: [{ slug: 'my-plugin', last_updated: '2026-08-12 9:48am GMT', added: '2023-01-15' }],
    });
    const plugin = result.plugins[0];
    // lastUpdatedAt must be a valid ISO string, not null
    expect(plugin.lastUpdatedAt).not.toBeNull();
    expect(typeof plugin.lastUpdatedAt).toBe('string');
    expect(new Date(plugin.lastUpdatedAt!).getFullYear()).toBe(2026);
    expect(new Date(plugin.lastUpdatedAt!).getMonth()).toBe(7); // August (0-indexed)
    // addedAt must also parse correctly
    expect(plugin.addedAt).not.toBeNull();
    expect(new Date(plugin.addedAt!).getFullYear()).toBe(2023);
  });

  test('parses WordPress.org pm date variant', () => {
    const result = normalizePluginResponse({
      info: { page: 1, pages: 1, results: 1 },
      plugins: [{ slug: 'test', last_updated: '2025-12-25 3:00pm GMT' }],
    });
    const plugin = result.plugins[0];
    expect(plugin.lastUpdatedAt).not.toBeNull();
    expect(new Date(plugin.lastUpdatedAt!).getUTCHours()).toBe(15);
  });
});

