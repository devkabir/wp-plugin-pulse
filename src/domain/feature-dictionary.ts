import type { FeatureDefinition, NormalizedPlugin } from './plugin-types';
import { normalizePluginTags } from './tag-intelligence';

/**
 * Universal feature dictionary for ANY WordPress plugin.
 * Covers general platform capabilities, integrations, accessibility, and standard WordPress APIs.
 */
export const UNIVERSAL_WORDPRESS_FEATURE_DICTIONARY: readonly FeatureDefinition[] = [
  {
    id: 'gutenberg-blocks',
    name: 'Gutenberg Blocks & FSE',
    category: 'editor',
    description: 'Native Gutenberg block editor integration and Full Site Editing (FSE) block support.',
    tagSlugs: [
      'gutenberg',
      'gutenberg-block',
      'gutenberg-blocks',
      'blocks',
      'block',
      'block-editor',
      'fse',
      'full-site-editing',
    ],
    patterns: [
      /\bgutenberg(?:\s+blocks?)?\b/i,
      /\bblock\s+editor(?:\s+blocks?)?\b/i,
      /\b(?:custom|native)\s+blocks?\b/i,
      /\bfse\s+compatible\b/i,
      /\bfull\s+site\s+editing\b/i,
      /\bwordpress\s+blocks?\b/i,
    ],
  },
  {
    id: 'elementor-widgets',
    name: 'Page Builder Widgets',
    category: 'editor',
    description: 'Dedicated widgets and modules for Elementor, Beaver Builder, Divi, or Bricks.',
    tagSlugs: [
      'elementor',
      'elementor-addon',
      'elementor-widget',
      'page-builder',
      'divi',
      'beaver-builder',
      'bricks',
    ],
    patterns: [
      /\belementor(?:\s+widgets?|\s+addon|\s+integration)?\b/i,
      /\bpage\s+builder\s+(?:widgets?|modules?|addons?)\b/i,
      /\bdivi\s+modules?\b/i,
    ],
  },
  {
    id: 'rest-api-webhooks',
    name: 'REST API & Webhooks',
    category: 'developer',
    description: 'Custom REST API endpoints, webhooks, and programmatic webhook payload dispatch.',
    tagSlugs: [
      'rest-api',
      'api',
      'webhook',
      'webhooks',
      'custom-api',
      'endpoints',
    ],
    patterns: [
      /\bwebhooks?\b/i,
      /\brest\s+api\b/i,
      /\bjson\s+endpoints?\b/i,
      /\bhttp\s+post\s+webhooks?\b/i,
      /\bcustom\s+endpoints?\b/i,
    ],
  },
  {
    id: 'wp-cli',
    name: 'WP-CLI Integration',
    category: 'developer',
    description: 'Command-line management and automation commands via WP-CLI.',
    tagSlugs: ['wp-cli', 'cli', 'command-line'],
    patterns: [
      /\bwp[ -]?cli\b/i,
      /\bcommand\s+line\s+(?:interface|commands?)\b/i,
    ],
  },
  {
    id: 'multisite-support',
    name: 'Multisite Support',
    category: 'platform',
    description: 'Compatible with WordPress Multisite (WPMU) and network-wide activation.',
    tagSlugs: ['multisite', 'wpmu', 'network', 'multi-site'],
    patterns: [
      /\bmultisite(?:\s+compatible|\s+support|\s+ready)?\b/i,
      /\bnetwork[ -]wide\s+activation\b/i,
      /\bwpmu\b/i,
    ],
  },
  {
    id: 'import-export',
    name: 'Import & Export',
    category: 'data',
    description: 'Import and export configurations, data, or entries via JSON, CSV, or XML.',
    tagSlugs: ['import', 'export', 'import-export', 'csv', 'backup'],
    patterns: [
      /\bimport(?:\s+and|\s*\/\s*)export\b/i,
      /\bexport\s+(?:to\s+)?csv\b/i,
      /\bexport\s+(?:to\s+)?json\b/i,
      /\bbackup\s+(?:and|\s*\/\s*)restore\b/i,
      /\bdata\s+migration\b/i,
    ],
  },
  {
    id: 'translation-ready',
    name: 'Translation & Multilingual Ready',
    category: 'localization',
    description: 'Internationalization (i18n), POT files, WPML, and Polylang compatibility.',
    tagSlugs: ['translation', 'i18n', 'wpml', 'polylang', 'multilingual', 'localization'],
    patterns: [
      /\btranslation\s+ready\b/i,
      /\bwpml(?:\s+compatible|\s+ready|\s+integration)?\b/i,
      /\bpolylang(?:\s+compatible|\s+ready)?\b/i,
      /\bmultilingual(?:\s+support|\s+compatible)?\b/i,
      /\bi18n\b/i,
      /\blocaliz(?:ation|ed)\b/i,
    ],
  },
  {
    id: 'privacy-gdpr',
    name: 'GDPR & Privacy Compliance',
    category: 'compliance',
    description: 'Cookie consent, user data erasure, GDPR compliance, and privacy tools.',
    tagSlugs: ['gdpr', 'privacy', 'cookie-consent', 'compliance', 'ccpa'],
    patterns: [
      /\bgdpr(?:\s+compliance|\s+compliant|\s+ready)?\b/i,
      /\bprivacy\s+policy\b/i,
      /\bcookie\s+(?:consent|banner|notice)\b/i,
      /\bccpa\b/i,
      /\bdata\s+erasure\b/i,
    ],
  },
  {
    id: 'role-permissions',
    name: 'Roles & Permissions',
    category: 'security',
    description: 'Granular access controls, user capability checks, and custom role permissions.',
    tagSlugs: ['roles', 'permissions', 'access-control', 'capabilities', 'user-roles'],
    patterns: [
      /\buser\s+roles?\s+(?:and|\s*\/\s*)permissions?\b/i,
      /\baccess\s+control\b/i,
      /\buser\s+capabilities\b/i,
      /\brole[ -]based\s+access\b/i,
    ],
  },
  {
    id: 'email-smtp-notifications',
    name: 'Email & SMTP Notifications',
    category: 'communication',
    description: 'Automated email alerts, custom email templates, and SMTP delivery support.',
    tagSlugs: ['email', 'notifications', 'smtp', 'mail', 'alerts'],
    patterns: [
      /\bemail\s+notifications?\b/i,
      /\bcustom\s+email\s+templates?\b/i,
      /\bsmtp(?:\s+configuration|\s+support|\s+integration)?\b/i,
      /\bauto[ -]?responder\b/i,
    ],
  },
  {
    id: 'spam-protection',
    name: 'reCAPTCHA, hCaptcha & Turnstile',
    category: 'security',
    description: 'Block spam submissions with Google reCAPTCHA v2/v3, Cloudflare Turnstile, and hCaptcha.',
    tagSlugs: [
      'recaptcha',
      'hcaptcha',
      'turnstile',
      'captcha',
      'spam-protection',
      'anti-spam',
      'honeypot',
      'cloudflare-turnstile',
      'google-recaptcha',
      'recaptcha-v3',
    ],
    patterns: [
      /\bre[ -]?captcha(?:\s*v[23])?\b/i,
      /\bh[ -]?captcha\b/i,
      /\b(?:cloudflare\s+)?turnstile\b/i,
      /\bgoogle\s+recaptcha\b/i,
      /\bspam\s+protection\b/i,
      /\bhoneypot\s+(?:spam|field|protection)\b/i,
      /\banti[ -]?spam\b/i,
      /\bcaptchas?\b/i,
    ],
  },
  {
    id: 'payments',
    name: 'Payments (Stripe & PayPal)',
    category: 'integrations',
    description: 'Accept credit cards, Stripe, PayPal, or one-time/recurring payments through forms.',
    tagSlugs: [
      'stripe',
      'paypal',
      'payments',
      'payment',
      'accept-payments',
      'credit-card',
      'stripe-payments',
      'paypal-payments',
      'checkout',
    ],
    patterns: [
      /\bstripe(?:\s+payments?|\s+checkout|\s+elements?|\s+gateway)?\b/i,
      /\bpay[ -]?pal(?:\s+payments?|\s+standard|\s+express|\s+checkout|\s+gateway)?\b/i,
      /\b(?:accept|collect|process)\s+payments?\b/i,
      /\bpayment\s+(?:gateways?|processing|integrations?|fields?|forms?)\b/i,
      /\bcredit\s+card\s+payments?\b/i,
      /\b(?:recurring|subscription|one[ -]time)\s+payments?\b/i,
    ],
  },
  {
    id: 'zapier',
    name: 'Zapier & Automations',
    category: 'integrations',
    description: 'Automate workflows with Zapier, Make/Integromat, or external services.',
    tagSlugs: [
      'zapier',
      'zapier-integration',
      'zapier-addon',
      'automation',
      'integromat',
      'make',
    ],
    patterns: [
      /\bzapier\b/i,
      /\bzapier\s+(?:integration|addon|add-on|connection|zaps?|webhooks?)\b/i,
      /\bmake\.com\b/i,
      /\bintegromat\b/i,
    ],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp & Newsletter',
    category: 'integrations',
    description: 'Subscribe leads and contact submissions directly to Mailchimp audiences and lists.',
    tagSlugs: [
      'mailchimp',
      'mail-chimp',
      'mailchimp-forms',
      'mailchimp-integration',
      'newsletter',
      'email-marketing',
    ],
    patterns: [
      /\bmail[ -]?chimp\b/i,
      /\bmailchimp\s+(?:integration|lists?|audiences?|subscribers?|tags?|newsletter|groups?)\b/i,
    ],
  },
];

/**
 * Form builder niche feature dictionary.
 */
export const FORM_BUILDER_FEATURE_DICTIONARY: readonly FeatureDefinition[] = [
  {
    id: 'conditional-logic',
    name: 'Conditional Logic',
    category: 'form-builder',
    description: 'Dynamically show, hide, or branch fields and sections based on user selections.',
    tagSlugs: [
      'conditional-logic',
      'conditional-fields',
      'conditional',
      'conditional-forms',
      'branching-logic',
      'logic',
    ],
    patterns: [
      /\bconditional\s+(?:logic|fields?|rules?|branching|show|step|steps|section|sections|actions?)\b/i,
      /\b(?:show\s*\/?\s*hide|smart)\s+fields?\b/i,
      /\bbranching\s+logic\b/i,
      /\bdynamic\s+field\s+visibility\b/i,
      /\bconditional\s+formatting\b/i,
    ],
  },
  {
    id: 'multi-step-forms',
    name: 'Multi-Step Forms',
    category: 'form-builder',
    description: 'Split complex forms into multiple pages or steps with progress indicators.',
    tagSlugs: [
      'multi-step',
      'multi-step-form',
      'multi-step-forms',
      'multistep',
      'multistep-form',
      'multi-page',
      'multi-page-form',
      'multipage',
      'step-form',
      'step-forms',
      'form-steps',
      'page-break',
    ],
    patterns: [
      /\bmulti[ -]?(?:step|page|part|stage)s?(?:\s+forms?)?\b/i,
      /\bstep[ -]by[ -]step(?:\s+forms?)?\b/i,
      /\bconversational\s+forms?\b/i,
      /\bpaged?\s+forms?\b/i,
      /\bform\s+steps?\b/i,
      /\bform\s+pagination\b/i,
      /\bprogress\s+bars?\s+(?:for|in)\s+forms?\b/i,
    ],
  },
  {
    id: 'calculations',
    name: 'Calculations & Formulas',
    category: 'form-builder',
    description: 'Perform dynamic calculations, pricing estimates, formulas, and math operations.',
    tagSlugs: [
      'calculation',
      'calculations',
      'calculator',
      'calculated-fields',
      'cost-calculator',
      'price-calculator',
      'formula',
      'formulas',
      'math',
      'estimation',
    ],
    patterns: [
      /\bcalculated\s+(?:fields?|values?|forms?|pricing|amounts?)\b/i,
      /\b(?:cost|price|quote|roi|mortgage|loan|bmi|calorie|fitness|custom|order)\s+calculator\b/i,
      /\bform\s+calculations?\b/i,
      /\b(?:math|mathematical|formula|dynamic)\s+calculations?\b/i,
      /\bformula\s+(?:fields?|builder|evaluator)\b/i,
      /\bcalculate\s+(?:totals?|price|pricing|cost|subtotal|values?|quotes?|estimates?)\b/i,
    ],
  },
  {
    id: 'file-uploads',
    name: 'File Uploads',
    category: 'form-builder',
    description: 'Allow users to attach files, images, PDFs, or media documents in form submissions.',
    tagSlugs: [
      'file-upload',
      'file-uploads',
      'upload',
      'uploads',
      'file-uploader',
      'attachment',
      'attachments',
      'media-upload',
    ],
    patterns: [
      /\bfile\s+uploads?\b/i,
      /\bupload\s+(?:files?|documents?|images?|attachments?|media|resumes?|photos?|videos?)\b/i,
      /\bfile\s+attachments?\b/i,
      /\bmulti[ -]?file\s+uploads?\b/i,
      /\bfile\s+uploader\b/i,
      /\baccept\s+file\s+uploads?\b/i,
    ],
  },
  {
    id: 'payments',
    name: 'Payments (Stripe & PayPal)',
    category: 'integrations',
    description: 'Accept credit cards, Stripe, PayPal, or one-time/recurring payments through forms.',
    tagSlugs: [
      'stripe',
      'paypal',
      'payments',
      'payment',
      'accept-payments',
      'credit-card',
      'stripe-payments',
      'paypal-payments',
      'checkout',
    ],
    patterns: [
      /\bstripe(?:\s+payments?|\s+checkout|\s+elements?|\s+gateway)?\b/i,
      /\bpay[ -]?pal(?:\s+payments?|\s+standard|\s+express|\s+checkout|\s+gateway)?\b/i,
      /\b(?:accept|collect|process)\s+payments?\b/i,
      /\bpayment\s+(?:gateways?|processing|integrations?|fields?|forms?)\b/i,
      /\bcredit\s+card\s+payments?\b/i,
      /\b(?:recurring|subscription|one[ -]time)\s+payments?\b/i,
    ],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp Integration',
    category: 'integrations',
    description: 'Subscribe leads and contact submissions directly to Mailchimp audiences and lists.',
    tagSlugs: [
      'mailchimp',
      'mail-chimp',
      'mailchimp-forms',
      'mailchimp-integration',
      'newsletter',
    ],
    patterns: [
      /\bmail[ -]?chimp\b/i,
      /\bmailchimp\s+(?:integration|lists?|audiences?|subscribers?|tags?|newsletter|groups?)\b/i,
    ],
  },
  {
    id: 'zapier',
    name: 'Zapier Integration',
    category: 'integrations',
    description: 'Automate workflows with Zapier to send form submissions to thousands of web apps.',
    tagSlugs: [
      'zapier',
      'zapier-integration',
      'zapier-addon',
      'automation',
    ],
    patterns: [
      /\bzapier\b/i,
      /\bzapier\s+(?:integration|addon|add-on|connection|zaps?|webhooks?)\b/i,
    ],
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    category: 'integrations',
    description: 'Trigger HTTP POST/GET requests and JSON payloads to custom endpoints on form submit.',
    tagSlugs: [
      'webhook',
      'webhooks',
      'custom-webhook',
      'rest-api',
      'api-webhook',
    ],
    patterns: [
      /\bwebhooks?\b/i,
      /\bhttp\s+post\s+webhooks?\b/i,
      /\bcustom\s+webhooks?\b/i,
      /\bwebhook\s+(?:url|urls|endpoints?|actions?|payloads?|integration|feed)\b/i,
    ],
  },
  {
    id: 'spam-protection',
    name: 'reCAPTCHA, hCaptcha & Turnstile',
    category: 'security',
    description: 'Block spam submissions with Google reCAPTCHA v2/v3, Cloudflare Turnstile, and hCaptcha.',
    tagSlugs: [
      'recaptcha',
      'hcaptcha',
      'turnstile',
      'captcha',
      'spam-protection',
      'anti-spam',
      'honeypot',
      'cloudflare-turnstile',
      'google-recaptcha',
      'recaptcha-v3',
    ],
    patterns: [
      /\bre[ -]?captcha(?:\s*v[23])?\b/i,
      /\bh[ -]?captcha\b/i,
      /\b(?:cloudflare\s+)?turnstile\b/i,
      /\bgoogle\s+recaptcha\b/i,
      /\bspam\s+protection\b/i,
      /\bhoneypot\s+(?:spam|field|protection)\b/i,
      /\banti[ -]?spam\b/i,
      /\bcaptchas?\b/i,
    ],
  },
  {
    id: 'gutenberg-blocks',
    name: 'Gutenberg Blocks',
    category: 'form-builder',
    description: 'Native Gutenberg block editor integration and Full Site Editing (FSE) block support.',
    tagSlugs: [
      'gutenberg',
      'gutenberg-block',
      'gutenberg-blocks',
      'blocks',
      'block',
      'block-editor',
      'fse',
      'full-site-editing',
    ],
    patterns: [
      /\bgutenberg(?:\s+blocks?)?\b/i,
      /\bblock\s+editor(?:\s+blocks?)?\b/i,
      /\b(?:form|native)\s+blocks?\b/i,
      /\bfse\s+compatible\b/i,
      /\bfull\s+site\s+editing\b/i,
      /\bwordpress\s+blocks?\b/i,
    ],
  },
];

/**
 * SEO niche feature dictionary.
 */
export const SEO_FEATURE_DICTIONARY: readonly FeatureDefinition[] = [
  {
    id: 'xml-sitemaps',
    name: 'XML Sitemaps',
    category: 'seo',
    description: 'Automatic XML and image sitemap generation with indexer pinging.',
    tagSlugs: ['sitemap', 'xml-sitemap', 'sitemaps', 'google-sitemap'],
    patterns: [/\bxml\s+sitemaps?\b/i, /\bgenerate\s+sitemaps?\b/i, /\bimage\s+sitemaps?\b/i],
  },
  {
    id: 'schema-markup',
    name: 'Schema & Rich Snippets',
    category: 'seo',
    description: 'Structured data (JSON-LD), Schema.org, and Google Rich Snippets integration.',
    tagSlugs: ['schema', 'rich-snippets', 'json-ld', 'structured-data'],
    patterns: [/\bschema(?:\.org|\s+markup|\s+generator)?\b/i, /\brich\s+snippets?\b/i, /\bjson[ -]?ld\b/i],
  },
  {
    id: 'opengraph-meta',
    name: 'OpenGraph & Social Meta',
    category: 'seo',
    description: 'Facebook OpenGraph, Twitter Cards, and social sharing previews.',
    tagSlugs: ['opengraph', 'open-graph', 'social-meta', 'twitter-cards'],
    patterns: [/\bopen\s*graph\b/i, /\btwitter\s+cards?\b/i, /\bsocial\s+meta\b/i],
  },
  {
    id: 'redirect-manager',
    name: '301 Redirect Manager',
    category: 'seo',
    description: 'URL redirects (301, 302), 404 monitoring, and auto-redirect creation on slug changes.',
    tagSlugs: ['redirect', 'redirects', '301-redirect', '404-monitor'],
    patterns: [/\b301\s+redirects?\b/i, /\bredirect\s+manager\b/i, /\b404\s+monitor(?:ing)?\b/i],
  },
  {
    id: 'breadcrumbs',
    name: 'Breadcrumbs Navigation',
    category: 'seo',
    description: 'Configurable breadcrumbs navigation with schema markup.',
    tagSlugs: ['breadcrumbs', 'breadcrumb', 'navigation'],
    patterns: [/\bbreadcrumbs?(?:\s+navigation|\s+trail|\s+schema)?\b/i],
  },
];

/**
 * E-commerce niche feature dictionary.
 */
export const ECOMMERCE_FEATURE_DICTIONARY: readonly FeatureDefinition[] = [
  {
    id: 'product-variations',
    name: 'Product Variations & Options',
    category: 'ecommerce',
    description: 'Variable products, custom attributes, and color/size swatches.',
    tagSlugs: ['variations', 'attributes', 'swatches', 'product-addons'],
    patterns: [/\bproduct\s+variations?\b/i, /\bvariable\s+products?\b/i, /\battribute\s+swatches\b/i],
  },
  {
    id: 'cart-checkout',
    name: 'Cart & Checkout Customization',
    category: 'ecommerce',
    description: 'Slide-out side cart, one-page checkout, or checkout field editor.',
    tagSlugs: ['cart', 'checkout', 'side-cart', 'one-page-checkout'],
    patterns: [/\b(?:side|sticky|floating)\s+cart\b/i, /\bone[ -]page\s+checkout\b/i, /\bcheckout\s+customiz(?:ation|er)\b/i],
  },
  {
    id: 'coupons-discounts',
    name: 'Coupons & Dynamic Discounts',
    category: 'ecommerce',
    description: 'BOGO deals, tiered quantity discounts, and promotional coupons.',
    tagSlugs: ['coupons', 'discounts', 'bogo', 'pricing-rules'],
    patterns: [/\bcoupons?\b/i, /\bdynamic\s+pricing\b/i, /\bquantity\s+discounts?\b/i, /\bbogo\b/i],
  },
];

/**
 * Registry of available niche dictionaries.
 */
export const NICHE_DICTIONARIES: Record<string, readonly FeatureDefinition[]> = {
  'form-builder': FORM_BUILDER_FEATURE_DICTIONARY,
  forms: FORM_BUILDER_FEATURE_DICTIONARY,
  form: FORM_BUILDER_FEATURE_DICTIONARY,
  seo: SEO_FEATURE_DICTIONARY,
  ecommerce: ECOMMERCE_FEATURE_DICTIONARY,
  woocommerce: ECOMMERCE_FEATURE_DICTIONARY,
  universal: UNIVERSAL_WORDPRESS_FEATURE_DICTIONARY,
};

/**
 * Combined default dictionary containing both universal WordPress features and common niche features.
 * Provides a comprehensive generic comparison baseline for any WordPress plugin.
 */
export const DEFAULT_FEATURE_DICTIONARY: readonly FeatureDefinition[] = [
  ...UNIVERSAL_WORDPRESS_FEATURE_DICTIONARY,
  // Add specific niche features deduplicating by ID
  ...FORM_BUILDER_FEATURE_DICTIONARY.filter(
    (fb) => !UNIVERSAL_WORDPRESS_FEATURE_DICTIONARY.some((u) => u.id === fb.id)
  ),
  ...SEO_FEATURE_DICTIONARY.filter(
    (seo) => !UNIVERSAL_WORDPRESS_FEATURE_DICTIONARY.some((u) => u.id === seo.id)
  ),
  ...ECOMMERCE_FEATURE_DICTIONARY.filter(
    (ecom) => !UNIVERSAL_WORDPRESS_FEATURE_DICTIONARY.some((u) => u.id === ecom.id)
  ),
];

/**
 * Resolves the optimal feature dictionary for a given set of plugins dynamically.
 * If plugins belong to an identified niche (e.g. form-builder, seo, ecommerce),
 * merges the niche dictionary with universal WordPress features.
 */
export function resolveFeatureDictionary(
  plugins?: readonly NormalizedPlugin[],
  customDictionary?: readonly FeatureDefinition[]
): readonly FeatureDefinition[] {
  if (customDictionary && customDictionary.length > 0) {
    return customDictionary;
  }

  if (!plugins || plugins.length === 0) {
    return DEFAULT_FEATURE_DICTIONARY;
  }

  // Detect niche from all tags in the comparison set
  const allTags = new Set<string>();
  for (const plugin of plugins) {
    for (const tag of normalizePluginTags(plugin.tags)) {
      allTags.add(tag.slug);
    }
  }

  const selectedFeatures = new Map<string, FeatureDefinition>();

  // Always include universal features
  for (const feature of UNIVERSAL_WORDPRESS_FEATURE_DICTIONARY) {
    selectedFeatures.set(feature.id, feature);
  }

  let matchedNiche = false;

  // Check for form builder niche matches
  if (
    allTags.has('form') ||
    allTags.has('forms') ||
    allTags.has('form-builder') ||
    allTags.has('contact-form') ||
    allTags.has('contact-form-7')
  ) {
    matchedNiche = true;
    for (const feature of FORM_BUILDER_FEATURE_DICTIONARY) {
      selectedFeatures.set(feature.id, feature);
    }
  }

  // Check for SEO niche matches
  if (allTags.has('seo') || allTags.has('sitemap') || allTags.has('schema')) {
    matchedNiche = true;
    for (const feature of SEO_FEATURE_DICTIONARY) {
      selectedFeatures.set(feature.id, feature);
    }
  }

  // Check for eCommerce niche matches
  if (
    allTags.has('woocommerce') ||
    allTags.has('ecommerce') ||
    allTags.has('e-commerce') ||
    allTags.has('shop')
  ) {
    matchedNiche = true;
    for (const feature of ECOMMERCE_FEATURE_DICTIONARY) {
      selectedFeatures.set(feature.id, feature);
    }
  }

  // If no specific niche was detected from tags, return full default feature dictionary
  if (!matchedNiche) {
    return DEFAULT_FEATURE_DICTIONARY;
  }

  return Array.from(selectedFeatures.values());
}
