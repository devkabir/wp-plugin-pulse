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

  test('normalizes lifetime install pace correctly and produces unavailable state for missing added date', () => {
    const result = normalizePluginResponse({
      info: { page: 1, pages: 1, results: 2 },
      plugins: [
        { slug: 'active-plugin', active_installs: 1000, added: '2026-08-01' },
        { slug: 'missing-date', active_installs: 500, added: '' },
      ],
    }, Date.parse('2026-08-11T00:00:00Z'));
    const [p1, p2] = result.plugins;
    expect(p1.lifetimeInstallPace).toBe(100);
    expect(p1.lifetimeInstallPaceDisplay).toBe('100.0');
    expect(p2.lifetimeInstallPace).toBe(0);
    expect(p2.lifetimeInstallPaceDisplay).toBe('0.0');
  });
});

