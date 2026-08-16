import { describe, expect, it } from 'bun:test';
import { FORM_BUILDER_FEATURE_DICTIONARY } from './feature-dictionary';
import { extractFeatureForPlugin, extractPluginFeatures } from './feature-extractor';
import type { FeatureDefinition, NormalizedPlugin } from './plugin-types';

function createMockPlugin(overrides: Partial<NormalizedPlugin>): NormalizedPlugin {
  return {
    name: 'Test Form Plugin',
    slug: 'test-form-plugin',
    version: '1.0.0',
    authorName: 'Test Author',
    authorProfileUrl: null,
    homepageUrl: null,
    pluginUrl: 'https://wordpress.org/plugins/test-form-plugin/',
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

describe('PR 5 — Feature Extractor Domain Calculations', () => {
  const findFeatureDef = (id: string): FeatureDefinition => {
    const def = FORM_BUILDER_FEATURE_DICTIONARY.find((f) => f.id === id);
    if (!def) throw new Error(`Feature definition not found for id: ${id}`);
    return def;
  };

  describe('Evidence extraction from tags, short description, and full description', () => {
    it('extracts feature from tag with tag field evidence', () => {
      const plugin = createMockPlugin({
        tags: ['multi-step-forms', 'recaptcha'],
      });

      const multiStep = extractFeatureForPlugin(plugin, findFeatureDef('multi-step-forms'));
      expect(multiStep.status).toBe('present');
      expect(multiStep.evidence.length).toBeGreaterThanOrEqual(1);
      expect(multiStep.evidence[0].field).toBe('tag');
      expect(multiStep.evidence[0].matchedText).toBe('multi-step-forms');

      const spam = extractFeatureForPlugin(plugin, findFeatureDef('spam-protection'));
      expect(spam.status).toBe('present');
      expect(spam.evidence[0].field).toBe('tag');
      expect(spam.evidence[0].matchedText).toBe('recaptcha');
    });

    it('extracts feature from short description with snippet', () => {
      const plugin = createMockPlugin({
        shortDescription: 'Build powerful contact forms with conditional logic and Stripe payments.',
      });

      const logic = extractFeatureForPlugin(plugin, findFeatureDef('conditional-logic'));
      expect(logic.status).toBe('present');
      expect(logic.evidence[0].field).toBe('short_description');
      expect(logic.evidence[0].matchedText.toLowerCase()).toBe('conditional logic');
      expect(logic.evidence[0].snippet).toContain('conditional logic');

      const payments = extractFeatureForPlugin(plugin, findFeatureDef('payments'));
      expect(payments.status).toBe('present');
      expect(payments.evidence[0].field).toBe('short_description');
      expect(payments.evidence[0].matchedText.toLowerCase()).toContain('stripe');
    });

    it('extracts feature from full description when available', () => {
      const plugin = createMockPlugin({
        shortDescription: 'Simple form builder.',
        description: 'Advanced features include file uploads, Zapier integration, and webhook endpoints.',
      });

      const uploads = extractFeatureForPlugin(plugin, findFeatureDef('file-uploads'));
      expect(uploads.status).toBe('present');
      expect(uploads.evidence[0].field).toBe('description');
      expect(uploads.evidence[0].matchedText.toLowerCase()).toBe('file uploads');

      const zapier = extractFeatureForPlugin(plugin, findFeatureDef('zapier'));
      expect(zapier.status).toBe('present');
      expect(zapier.evidence[0].field).toBe('description');
      expect(zapier.evidence[0].matchedText.toLowerCase()).toBe('zapier');
    });
  });

  describe('Synonyms and phrase boundary safety', () => {
    it('matches synonyms such as webhook and webhooks', () => {
      const webhookDef = findFeatureDef('webhooks');

      const singularPlugin = createMockPlugin({
        shortDescription: 'Send data with an outgoing webhook trigger.',
      });
      const pluralPlugin = createMockPlugin({
        shortDescription: 'Supports REST API webhooks for automation.',
      });

      const resSingular = extractFeatureForPlugin(singularPlugin, webhookDef);
      const resPlural = extractFeatureForPlugin(pluralPlugin, webhookDef);

      expect(resSingular.status).toBe('present');
      expect(resSingular.evidence[0].matchedText.toLowerCase()).toBe('webhook');

      expect(resPlural.status).toBe('present');
      expect(resPlural.evidence[0].matchedText.toLowerCase()).toBe('webhooks');
    });

    it('avoids phrase boundary false positives', () => {
      const paymentsDef = findFeatureDef('payments');
      const gutenbergDef = findFeatureDef('gutenberg-blocks');
      const mailchimpDef = findFeatureDef('mailchimp');

      const falsePositivePlugin = createMockPlugin({
        shortDescription: 'Features a striped background, blockbuster themes, and chimpanzee icons.',
        description: 'A comprehensive layout system.',
      });

      const payments = extractFeatureForPlugin(falsePositivePlugin, paymentsDef);
      const gutenberg = extractFeatureForPlugin(falsePositivePlugin, gutenbergDef);
      const mailchimp = extractFeatureForPlugin(falsePositivePlugin, mailchimpDef);

      // Should not match "striped" for Stripe, "blockbuster" for Gutenberg blocks, or "chimpanzee" for Mailchimp
      expect(payments.status).toBe('absent');
      expect(gutenberg.status).toBe('absent');
      expect(mailchimp.status).toBe('absent');
    });
  });

  describe('Missing descriptions produce unknown status', () => {
    it('returns unknown when description is not loaded and no match found in short description or tags', () => {
      const plugin = createMockPlugin({
        shortDescription: 'Just a basic form plugin.',
        description: null, // Full description was not loaded
      });

      const logic = extractFeatureForPlugin(plugin, findFeatureDef('conditional-logic'));
      expect(logic.status).toBe('unknown');
      expect(logic.evidence).toEqual([]);
    });

    it('returns absent when full description is provided and thoroughly searched with zero matches', () => {
      const plugin = createMockPlugin({
        shortDescription: 'Just a basic form plugin.',
        description: 'This plugin provides a minimal single-column form with standard input fields and nothing else.',
      });

      const logic = extractFeatureForPlugin(plugin, findFeatureDef('conditional-logic'));
      expect(logic.status).toBe('absent');
      expect(logic.evidence).toEqual([]);
    });
  });

  describe('Subject and competitor independence', () => {
    it('ensures a competitor feature never becomes a confirmed subject feature', () => {
      const subject = createMockPlugin({
        slug: 'my-subject-form',
        shortDescription: 'Basic contact form without extras.',
        description: null,
      });

      const competitor = createMockPlugin({
        slug: 'competitor-super-form',
        shortDescription: 'Includes conditional logic and Stripe payments.',
        description: 'Full multi-step forms with webhook support.',
      });

      const subjectFeatures = extractPluginFeatures(subject);
      const competitorFeatures = extractPluginFeatures(competitor);

      const subjectLogic = subjectFeatures.find((f) => f.featureId === 'conditional-logic');
      const competitorLogic = competitorFeatures.find((f) => f.featureId === 'conditional-logic');

      expect(competitorLogic?.status).toBe('present');
      expect(subjectLogic?.status).toBe('unknown'); // Subject never borrows competitor's presence
      expect(subjectLogic?.evidence).toEqual([]);
    });
  });
});
