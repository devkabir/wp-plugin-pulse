import { describe, expect, it } from 'bun:test';
import { comparePlugins } from './plugin-comparison';
import type { NormalizedPlugin } from './plugin-types';

function createMockPlugin(overrides: Partial<NormalizedPlugin>): NormalizedPlugin {
  return {
    name: 'Default Plugin',
    slug: 'default-plugin',
    version: '1.0.0',
    authorName: 'Author',
    authorProfileUrl: null,
    homepageUrl: null,
    pluginUrl: 'https://wordpress.org/plugins/default-plugin/',
    downloadUrl: null,
    iconUrl: null,
    shortDescription: '',
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

describe('PR 5 — Plugin Comparison Domain Calculations', () => {
  describe('Deterministic output structure', () => {
    it('produces complete PluginComparison object with all required groups', () => {
      const subject = createMockPlugin({
        name: 'My Form',
        slug: 'my-form',
        tags: ['form-builder', 'contact-form'],
        shortDescription: 'Modern contact form with conditional logic.',
      });

      const competitor = createMockPlugin({
        name: 'Competitor Form',
        slug: 'competitor-form',
        tags: ['form-builder', 'multi-step-forms', 'stripe'],
        shortDescription: 'Advanced form builder with multi-step forms and Stripe payments.',
      });

      const comparison = comparePlugins(subject, [competitor]);

      expect(comparison.subject.slug).toBe('my-form');
      expect(comparison.competitors.length).toBe(1);
      expect(comparison.competitors[0].slug).toBe('competitor-form');

      expect(comparison.tags).toBeDefined();
      expect(comparison.tags.shared).toContain('form-builder');
      expect(comparison.tags.subjectOnly).toContain('contact-form');
      expect(comparison.tags.competitorOnly.length).toBe(2);

      expect(comparison.features.length).toBeGreaterThanOrEqual(10);
      expect(comparison.compatibility.length).toBeGreaterThan(0);
      expect(comparison.maintenance.length).toBeGreaterThan(0);
      expect(comparison.trust.length).toBeGreaterThan(0);
      expect(comparison.opportunities.length).toBeGreaterThan(0);
    });

    it('produces identical output for identical inputs across multiple runs', () => {
      const subject = createMockPlugin({
        slug: 'subject-plugin',
        tags: ['forms', 'logic'],
        shortDescription: 'Supports conditional logic.',
      });
      const comp1 = createMockPlugin({
        slug: 'comp-1',
        tags: ['forms', 'stripe'],
        shortDescription: 'Accepts Stripe payments.',
      });
      const comp2 = createMockPlugin({
        slug: 'comp-2',
        tags: ['forms', 'zapier'],
        shortDescription: 'Automate with Zapier.',
      });

      const run1 = comparePlugins(subject, [comp1, comp2]);
      const run2 = comparePlugins(subject, [comp1, comp2]);

      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    });
  });

  describe('Zero ratings and support threads handling', () => {
    it('marks zero ratings as insufficient_data with sampleCount 0', () => {
      const subject = createMockPlugin({
        slug: 'unrated-subject',
        ratingCount: 0,
        ratingScore: 0,
        ratingScoreDisplay: '0.0',
      });

      const competitor = createMockPlugin({
        slug: 'rated-competitor',
        ratingCount: 150,
        ratingScore: 4.8,
        ratingScoreDisplay: '4.8',
      });

      const comparison = comparePlugins(subject, [competitor]);
      const ratingRow = comparison.trust.find((r) => r.key === 'rating_score');

      expect(ratingRow).toBeDefined();
      expect(ratingRow?.subject.status).toBe('insufficient_data');
      expect(ratingRow?.subject.sampleCount).toBe(0);
      expect(ratingRow?.subject.display).toBe('No ratings');

      expect(ratingRow?.competitors[0].status).toBe('advantage');
      expect(ratingRow?.competitors[0].sampleCount).toBe(150);
      expect(ratingRow?.competitors[0].display).toContain('150 reviews');
    });

    it('marks zero support threads as insufficient_data with sampleCount 0', () => {
      const subject = createMockPlugin({
        slug: 'no-support-subject',
        supportThreads: 0,
        supportThreadsResolved: 0,
        supportResolutionRate: null,
      });

      const competitor = createMockPlugin({
        slug: 'active-support-competitor',
        supportThreads: 40,
        supportThreadsResolved: 38,
        supportResolutionRate: 95,
      });

      const comparison = comparePlugins(subject, [competitor]);
      const supportRow = comparison.trust.find((r) => r.key === 'support_resolution');

      expect(supportRow).toBeDefined();
      expect(supportRow?.subject.status).toBe('insufficient_data');
      expect(supportRow?.subject.sampleCount).toBe(0);
      expect(supportRow?.subject.display).toBe('No support threads');

      expect(supportRow?.competitors[0].sampleCount).toBe(40);
      expect(supportRow?.competitors[0].display).toContain('38 / 40 resolved');
    });
  });

  describe('Feature isolation and evidence', () => {
    it('ensures every confirmed feature includes evidence and competitor features never leak to subject', () => {
      const subject = createMockPlugin({
        slug: 'subject',
        shortDescription: 'Basic contact form.',
        description: 'A minimal single-column form with standard input fields.',
      });

      const competitor = createMockPlugin({
        slug: 'competitor',
        shortDescription: 'Advanced form builder with file uploads and attachments.',
        description: null,
      });

      const comparison = comparePlugins(subject, [competitor]);
      const uploadFeature = comparison.features.find((f) => f.featureId === 'file-uploads');

      expect(uploadFeature).toBeDefined();
      expect(uploadFeature?.subjectStatus).toBe('absent');
      expect(uploadFeature?.subjectEvidence).toEqual([]);

      const compResult = uploadFeature?.competitors.find((c) => c.slug === 'competitor');
      expect(compResult?.status).toBe('present');
      expect(compResult?.evidence.length).toBeGreaterThan(0);
      expect(compResult?.evidence[0].matchedText.toLowerCase()).toContain('file upload');
    });
  });

  describe('Deterministic Opportunity ordering', () => {
    it('orders opportunities by impact, confidence, category, and ID stably', () => {
      const subject = createMockPlugin({
        slug: 'subject-form',
        testedWordPress: '6.4',
        freshness: 'stale',
        lastUpdatedRelative: '14 months ago',
        tags: ['form-builder'],
        shortDescription: 'Simple form builder.',
        description: 'No integrations.',
      });

      const comp1 = createMockPlugin({
        slug: 'comp-1',
        testedWordPress: '6.7',
        freshness: 'fresh',
        tags: ['form-builder', 'multi-step', 'stripe', 'zapier'],
        shortDescription: 'Includes multi-step forms and Stripe payments.',
      });

      const comp2 = createMockPlugin({
        slug: 'comp-2',
        testedWordPress: '6.7',
        freshness: 'fresh',
        tags: ['form-builder', 'multi-step', 'webhooks'],
        shortDescription: 'Supports multi-step forms and webhooks.',
      });

      const comparison = comparePlugins(subject, [comp1, comp2]);

      expect(comparison.opportunities.length).toBeGreaterThan(0);

      // Verify that every opportunity has all required attributes
      for (const opp of comparison.opportunities) {
        expect(opp.id).toBeDefined();
        expect(opp.category).toBeDefined();
        expect(opp.title).toBeDefined();
        expect(opp.reason).toBeDefined();
        expect(opp.impact).toMatch(/^(high|medium|low)$/);
        expect(opp.confidence).toMatch(/^(high|medium|low)$/);
        expect(Array.isArray(opp.evidenceSlugs)).toBe(true);
        expect(opp.evidenceSlugs.length).toBeGreaterThan(0);
      }

      // Verify high impact items come before medium or low
      const impactWeights = { high: 3, medium: 2, low: 1 };
      for (let i = 0; i < comparison.opportunities.length - 1; i++) {
        const curr = comparison.opportunities[i];
        const next = comparison.opportunities[i + 1];
        expect(impactWeights[curr.impact]).toBeGreaterThanOrEqual(impactWeights[next.impact]);
      }
    });
  });

  describe('Generic multi-niche comparison support', () => {
    it('compares SEO plugins dynamically with SEO-specific features', () => {
      const subject = createMockPlugin({
        name: 'My SEO Tool',
        slug: 'my-seo-tool',
        tags: ['seo', 'sitemaps'],
        shortDescription: 'Generates XML sitemaps and meta tags.',
      });

      const competitor = createMockPlugin({
        name: 'Competitor SEO Pro',
        slug: 'competitor-seo-pro',
        tags: ['seo', 'schema'],
        shortDescription: 'Complete SEO suite with XML sitemaps, JSON-LD Schema markup, and 301 redirects.',
      });

      const comparison = comparePlugins(subject, [competitor]);

      expect(comparison.subject.slug).toBe('my-seo-tool');
      expect(comparison.tags.shared).toContain('seo');
      expect(comparison.features.some((f) => f.featureId === 'xml-sitemaps')).toBe(true);
      expect(comparison.features.some((f) => f.featureId === 'schema-markup')).toBe(true);
      expect(comparison.features.some((f) => f.featureId === 'gutenberg-blocks')).toBe(true);
    });

    it('compares WooCommerce & eCommerce plugins with commerce-specific features', () => {
      const subject = createMockPlugin({
        name: 'Quick Shop',
        slug: 'quick-shop',
        tags: ['woocommerce', 'ecommerce'],
        shortDescription: 'Product variations and side cart.',
      });

      const competitor = createMockPlugin({
        name: 'Pro Commerce',
        slug: 'pro-commerce',
        tags: ['woocommerce', 'ecommerce', 'checkout'],
        shortDescription: 'Advanced one-page checkout and dynamic discount coupons.',
      });

      const comparison = comparePlugins(subject, [competitor]);

      expect(comparison.features.some((f) => f.featureId === 'product-variations')).toBe(true);
      expect(comparison.features.some((f) => f.featureId === 'cart-checkout')).toBe(true);
      expect(comparison.features.some((f) => f.featureId === 'coupons-discounts')).toBe(true);
    });
  });

  describe('PR 11 — Historical Momentum in Comparison', () => {
    it('separately labels Lifetime Install Pace and Observed Momentum', () => {
      const subject = createMockPlugin({ slug: 'my-form', name: 'My Form' });
      const comp = createMockPlugin({ slug: 'comp-form', name: 'Comp Form' });

      const mockMomentum = {
        'my-form': {
          slug: 'my-form',
          hasSufficientData: true,
          status: 'ready' as const,
          startSnapshot: {
            slug: 'my-form',
            observedAt: '2026-08-01T00:00:00.000Z',
            activeInstalls: 50000,
            downloaded: 100000,
            rating: 90,
            ratingCount: 100,
            supportThreads: 10,
            supportThreadsResolved: 9,
            version: '1.0.0',
            testedWordPress: '6.5',
            lastUpdatedAt: null,
            contentHash: 'hash1',
          },
          endSnapshot: {
            slug: 'my-form',
            observedAt: '2026-08-15T00:00:00.000Z',
            activeInstalls: 50000,
            downloaded: 114000,
            rating: 90,
            ratingCount: 105,
            supportThreads: 12,
            supportThreadsResolved: 11,
            version: '1.0.0',
            testedWordPress: '6.5',
            lastUpdatedAt: null,
            contentHash: 'hash1',
          },
          observationCount: 15,
          startObservationDate: '2026-08-01T00:00:00.000Z',
          endObservationDate: '2026-08-15T00:00:00.000Z',
          intervalDays: 14,
          activeInstallsDelta: 0,
          bandTransition: { from: 50000, to: 50000, crossed: false, direction: 'flat' as const },
          downloadedDelta: 14000,
          downloadPacePerDay: 1000,
          downloadPacePerDayDisplay: '1,000 / day',
          ratingDelta: 0,
          ratingCountDelta: 5,
          supportThreadsDelta: 2,
          supportThreadsResolvedDelta: 2,
          supportResolutionRateDelta: 0,
          versionChanged: false,
          previousVersion: '1.0.0',
          currentVersion: '1.0.0',
          testedWordPressChanged: false,
          previousTestedWordPress: '6.5',
          currentTestedWordPress: '6.5',
          contentChanged: false,
          direction: 'rising' as const,
          activeInstallsTrajectory: 'flat' as const,
          downloadTrajectory: 'rising' as const,
          ratingTrajectory: 'flat' as const,
          confidence: 'high' as const,
          confidenceScore: 0.95,
          confidenceReason: 'Consistent daily observations',
          hasGaps: false,
          gaps: [],
          maxGapDays: 0,
          expectedObservations: 15,
          actualObservations: 15,
          coverageRatio: 1.0,
        },
      };

      const comparison = comparePlugins(subject, [comp], undefined, mockMomentum);

      const lifetimeRow = comparison.trust.find((r) => r.key === 'lifetime_install_pace');
      const momentumRow = comparison.trust.find((r) => r.key === 'observed_momentum');

      expect(lifetimeRow).toBeDefined();
      expect(lifetimeRow?.label).toBe('Lifetime Install Pace');
      expect(lifetimeRow?.subject.note).toContain('Reported active installs divided by days');

      expect(momentumRow).toBeDefined();
      expect(momentumRow?.label).toBe('Observed Momentum');
      expect(momentumRow?.subject.display).toContain('↗ Rising');
      expect(momentumRow?.subject.note).toContain('2026-08-01 to 2026-08-15');
      expect(momentumRow?.competitors[0].status).toBe('insufficient_data');
    });
  });
});
