import { describe, expect, it } from 'bun:test';
import { auditReadme } from './readme-audit';
import type { NormalizedPlugin } from './plugin-types';
import type { WordPressReleaseInfo } from './recommendations';

function createMockCompetitor(
  slug: string,
  tags: string[],
  overrides: Partial<NormalizedPlugin> = {}
): NormalizedPlugin {
  return {
    name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    slug,
    version: '2.0.0',
    authorName: 'Test Author',
    authorProfileUrl: null,
    homepageUrl: null,
    pluginUrl: `https://wordpress.org/plugins/${slug}/`,
    downloadUrl: `https://downloads.wordpress.org/plugin/${slug}.zip`,
    iconUrl: null,
    shortDescription: 'Competitor description',
    tags,
    activeInstalls: 50000,
    activeInstallsDisplay: '50K',
    lifetimeDownloads: 200000,
    lifetimeDownloadsDisplay: '200K',
    lifetimeInstallPace: 45.2,
    lifetimeInstallPaceDisplay: '45.2',
    daysSinceAdded: 1100,
    ratingPercent: 96,
    ratingScore: 4.8,
    ratingScoreDisplay: '4.8',
    ratingCount: 150,
    ratingDistribution: { 1: 2, 2: 1, 3: 5, 4: 20, 5: 122 },
    supportThreads: 20,
    supportThreadsResolved: 18,
    supportResolutionRate: 90,
    addedAt: '2021-01-01T00:00:00Z',
    lastUpdatedAt: '2024-05-01T00:00:00Z',
    lastUpdatedRelative: '10 days ago',
    freshness: 'fresh',
    requiresWordPress: '5.8',
    testedWordPress: '6.7',
    requiresPhp: '7.4',
    requiredPlugins: [],
    ...overrides,
  };
}

describe('PR 8 — Deterministic Audit and Recommendations', () => {
  const validReadmeSource = `=== Pluximof Forms ===
Contributors: devkabir
Tags: form-builder, contact-form, forms
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

A fast and accessible contact form builder for WordPress.

== Description ==
Create beautiful responsive contact forms and survey forms easily.
Includes built-in email notifications and Gutenberg block.

== Installation ==
1. Upload the plugin files to the \`/wp-content/plugins/pluximof-forms\` directory.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Use the block editor or shortcode to add forms to any page.
`;

  const validPhpSource = `<?php
/**
 * Plugin Name: Pluximof Forms
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: GPLv2 or later
 * Text Domain: pluximof-forms
 */
`;

  it('runs a clean audit with 0 errors on valid files and separates diagnostics', () => {
    const result = auditReadme({
      readme: validReadmeSource,
      phpHeaders: validPhpSource,
    });

    expect(result.summary.errorCount).toBe(0);
    expect(result.diagnostics).toBeArray();
    expect(result.recommendations).toBeArray();
    // Verify every recommendation has evidence and reason
    for (const rec of result.recommendations) {
      expect(rec.evidence.length).toBeGreaterThan(0);
      expect(rec.reason.length).toBeGreaterThan(0);
    }
  });

  it('detects missing or malformed plugin title (error)', () => {
    const missingTitleReadme = `Contributors: devkabir
Tags: forms
Tested up to: 6.6

Short description here.
`;
    const result = auditReadme({
      readme: missingTitleReadme,
      phpHeaders: validPhpSource,
    });

    const titleRec = result.recommendations.find((r) => r.id === 'rule-missing-malformed-title');
    expect(titleRec).toBeDefined();
    expect(titleRec?.severity).toBe('error');
    expect(titleRec?.category).toBe('syntax');
    expect(titleRec?.evidence.length).toBeGreaterThan(0);
    expect(titleRec?.proposedEdit?.newText).toContain('=== Pluximof Forms ===');
  });

  it('detects missing tags or more than 5 tags (error)', () => {
    const zeroTagsReadme = validReadmeSource.replace('Tags: form-builder, contact-form, forms', 'Tags: ');
    const zeroResult = auditReadme({ readme: zeroTagsReadme });
    const zeroRec = zeroResult.recommendations.find((r) => r.id === 'rule-tags-count-zero');
    expect(zeroRec).toBeDefined();
    expect(zeroRec?.severity).toBe('error');

    const excessTagsReadme = validReadmeSource.replace(
      'Tags: form-builder, contact-form, forms',
      'Tags: tag1, tag2, tag3, tag4, tag5, tag6'
    );
    const excessResult = auditReadme({ readme: excessTagsReadme });
    const excessRec = excessResult.recommendations.find((r) => r.id === 'rule-tags-count-excess');
    expect(excessRec).toBeDefined();
    expect(excessRec?.severity).toBe('error');
    expect(excessRec?.proposedEdit?.newText).toBe('tag1, tag2, tag3, tag4, tag5');
  });

  it('detects duplicate tags (warning)', () => {
    const dupTagsReadme = validReadmeSource.replace(
      'Tags: form-builder, contact-form, forms',
      'Tags: form-builder, Form-Builder, contact-form'
    );
    const result = auditReadme({ readme: dupTagsReadme });
    const dupRec = result.recommendations.find((r) => r.id === 'rule-duplicate-tags');
    expect(dupRec).toBeDefined();
    expect(dupRec?.severity).toBe('warning');
    expect(dupRec?.proposedEdit?.newText).toBe('form-builder, contact-form');
  });

  it('detects short description over 150 characters (warning)', () => {
    const longDesc = 'A'.repeat(160);
    const longDescReadme = validReadmeSource.replace(
      'A fast and accessible contact form builder for WordPress.',
      longDesc
    );
    const result = auditReadme({ readme: longDescReadme });
    const descRec = result.recommendations.find((r) => r.id === 'rule-short-description-length');
    expect(descRec).toBeDefined();
    expect(descRec?.severity).toBe('warning');
    expect(descRec?.requiresConfirmation).toBe(true);
  });

  it('detects missing or malformed Tested up to header (warning)', () => {
    const missingTestedReadme = validReadmeSource.replace('Tested up to: 6.6\n', '');
    const missingResult = auditReadme({ readme: missingTestedReadme });
    const missingRec = missingResult.recommendations.find((r) => r.id === 'rule-tested-up-to-missing');
    expect(missingRec).toBeDefined();
    expect(missingRec?.severity).toBe('warning');
    expect(missingRec?.category).toBe('compatibility');
    expect(missingRec?.requiresConfirmation).toBe(true);
    expect(missingRec?.proposedEdit).toBeUndefined(); // Never auto-edit compatibility

    const malformedTestedReadme = validReadmeSource.replace('Tested up to: 6.6', 'Tested up to: latest');
    const malformedResult = auditReadme({ readme: malformedTestedReadme });
    const malformedRec = malformedResult.recommendations.find((r) => r.id === 'rule-tested-up-to-malformed');
    expect(malformedRec).toBeDefined();
    expect(malformedRec?.severity).toBe('warning');
    expect(malformedRec?.requiresConfirmation).toBe(true);
  });

  it('flags Tested up to above current stable/RC when release info is available (error)', () => {
    const releaseInfo: WordPressReleaseInfo = {
      currentStable: '6.6.2',
      currentRc: '6.7-RC1',
    };

    // Plugin claims 6.8 (higher than 6.6.2 and 6.7-RC1)
    const futureTestedReadme = validReadmeSource.replace('Tested up to: 6.6', 'Tested up to: 6.8');
    const result = auditReadme({
      readme: futureTestedReadme,
      releaseInfo,
    });

    expect(result.summary.versionCheckStatus).toBe('checked');
    const exceedsRec = result.recommendations.find((r) => r.id === 'rule-tested-up-to-exceeds-stable');
    expect(exceedsRec).toBeDefined();
    expect(exceedsRec?.severity).toBe('error');
    expect(exceedsRec?.category).toBe('compatibility');
    expect(exceedsRec?.requiresConfirmation).toBe(true);
    expect(exceedsRec?.proposedEdit).toBeUndefined();
  });

  it('skips version-currentness rule and shows "not checked" when release info is unavailable', () => {
    const futureTestedReadme = validReadmeSource.replace('Tested up to: 6.6', 'Tested up to: 6.8');
    const result = auditReadme({
      readme: futureTestedReadme,
      releaseInfo: null,
    });

    expect(result.summary.versionCheckStatus).toBe('not checked');
    const exceedsRec = result.recommendations.find((r) => r.id === 'rule-tested-up-to-exceeds-stable');
    expect(exceedsRec).toBeUndefined();
  });

  it('detects mismatch between readme Stable Tag and main PHP Version (warning)', () => {
    const mismatchPhpSource = `<?php
/**
 * Plugin Name: Pluximof Forms
 * Version: 2.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */
`;
    // Readme has Stable tag: 1.0.0
    const result = auditReadme({
      readme: validReadmeSource,
      phpHeaders: mismatchPhpSource,
    });

    const mismatchRec = result.recommendations.find((r) => r.id === 'rule-stable-tag-mismatch');
    expect(mismatchRec).toBeDefined();
    expect(mismatchRec?.severity).toBe('warning');
    expect(mismatchRec?.proposedEdit?.newText).toBe('2.1.0');
  });

  it('detects missing main-header Requires at least and Requires PHP in PHP docblock (warning)', () => {
    const missingHeadersPhp = `<?php
/**
 * Plugin Name: Pluximof Forms
 * Version: 1.0.0
 * License: GPLv2
 */
`;
    const result = auditReadme({
      readme: validReadmeSource,
      phpHeaders: missingHeadersPhp,
    });

    const reqWpRec = result.recommendations.find((r) => r.id === 'rule-missing-php-requires-at-least');
    expect(reqWpRec).toBeDefined();
    expect(reqWpRec?.severity).toBe('warning');
    expect(reqWpRec?.category).toBe('compatibility');
    expect(reqWpRec?.requiresConfirmation).toBe(true);
    expect(reqWpRec?.proposedEdit).toBeUndefined();

    const reqPhpRec = result.recommendations.find((r) => r.id === 'rule-missing-php-requires-php');
    expect(reqPhpRec).toBeDefined();
    expect(reqPhpRec?.severity).toBe('warning');
    expect(reqPhpRec?.category).toBe('compatibility');
    expect(reqPhpRec?.requiresConfirmation).toBe(true);
  });

  it('detects external services without privacy or third-party disclosure (warning requiring review)', () => {
    const stripeReadme = validReadmeSource + '\nAccept credit card payments easily with Stripe and PayPal checkout.\n';
    const result = auditReadme({
      readme: stripeReadme,
      phpHeaders: validPhpSource,
    });

    const privacyRec = result.recommendations.find((r) => r.id === 'rule-external-service-no-disclosure');
    expect(privacyRec).toBeDefined();
    expect(privacyRec?.category).toBe('privacy');
    expect(privacyRec?.severity).toBe('warning');
    expect(privacyRec?.requiresConfirmation).toBe(true);
    expect(privacyRec?.evidence.length).toBeGreaterThan(0);

    // If disclosure section exists, no warning is triggered
    const disclosedReadme = stripeReadme + '\n== Third-Party Services ==\nThis plugin connects to Stripe API (https://stripe.com) to process payments under Stripe Privacy Policy.\n';
    const disclosedResult = auditReadme({ readme: disclosedReadme });
    expect(disclosedResult.recommendations.find((r) => r.id === 'rule-external-service-no-disclosure')).toBeUndefined();
  });

  it('detects missing installation instructions when configuration language is present (suggestion)', () => {
    const noInstallReadme = `=== Pluximof Forms ===
Contributors: devkabir
Tags: form-builder, forms
Tested up to: 6.6

Configure your API key in the plugin settings page.

== Description ==
Add shortcode [pluximof_form] to any page.
`;
    const result = auditReadme({ readme: noInstallReadme });
    const installRec = result.recommendations.find((r) => r.id === 'rule-missing-installation-instructions');
    expect(installRec).toBeDefined();
    expect(installRec?.severity).toBe('suggestion');
    expect(installRec?.category).toBe('content');
    expect(installRec?.requiresConfirmation).toBe(true);
  });

  it('suggests competitor tags only when gated conditions are met (>= 2 competitors, evidence in subject, total <= 5)', () => {
    // Subject has 2 tags: form-builder, contact-form
    // Subject readme contains the word "survey" in description: "Create beautiful responsive contact forms and survey forms easily."
    // Competitors 1 and 2 both use tag "survey"
    const comp1 = createMockCompetitor('comp-1', ['form-builder', 'survey', 'payment']);
    const comp2 = createMockCompetitor('comp-2', ['contact-form', 'survey', 'zapier']);
    const comp3 = createMockCompetitor('comp-3', ['analytics']); // only 1 comp uses analytics, not in subject

    const result = auditReadme({
      readme: validReadmeSource,
      competitorPlugins: [comp1, comp2, comp3],
    });

    const surveyTagRec = result.recommendations.find((r) => r.id === 'rule-competitor-tag-survey');
    expect(surveyTagRec).toBeDefined();
    expect(surveyTagRec?.category).toBe('positioning');
    expect(surveyTagRec?.severity).toBe('suggestion');
    expect(surveyTagRec?.evidence.some((e) => e.field === 'Readme Content')).toBe(true);

    // "payment" is used by only 1 competitor and not in requestedTags, so should NOT be suggested
    expect(result.recommendations.find((r) => r.id === 'rule-competitor-tag-payment')).toBeUndefined();

    // "analytics" is used by only 1 competitor, so should NOT be suggested
    expect(result.recommendations.find((r) => r.id === 'rule-competitor-tag-analytics')).toBeUndefined();
  });

  it('does not suggest competitor tags if subject tag count is already 5', () => {
    const fiveTagsReadme = validReadmeSource.replace(
      'Tags: form-builder, contact-form, forms',
      'Tags: tag1, tag2, tag3, tag4, tag5'
    );
    const comp1 = createMockCompetitor('comp-1', ['tag1', 'survey']);
    const comp2 = createMockCompetitor('comp-2', ['tag2', 'survey']);

    const result = auditReadme({
      readme: fiveTagsReadme,
      competitorPlugins: [comp1, comp2],
    });

    expect(result.recommendations.find((r) => r.id === 'rule-competitor-tag-survey')).toBeUndefined();
  });

  it('never inserts unsupported competitor features into proposed readme edits', () => {
    const comp1 = createMockCompetitor('comp-1', ['forms'], {
      description: 'Supports advanced conditional logic and calculations.',
    });

    const result = auditReadme({
      readme: validReadmeSource,
      competitorPlugins: [comp1],
    });

    // Verify no recommendation proposed edit contains "conditional logic" or unverified competitor features
    for (const rec of result.recommendations) {
      if (rec.proposedEdit) {
        expect(rec.proposedEdit.newText).not.toContain('conditional logic');
        expect(rec.proposedEdit.newText).not.toContain('calculations');
      }
    }
  });

  it('produces identical output for identical inputs across multiple runs (deterministic stability)', () => {
    const comp1 = createMockCompetitor('comp-1', ['form-builder', 'survey']);
    const comp2 = createMockCompetitor('comp-2', ['contact-form', 'survey']);

    const run1 = auditReadme({
      readme: validReadmeSource,
      phpHeaders: validPhpSource,
      competitorPlugins: [comp1, comp2],
    });

    const run2 = auditReadme({
      readme: validReadmeSource,
      phpHeaders: validPhpSource,
      competitorPlugins: [comp1, comp2],
    });

    expect(run1.recommendations.map((r) => r.id)).toEqual(run2.recommendations.map((r) => r.id));
    expect(run1.summary).toEqual(run2.summary);
  });
});
