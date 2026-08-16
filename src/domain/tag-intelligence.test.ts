import { describe, expect, it } from 'bun:test';
import type { NormalizedPlugin } from './plugin-types';
import { calculateTagFrequency, compareTags, normalizePluginTags, normalizeTagSlug } from './tag-intelligence';

function createMockPlugin(overrides: Partial<NormalizedPlugin>): NormalizedPlugin {
  return {
    name: 'Sample Plugin',
    slug: 'sample-plugin',
    version: '1.0.0',
    authorName: 'Sample Author',
    authorProfileUrl: null,
    homepageUrl: null,
    pluginUrl: 'https://wordpress.org/plugins/sample-plugin/',
    downloadUrl: null,
    iconUrl: null,
    shortDescription: 'Sample short description',
    description: null,
    tags: [],
    activeInstalls: 1000,
    activeInstallsDisplay: '1,000',
    lifetimeDownloads: 5000,
    lifetimeDownloadsDisplay: '5,000',
    lifetimeInstallPace: 10,
    lifetimeInstallPaceDisplay: '10.0',
    daysSinceAdded: 100,
    ratingPercent: 90,
    ratingScore: 4.5,
    ratingScoreDisplay: '4.5',
    ratingCount: 50,
    ratingDistribution: { 1: 0, 2: 1, 3: 2, 4: 10, 5: 37 },
    supportThreads: 10,
    supportThreadsResolved: 9,
    supportResolutionRate: 90,
    addedAt: '2025-01-01T00:00:00Z',
    lastUpdatedAt: '2026-08-01T00:00:00Z',
    lastUpdatedRelative: '16 days ago',
    freshness: 'fresh',
    requiresWordPress: '6.0',
    testedWordPress: '6.6',
    requiresPhp: '7.4',
    requiredPlugins: [],
    ...overrides,
  };
}

describe('PR 5 — Tag Intelligence Domain Calculations', () => {
  describe('Tag normalization', () => {
    it('normalizes slugs to lowercase and removes punctuation', () => {
      expect(normalizeTagSlug('Form Builder')).toBe('form-builder');
      expect(normalizeTagSlug('contact_form_7')).toBe('contact-form-7');
      expect(normalizeTagSlug('  E-COMMERCE  ')).toBe('e-commerce');
      expect(normalizeTagSlug('Multi--Step//Forms')).toBe('multi-step-forms');
      expect(normalizeTagSlug('!@#$%Special*()')).toBe('special');
      expect(normalizeTagSlug('---leading-trailing---')).toBe('leading-trailing');
      expect(normalizeTagSlug('')).toBe('');
    });

    it('deduplicates plugin tags by normalized slug while preserving casing', () => {
      const rawTags = ['Form Builder', 'form-builder', 'FORM BUILDER', 'Contact Form', 'contact_form'];
      const normalized = normalizePluginTags(rawTags);

      expect(normalized).toEqual([
        { slug: 'form-builder', label: 'Form Builder' },
        { slug: 'contact-form', label: 'Contact Form' },
      ]);
    });

    it('handles empty or malformed tag lists safely', () => {
      expect(normalizePluginTags([])).toEqual([]);
      expect(normalizePluginTags(['', '   ', '---'])).toEqual([]);
      // @ts-expect-error test invalid inputs
      expect(normalizePluginTags(null)).toEqual([]);
    });
  });

  describe('Tag frequency calculation', () => {
    it('calculates tag frequency across only the provided plugin set', () => {
      const p1 = createMockPlugin({ slug: 'plugin-1', tags: ['Form Builder', 'contact form', 'stripe'] });
      const p2 = createMockPlugin({ slug: 'plugin-2', tags: ['form-builder', 'multi-step', 'stripe'] });
      const p3 = createMockPlugin({ slug: 'plugin-3', tags: ['FORM BUILDER', 'calculations', 'stripe'] });

      const frequency = calculateTagFrequency([p1, p2, p3]);

      expect(frequency).toEqual([
        {
          slug: 'form-builder',
          label: 'Form Builder',
          count: 3,
          pluginSlugs: ['plugin-1', 'plugin-2', 'plugin-3'],
        },
        {
          slug: 'stripe',
          label: 'stripe',
          count: 3,
          pluginSlugs: ['plugin-1', 'plugin-2', 'plugin-3'],
        },
        {
          slug: 'calculations',
          label: 'calculations',
          count: 1,
          pluginSlugs: ['plugin-3'],
        },
        {
          slug: 'contact-form',
          label: 'contact form',
          count: 1,
          pluginSlugs: ['plugin-1'],
        },
        {
          slug: 'multi-step',
          label: 'multi-step',
          count: 1,
          pluginSlugs: ['plugin-2'],
        },
      ]);
    });

    it('returns empty array when given no plugins', () => {
      expect(calculateTagFrequency([])).toEqual([]);
    });
  });

  describe('Tag comparison', () => {
    it('partitions tags into shared, subjectOnly, and competitorOnly with attribution', () => {
      const subject = createMockPlugin({
        slug: 'my-form-plugin',
        tags: ['Form Builder', 'Custom Logic', 'Exclusive Tag'],
      });

      const comp1 = createMockPlugin({
        slug: 'competitor-a',
        tags: ['form-builder', 'multi-step', 'stripe'],
      });

      const comp2 = createMockPlugin({
        slug: 'competitor-b',
        tags: ['Form Builder', 'multi-step', 'zapier'],
      });

      const comparison = compareTags(subject, [comp1, comp2]);

      expect(comparison.shared).toEqual(['Form Builder']);
      expect(comparison.subjectOnly).toEqual(['Custom Logic', 'Exclusive Tag']);

      expect(comparison.competitorOnly).toEqual([
        {
          tag: 'multi-step',
          usedBy: ['competitor-a', 'competitor-b'],
        },
        {
          tag: 'stripe',
          usedBy: ['competitor-a'],
        },
        {
          tag: 'zapier',
          usedBy: ['competitor-b'],
        },
      ]);
    });

    it('handles identical tags across subject and all competitors', () => {
      const subject = createMockPlugin({ slug: 'sub', tags: ['Forms', 'Stripe'] });
      const comp = createMockPlugin({ slug: 'comp', tags: ['forms', 'stripe'] });

      const comparison = compareTags(subject, [comp]);

      expect(comparison.shared).toEqual(['Forms', 'Stripe']);
      expect(comparison.subjectOnly).toEqual([]);
      expect(comparison.competitorOnly).toEqual([]);
    });

    it('handles completely disjoint tag sets', () => {
      const subject = createMockPlugin({ slug: 'sub', tags: ['Tag A', 'Tag B'] });
      const comp = createMockPlugin({ slug: 'comp', tags: ['Tag C', 'Tag D'] });

      const comparison = compareTags(subject, [comp]);

      expect(comparison.shared).toEqual([]);
      expect(comparison.subjectOnly).toEqual(['Tag A', 'Tag B']);
      expect(comparison.competitorOnly).toEqual([
        { tag: 'Tag C', usedBy: ['comp'] },
        { tag: 'Tag D', usedBy: ['comp'] },
      ]);
    });
  });
});
