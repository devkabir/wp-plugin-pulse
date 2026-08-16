import { describe, expect, test } from 'bun:test';
import { normalizePluginResponse, normalizeSinglePluginResponse } from './plugin-normalizer';

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

describe('single plugin response normalization', () => {
  test('rejects non-object responses and missing slugs', () => {
    expect(() => normalizeSinglePluginResponse(null)).toThrow('invalid plugin record');
    expect(() => normalizeSinglePluginResponse([])).toThrow('invalid plugin record');
    expect(() => normalizeSinglePluginResponse('not-json')).toThrow('invalid plugin record');
    expect(() => normalizeSinglePluginResponse({})).toThrow('missing a valid slug');
    expect(() => normalizeSinglePluginResponse({ slug: '   ' })).toThrow('missing a valid slug');
  });

  test('rejects upstream error payload', () => {
    expect(() => normalizeSinglePluginResponse({ error: 'Plugin not found.' })).toThrow('Plugin not found.');
  });

  test('safely normalizes a minimal single-plugin record with missing optional fields', () => {
    const normalized = normalizeSinglePluginResponse({ slug: 'minimal-plugin' });
    expect(normalized.slug).toBe('minimal-plugin');
    expect(normalized.name).toBe('Untitled plugin');
    expect(normalized.version).toBe('Unknown');
    expect(normalized.authorName).toBe('Unknown author');
    expect(normalized.authorProfileUrl).toBeNull();
    expect(normalized.homepageUrl).toBeNull();
    expect(normalized.pluginUrl).toBe('https://wordpress.org/plugins/minimal-plugin/');
    expect(normalized.downloadUrl).toBeNull();
    expect(normalized.iconUrl).toBeNull();
    expect(normalized.shortDescription).toBe('');
    expect(normalized.tags).toEqual([]);
    expect(normalized.activeInstalls).toBe(0);
    expect(normalized.activeInstallsDisplay).toBe('0');
    expect(normalized.lifetimeDownloads).toBe(0);
    expect(normalized.lifetimeDownloadsDisplay).toBe('0');
    expect(normalized.lifetimeInstallPace).toBe(0);
    expect(normalized.lifetimeInstallPaceDisplay).toBe('0.0');
    expect(normalized.daysSinceAdded).toBe(0);
    expect(normalized.ratingPercent).toBe(0);
    expect(normalized.ratingScore).toBe(0);
    expect(normalized.ratingScoreDisplay).toBe('0.0');
    expect(normalized.ratingCount).toBe(0);
    expect(normalized.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect(normalized.supportThreads).toBe(0);
    expect(normalized.supportThreadsResolved).toBe(0);
    expect(normalized.supportResolutionRate).toBeNull();
    expect(normalized.addedAt).toBeNull();
    expect(normalized.lastUpdatedAt).toBeNull();
    expect(normalized.lastUpdatedRelative).toBe('Unknown');
    expect(normalized.freshness).toBe('unknown');
    expect(normalized.requiresWordPress).toBeNull();
    expect(normalized.testedWordPress).toBeNull();
    expect(normalized.requiresPhp).toBeNull();
    expect(normalized.requiredPlugins).toEqual([]);
  });

  test('normalizes a full single-plugin response correctly', () => {
    const raw = {
      name: 'Contact Form 7 &amp; Builder',
      slug: 'contact-form-7',
      version: '5.9.8',
      author: '<a href="https://ideasilo.wordpress.com/">Takayuki Miyoshi</a>',
      author_profile: 'https://profiles.wordpress.org/takayukister',
      homepage: 'https://contactform7.com/',
      download_link: 'https://downloads.wordpress.org/plugin/contact-form-7.5.9.8.zip',
      short_description: 'Just another contact form plugin. Simple but flexible.',
      tags: { 'contact-form': 'Contact Form', feedback: 'feedback' },
      active_installs: 5000000,
      downloaded: 300000000,
      rating: 82,
      num_ratings: 2150,
      ratings: { 1: 300, 2: 50, 3: 100, 4: 200, 5: 1500 },
      support_threads: 100,
      support_threads_resolved: 75,
      added: '2007-03-27',
      last_updated: '2026-08-01 10:00am GMT',
      requires: '6.2',
      tested: '6.6',
      requires_php: '7.4',
      requires_plugins: ['classic-editor'],
      icons: {
        '1x': 'https://ps.w.org/contact-form-7/assets/icon-128x128.png',
        '2x': 'https://ps.w.org/contact-form-7/assets/icon-256x256.png',
      },
    };

    const normalized = normalizeSinglePluginResponse(raw, Date.parse('2026-08-16T00:00:00Z'));
    expect(normalized.slug).toBe('contact-form-7');
    expect(normalized.name).toBe('Contact Form 7 & Builder');
    expect(normalized.version).toBe('5.9.8');
    expect(normalized.authorProfileUrl).toBe('https://profiles.wordpress.org/takayukister');
    expect(normalized.homepageUrl).toBe('https://contactform7.com/');
    expect(normalized.downloadUrl).toBe('https://downloads.wordpress.org/plugin/contact-form-7.5.9.8.zip');
    expect(normalized.activeInstalls).toBe(5000000);
    expect(normalized.activeInstallsDisplay).toBe('5,000,000');
    expect(normalized.supportResolutionRate).toBe(75);
    expect(normalized.tags).toEqual(['Contact Form', 'feedback']);
    expect(normalized.ratingDistribution).toEqual({ 1: 300, 2: 50, 3: 100, 4: 200, 5: 1500 });
    expect(normalized.requiredPlugins).toEqual(['classic-editor']);
  });
});

