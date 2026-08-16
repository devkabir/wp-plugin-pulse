import type { ParsedPhpHeaders, ParsedReadme } from './readme-types';
import type { NormalizedPlugin } from './plugin-types';
import type { Evidence, Recommendation, WordPressReleaseInfo } from './recommendations';
import { checkTestedUpToCurrentness, isValidWordPressVersion } from './wordpress-versions';
import { normalizeTagSlug } from './tag-intelligence';

/**
 * List of known external services requiring WordPress.org directory disclosure.
 */
const EXTERNAL_SERVICE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Stripe', pattern: /\bstripe\b/i },
  { name: 'PayPal', pattern: /\bpaypal\b/i },
  { name: 'Square', pattern: /\bsquare\b(?:\s+payments?|\s+api)?/i },
  { name: 'Mailchimp', pattern: /\bmailchimp\b/i },
  { name: 'Zapier', pattern: /\bzapier\b/i },
  { name: 'Google Fonts', pattern: /\bgoogle\s+fonts?\b/i },
  { name: 'Google Maps', pattern: /\bgoogle\s+maps?\b/i },
  { name: 'Google reCAPTCHA', pattern: /\brecaptcha\b/i },
  { name: 'Cloudflare Turnstile', pattern: /\bturnstile\b/i },
  { name: 'hCaptcha', pattern: /\bhcaptcha\b/i },
  { name: 'AWS S3 / Cloud', pattern: /\b(?:amazon\s+s3|aws\s+s3|aws\s+cloud)\b/i },
  { name: 'OpenAI / AI Service', pattern: /\b(?:openai|chatgpt|claude\s+ai|anthropic)\b/i },
  { name: 'External Webhook / API', pattern: /\b(?:webhooks?|rest\s+api\s+endpoint|external\s+api)\b/i },
];

/**
 * Configuration and setup language patterns.
 */
const CONFIG_LANGUAGE_PATTERNS: Array<{ keyword: string; pattern: RegExp }> = [
  { keyword: 'API key', pattern: /\bapi\s+keys?\b/i },
  { keyword: 'configure', pattern: /\b(?:configure|configuration)\b/i },
  { keyword: 'settings', pattern: /\b(?:settings\s+page|plugin\s+settings)\b/i },
  { keyword: 'credentials', pattern: /\bcredentials\b/i },
  { keyword: 'token', pattern: /\b(?:secret\s+token|access\s+token|bearer\s+token)\b/i },
  { keyword: 'shortcode', pattern: /\bshortcodes?\b/i },
  { keyword: 'options page', pattern: /\boptions\s+page\b/i },
];

/**
 * Rule: Missing or malformed plugin title.
 * Severity: error
 */
export function auditPluginTitle(
  readme: ParsedReadme,
  phpHeaders?: ParsedPhpHeaders | null
): Recommendation | null {
  const title = readme.title;
  const isMissing = !title || !title.value.trim();
  const hasMalformedDiagnostic = readme.diagnostics.some(
    (d) => d.code === 'MALFORMED_TITLE' || d.code === 'MISSING_TITLE'
  );

  if (!isMissing && !hasMalformedDiagnostic) {
    return null;
  }

  const evidence: Evidence[] = [];
  if (title) {
    evidence.push({
      field: 'title',
      matchedText: title.raw,
      line: title.line ?? 1,
      detail: `Current title line: "${title.raw}"`,
    });
  } else {
    evidence.push({
      field: 'title',
      matchedText: '',
      line: 1,
      detail: 'No "=== Plugin Name ===" header found at top of file.',
    });
  }

  // If PHP header has a Plugin Name, propose adding or fixing it
  let proposedEdit = undefined;
  if (phpHeaders?.pluginName?.value) {
    const suggestedTitle = `=== ${phpHeaders.pluginName.value} ===\n\n`;
    if (!title) {
      proposedEdit = {
        start: 0,
        end: 0,
        newText: suggestedTitle,
      };
    } else {
      proposedEdit = {
        start: title.start,
        end: title.end,
        newText: `=== ${phpHeaders.pluginName.value} ===`,
      };
    }
  }

  return {
    id: 'rule-missing-malformed-title',
    category: 'syntax',
    severity: 'error',
    impact: 'high',
    confidence: 'high',
    title: 'Missing or malformed plugin title',
    reason:
      'WordPress readme.txt must begin with a valid "=== Plugin Name ===" header line for directory recognition.',
    evidence,
    proposedEdit,
    requiresConfirmation: false,
  };
}

/**
 * Rule: No tags or more than five tags.
 * Severity: error
 */
export function auditTagsCount(readme: ParsedReadme): Recommendation | null {
  const tagsField = readme.headers['Tags'] ?? readme.headers['tags'];
  const rawValues = tagsField?.values ?? [];
  const validTags = rawValues.filter((t) => t.trim().length > 0);

  if (validTags.length >= 1 && validTags.length <= 5) {
    return null;
  }

  const evidence: Evidence[] = [
    {
      field: 'Tags',
      matchedText: tagsField?.raw ?? 'Tags: (missing)',
      line: tagsField?.line,
      detail: `Found ${validTags.length} tags: [${validTags.join(', ')}]`,
    },
  ];

  let proposedEdit = undefined;
  if (validTags.length > 5 && tagsField?.rawValueRange) {
    const trimmedTags = validTags.slice(0, 5).join(', ');
    proposedEdit = {
      start: tagsField.rawValueRange.start,
      end: tagsField.rawValueRange.end,
      newText: trimmedTags,
    };
  }

  if (validTags.length === 0) {
    return {
      id: 'rule-tags-count-zero',
      category: 'metadata',
      severity: 'error',
      impact: 'high',
      confidence: 'high',
      title: 'Missing plugin tags',
      reason: 'WordPress.org requires between 1 and 5 tags for search indexing and directory discovery.',
      evidence,
      proposedEdit,
      requiresConfirmation: false,
    };
  }

  return {
    id: 'rule-tags-count-excess',
    category: 'metadata',
    severity: 'error',
    impact: 'high',
    confidence: 'high',
    title: 'Too many plugin tags (maximum 5 allowed)',
    reason: `WordPress.org enforces a strict limit of 5 tags. Currently ${validTags.length} tags are defined; extra tags are discarded by WordPress.org.`,
    evidence,
    proposedEdit,
    requiresConfirmation: false,
  };
}

/**
 * Rule: Duplicate tags.
 * Severity: warning
 */
export function auditDuplicateTags(readme: ParsedReadme): Recommendation | null {
  const tagsField = readme.headers['Tags'] ?? readme.headers['tags'];
  if (!tagsField || !tagsField.values || tagsField.values.length === 0) {
    return null;
  }

  const seenSlugs = new Map<string, string>();
  const duplicates: string[] = [];
  const uniqueTags: string[] = [];

  for (const tag of tagsField.values) {
    const slug = normalizeTagSlug(tag);
    if (!slug) continue;

    if (seenSlugs.has(slug)) {
      duplicates.push(tag);
    } else {
      seenSlugs.set(slug, tag);
      uniqueTags.push(tag);
    }
  }

  if (duplicates.length === 0) {
    return null;
  }

  const evidence: Evidence[] = [
    {
      field: 'Tags',
      matchedText: tagsField.raw,
      line: tagsField.line,
      detail: `Duplicate tags found: ${duplicates.join(', ')}`,
    },
  ];

  let proposedEdit = undefined;
  if (tagsField.rawValueRange) {
    proposedEdit = {
      start: tagsField.rawValueRange.start,
      end: tagsField.rawValueRange.end,
      newText: uniqueTags.join(', '),
    };
  }

  return {
    id: 'rule-duplicate-tags',
    category: 'metadata',
    severity: 'warning',
    impact: 'medium',
    confidence: 'high',
    title: 'Duplicate plugin tags detected',
    reason: `Duplicate tags detected: ${duplicates.join(', ')}. WordPress.org tags should be distinct.`,
    evidence,
    proposedEdit,
    requiresConfirmation: false,
  };
}

/**
 * Rule: Short description over 150 characters.
 * Severity: warning
 */
export function auditShortDescriptionLength(readme: ParsedReadme): Recommendation | null {
  const shortDesc = readme.shortDescription;
  if (!shortDesc || !shortDesc.value) {
    return null;
  }

  const charCount = shortDesc.value.length;
  if (charCount <= 150) {
    return null;
  }

  return {
    id: 'rule-short-description-length',
    category: 'metadata',
    severity: 'warning',
    impact: 'medium',
    confidence: 'high',
    title: 'Short description exceeds 150 characters',
    reason: `The short description is ${charCount} characters long. WordPress.org truncates descriptions over 150 characters in directory search results and category listings.`,
    evidence: [
      {
        field: 'Short Description',
        matchedText: shortDesc.raw,
        snippet: shortDesc.value.slice(0, 160) + '...',
        line: shortDesc.line,
        detail: `Length is ${charCount} characters (exceeds 150 character limit by ${charCount - 150}).`,
      },
    ],
    requiresConfirmation: true,
  };
}

/**
 * Rule: Missing or malformed Tested up to.
 * Severity: warning
 */
export function auditTestedUpToFormat(readme: ParsedReadme): Recommendation | null {
  const testedField = readme.headers['Tested up to'] ?? readme.headers['tested up to'];

  if (!testedField || !testedField.value) {
    return {
      id: 'rule-tested-up-to-missing',
      category: 'compatibility',
      severity: 'warning',
      impact: 'high',
      confidence: 'high',
      title: "Missing 'Tested up to' compatibility header",
      reason:
        "The 'Tested up to' header is missing in readme.txt. WordPress.org uses this header to inform users of compatibility and assess freshness.",
      evidence: [
        {
          field: 'Tested up to',
          matchedText: 'Tested up to: (missing)',
          line: 1,
          detail: 'No "Tested up to:" header found in readme headers block.',
        },
      ],
      requiresConfirmation: true,
    };
  }

  if (!isValidWordPressVersion(testedField.value)) {
    return {
      id: 'rule-tested-up-to-malformed',
      category: 'compatibility',
      severity: 'warning',
      impact: 'high',
      confidence: 'high',
      title: "Malformed 'Tested up to' header",
      reason: `'Tested up to' value "${testedField.value}" is not a valid semantic version string (expected e.g. "6.7").`,
      evidence: [
        {
          field: 'Tested up to',
          matchedText: testedField.raw,
          line: testedField.line,
          detail: `Invalid version value: "${testedField.value}"`,
        },
      ],
      requiresConfirmation: true,
    };
  }

  return null;
}

/**
 * Rule: Tested up to above current stable/RC without confirmation.
 * Severity: error
 */
export function auditTestedUpToCurrentness(
  readme: ParsedReadme,
  releaseInfo?: WordPressReleaseInfo | null
): Recommendation | null {
  const testedField = readme.headers['Tested up to'] ?? readme.headers['tested up to'];
  if (!testedField || !testedField.value || !isValidWordPressVersion(testedField.value)) {
    return null;
  }

  const outcome = checkTestedUpToCurrentness(testedField.value, releaseInfo);
  if (outcome.status === 'not checked' || !outcome.exceedsStable) {
    return null;
  }

  return {
    id: 'rule-tested-up-to-exceeds-stable',
    category: 'compatibility',
    severity: 'error',
    impact: 'high',
    confidence: 'high',
    title: 'Tested up to version exceeds current WordPress release',
    reason: `'Tested up to' (${testedField.value}) is higher than the current WordPress release/RC (${outcome.maxAllowedVersion}) without explicit verification.`,
    evidence: [
      {
        field: 'Tested up to',
        matchedText: testedField.raw,
        line: testedField.line,
        detail: `Plugin declares Tested up to ${testedField.value}, while current WordPress release is ${outcome.maxAllowedVersion}.`,
      },
    ],
    requiresConfirmation: true,
  };
}

/**
 * Rule: Stable Tag differs from main PHP Version.
 * Severity: warning
 */
export function auditStableTagVsPhpVersion(
  readme: ParsedReadme,
  phpHeaders?: ParsedPhpHeaders | null
): Recommendation | null {
  if (!phpHeaders || !phpHeaders.version || !phpHeaders.version.value) {
    return null;
  }

  const phpVersion = phpHeaders.version.value.trim();
  const stableTagField = readme.headers['Stable tag'] ?? readme.headers['stable tag'] ?? readme.headers['Stable Tag'];
  const stableTag = stableTagField?.value?.trim();

  if (!stableTag) {
    return {
      id: 'rule-stable-tag-missing',
      category: 'metadata',
      severity: 'warning',
      impact: 'high',
      confidence: 'high',
      title: "Missing 'Stable Tag' in readme",
      reason: `The main PHP file declares Version ${phpVersion}, but readme.txt is missing 'Stable Tag'. WordPress.org may fail to point users to the correct tag.`,
      evidence: [
        {
          field: 'Stable tag',
          matchedText: 'Stable tag: (missing)',
          detail: `Main PHP Version is "${phpVersion}".`,
        },
      ],
      requiresConfirmation: false,
    };
  }

  if (stableTag.toLowerCase() === 'trunk') {
    // trunk is valid in svn workflows, but note if it differs from release version
    return null;
  }

  if (stableTag !== phpVersion) {
    const evidence: Evidence[] = [
      {
        field: 'Stable tag',
        matchedText: stableTagField.raw,
        line: stableTagField.line,
        detail: `Readme Stable Tag is "${stableTag}".`,
      },
      {
        field: 'Version (PHP)',
        matchedText: phpHeaders.version.raw,
        line: phpHeaders.version.line,
        detail: `Main PHP file Version is "${phpVersion}".`,
      },
    ];

    let proposedEdit = undefined;
    if (stableTagField.rawValueRange) {
      proposedEdit = {
        start: stableTagField.rawValueRange.start,
        end: stableTagField.rawValueRange.end,
        newText: phpVersion,
      };
    }

    return {
      id: 'rule-stable-tag-mismatch',
      category: 'metadata',
      severity: 'warning',
      impact: 'high',
      confidence: 'high',
      title: 'Stable Tag differs from main PHP Version',
      reason: `Readme 'Stable Tag' (${stableTag}) does not match main PHP file Version (${phpVersion}). This can cause WordPress.org to serve an outdated release.`,
      evidence,
      proposedEdit,
      requiresConfirmation: false,
    };
  }

  return null;
}

/**
 * Rule: Missing main-header Requires at least.
 * Severity: warning
 */
export function auditRequiresAtLeastHeader(
  phpHeaders?: ParsedPhpHeaders | null
): Recommendation | null {
  if (!phpHeaders || !phpHeaders.pluginName) {
    return null;
  }

  if (!phpHeaders.requiresAtLeast || !phpHeaders.requiresAtLeast.value) {
    return {
      id: 'rule-missing-php-requires-at-least',
      category: 'compatibility',
      severity: 'warning',
      impact: 'medium',
      confidence: 'high',
      title: "Missing main PHP header 'Requires at least'",
      reason:
        "The main plugin PHP file is missing 'Requires at least:'. WordPress uses this header to prevent activation on incompatible WordPress core versions.",
      evidence: [
        {
          source: 'main-plugin.php',
          field: 'Requires at least',
          matchedText: 'Requires at least: (missing)',
          line: phpHeaders.headerRange?.line ?? 1,
          detail: 'Docblock header comment does not declare "Requires at least:".',
        },
      ],
      requiresConfirmation: true,
    };
  }

  return null;
}

/**
 * Rule: Missing main-header Requires PHP.
 * Severity: warning
 */
export function auditRequiresPhpHeader(
  phpHeaders?: ParsedPhpHeaders | null
): Recommendation | null {
  if (!phpHeaders || !phpHeaders.pluginName) {
    return null;
  }

  if (!phpHeaders.requiresPhp || !phpHeaders.requiresPhp.value) {
    return {
      id: 'rule-missing-php-requires-php',
      category: 'compatibility',
      severity: 'warning',
      impact: 'medium',
      confidence: 'high',
      title: "Missing main PHP header 'Requires PHP'",
      reason:
        "The main plugin PHP file is missing 'Requires PHP:'. WordPress uses this header to prevent fatal errors on incompatible PHP versions.",
      evidence: [
        {
          source: 'main-plugin.php',
          field: 'Requires PHP',
          matchedText: 'Requires PHP: (missing)',
          line: phpHeaders.headerRange?.line ?? 1,
          detail: 'Docblock header comment does not declare "Requires PHP:".',
        },
      ],
      requiresConfirmation: true,
    };
  }

  return null;
}

/**
 * Rule: External service detected but no disclosure.
 * Severity: warning requiring review
 */
export function auditExternalServiceDisclosure(
  readme: ParsedReadme,
  phpHeaders?: ParsedPhpHeaders | null
): Recommendation | null {
  const allText = `${readme.source}\n${phpHeaders?.source ?? ''}`;
  const detectedServices: string[] = [];
  const evidence: Evidence[] = [];

  for (const { name, pattern } of EXTERNAL_SERVICE_PATTERNS) {
    const match = pattern.exec(allText);
    if (match) {
      detectedServices.push(name);
      const snippetStart = Math.max(0, match.index - 30);
      const snippetEnd = Math.min(allText.length, match.index + match[0].length + 30);
      evidence.push({
        field: 'External Service',
        matchedText: match[0],
        snippet: '...' + allText.slice(snippetStart, snippetEnd).trim() + '...',
        detail: `Detected service keyword "${name}".`,
      });
    }
  }

  if (detectedServices.length === 0) {
    return null;
  }

  // Check if readme includes a privacy/terms/disclosure section or content
  const hasDisclosureSection = readme.sections.some((s) =>
    /privacy|third-party|external service|data disclosure|terms of service|terms of use/i.test(s.title)
  );

  const hasDisclosureContent =
    /\b(?:privacy\s+policy|terms\s+of\s+service|third-party\s+services?|data\s+is\s+sent\s+to)\b/i.test(
      readme.source
    );

  if (hasDisclosureSection || hasDisclosureContent) {
    return null;
  }

  return {
    id: 'rule-external-service-no-disclosure',
    category: 'privacy',
    severity: 'warning',
    impact: 'high',
    confidence: 'medium',
    title: 'External service integration detected without disclosure',
    reason: `External services were detected (${detectedServices.join(
      ', '
    )}), but no third-party service or privacy disclosure section was found. WordPress.org guidelines require disclosing external connections, data transmission, terms of service, and privacy policies.`,
    evidence,
    requiresConfirmation: true,
  };
}

/**
 * Rule: Missing installation instructions when configuration language is detected.
 * Severity: suggestion
 */
export function auditInstallationInstructions(readme: ParsedReadme): Recommendation | null {
  const installSection = readme.sections.find((s) => s.title.toLowerCase().trim() === 'installation');
  const hasSubstantialInstall = installSection && installSection.body.trim().length >= 30;

  if (hasSubstantialInstall) {
    return null;
  }

  const detectedKeywords: string[] = [];
  const evidence: Evidence[] = [];

  for (const { keyword, pattern } of CONFIG_LANGUAGE_PATTERNS) {
    const match = pattern.exec(readme.source);
    if (match) {
      detectedKeywords.push(keyword);
      const snippetStart = Math.max(0, match.index - 30);
      const snippetEnd = Math.min(readme.source.length, match.index + match[0].length + 30);
      evidence.push({
        field: 'Content',
        matchedText: match[0],
        snippet: '...' + readme.source.slice(snippetStart, snippetEnd).trim() + '...',
        detail: `Configuration keyword "${keyword}" found.`,
      });
    }
  }

  if (detectedKeywords.length === 0) {
    return null;
  }

  return {
    id: 'rule-missing-installation-instructions',
    category: 'content',
    severity: 'suggestion',
    impact: 'medium',
    confidence: 'medium',
    title: 'Missing installation and setup instructions',
    reason: `Configuration requirements (${detectedKeywords.join(
      ', '
    )}) are mentioned in the readme, but a step-by-step '== Installation ==' section is missing or incomplete.`,
    evidence,
    requiresConfirmation: true,
  };
}

/**
 * Rule: Competitor tag recommendations with strict gating:
 * 1. At least two competitors use the tag, OR user explicitly requested it.
 * 2. The subject description/readme provides matching evidence.
 * 3. Total tag count after adding remains at or below 5.
 */
export function auditCompetitorTags(
  readme: ParsedReadme,
  competitorPlugins: readonly NormalizedPlugin[] = [],
  requestedTags: readonly string[] = []
): Recommendation[] {
  const tagsField = readme.headers['Tags'] ?? readme.headers['tags'];
  const currentTags = tagsField?.values ?? [];
  const currentSlugs = new Set(currentTags.map((t) => normalizeTagSlug(t)).filter(Boolean));

  if (currentSlugs.size >= 5) {
    // Cannot recommend tags if already at the 5-tag maximum
    return [];
  }

  const remainingSlots = 5 - currentSlugs.size;
  const recommendations: Recommendation[] = [];

  // Count competitor tag usage
  const compTagCounts = new Map<string, { label: string; usedBy: string[] }>();
  for (const comp of competitorPlugins) {
    const compSlug = comp.slug || comp.name;
    for (const rawTag of comp.tags) {
      const slug = normalizeTagSlug(rawTag);
      if (!slug || currentSlugs.has(slug)) continue;

      const existing = compTagCounts.get(slug);
      if (existing) {
        if (!existing.usedBy.includes(compSlug)) {
          existing.usedBy.push(compSlug);
        }
      } else {
        compTagCounts.set(slug, { label: rawTag.trim(), usedBy: [compSlug] });
      }
    }
  }

  const candidateSlugs = new Set<string>();
  const requestedSet = new Set(requestedTags.map((t) => normalizeTagSlug(t)).filter(Boolean));

  // Add competitor tags used by >= 2 competitors
  for (const [slug, data] of compTagCounts.entries()) {
    if (data.usedBy.length >= 2 || requestedSet.has(slug)) {
      candidateSlugs.add(slug);
    }
  }

  // Also add any explicitly requested tags
  for (const req of requestedSet) {
    if (!currentSlugs.has(req)) {
      candidateSlugs.add(req);
      if (!compTagCounts.has(req)) {
        compTagCounts.set(req, { label: req, usedBy: ['(requested)'] });
      }
    }
  }

  for (const slug of Array.from(candidateSlugs).sort()) {
    if (recommendations.length >= remainingSlots) {
      break;
    }

    const data = compTagCounts.get(slug)!;
    const tagWord = slug.replace(/-/g, ' ');

    // Check if subject description/readme provides matching evidence
    const wordPattern = new RegExp(`\\b${escapeRegExp(tagWord)}\\b|\\b${escapeRegExp(slug)}\\b`, 'i');
    const match = wordPattern.exec(readme.source);

    if (!match && !requestedSet.has(slug)) {
      // Missing subject evidence; skip unless explicitly requested
      continue;
    }

    const evidence: Evidence[] = [];
    if (match) {
      const snippetStart = Math.max(0, match.index - 25);
      const snippetEnd = Math.min(readme.source.length, match.index + match[0].length + 25);
      evidence.push({
        field: 'Readme Content',
        matchedText: match[0],
        snippet: '...' + readme.source.slice(snippetStart, snippetEnd).trim() + '...',
        detail: `Subject readme text contains evidence matching tag "${data.label}".`,
      });
    }

    evidence.push({
      field: 'Competitor Intelligence',
      detail: `Used by competitors: ${data.usedBy.join(', ')}`,
      slug: data.usedBy.join(','),
    });

    let proposedEdit = undefined;
    if (tagsField?.rawValueRange) {
      const newTagString = currentTags.length > 0
        ? `${tagsField.value.trim()}, ${data.label}`
        : data.label;
      proposedEdit = {
        start: tagsField.rawValueRange.start,
        end: tagsField.rawValueRange.end,
        newText: newTagString,
      };
    }

    recommendations.push({
      id: `rule-competitor-tag-${slug}`,
      category: 'positioning',
      severity: 'suggestion',
      impact: 'medium',
      confidence: 'high',
      title: `Add tag "${data.label}"`,
      reason: `Tag "${data.label}" is used by competitors (${data.usedBy.join(
        ', '
      )}) and is supported by content in your plugin readme.`,
      evidence,
      proposedEdit,
      requiresConfirmation: true,
    });
  }

  return recommendations;
}

/**
 * Future rule: Missing FAQ despite repeated support topics.
 * Documented as non-MVP without forum-topic data.
 */
export const RULE_MISSING_FAQ_METADATA = {
  id: 'rule-missing-faq-support-topics',
  title: 'Add FAQ section based on repeated support topics',
  status: 'future_non_mvp',
  reason: 'Requires historical forum-topic aggregation data to identify repeated support questions.',
};

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
