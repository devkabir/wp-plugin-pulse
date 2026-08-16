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
});
