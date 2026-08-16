import { parsePhpHeader } from './php-header-parser';
import type { NormalizedPlugin, PluginComparison } from './plugin-types';
import { parseReadme } from './readme-parser';
import {
  auditCompetitorTags,
  auditDuplicateTags,
  auditExternalServiceDisclosure,
  auditInstallationInstructions,
  auditPluginTitle,
  auditRequiresAtLeastHeader,
  auditRequiresPhpHeader,
  auditShortDescriptionLength,
  auditStableTagVsPhpVersion,
  auditTagsCount,
  auditTestedUpToCurrentness,
  auditTestedUpToFormat,
} from './readme-rules';
import type { ParsedPhpHeaders, ParsedReadme, ParseDiagnostic } from './readme-types';
import {
  type Recommendation,
  type WordPressReleaseInfo,
  sortRecommendations,
  validateRecommendation,
} from './recommendations';

export interface ReadmeAuditOptions {
  readme: ParsedReadme | string;
  phpHeaders?: ParsedPhpHeaders | string | null;
  comparison?: PluginComparison | null;
  competitorPlugins?: readonly NormalizedPlugin[];
  releaseInfo?: WordPressReleaseInfo | null;
  requestedTags?: readonly string[];
}

export interface ReadmeAuditSummary {
  errorCount: number;
  warningCount: number;
  suggestionCount: number;
  versionCheckStatus: 'checked' | 'not checked';
  totalCount: number;
}

export interface ReadmeAuditResult {
  recommendations: Recommendation[];
  diagnostics: ParseDiagnostic[];
  parsedReadme: ParsedReadme;
  parsedPhpHeaders: ParsedPhpHeaders | null;
  summary: ReadmeAuditSummary;
}

/**
 * Runs a deterministic, evidence-backed audit against parsed readme.txt and PHP header files.
 *
 * Requirements:
 * - Pure computation with zero network access and zero AI.
 * - Keeps parser diagnostics separate from strategic recommendations.
 * - Produces no recommendation without evidence.
 * - Never generates an automatic compatibility edit.
 * - Treats competitor-only features as product opportunities, not readme edits.
 * - Deterministic, stably-ranked recommendations.
 */
export function auditReadme(options: ReadmeAuditOptions): ReadmeAuditResult {
  if (!options || !options.readme) {
    throw new Error('A valid readme source or ParsedReadme object is required for audit.');
  }

  // 1. Resolve ParsedReadme
  const parsedReadme: ParsedReadme =
    typeof options.readme === 'string'
      ? parseReadme(options.readme)
      : options.readme;

  // 2. Resolve ParsedPhpHeaders
  let parsedPhpHeaders: ParsedPhpHeaders | null = null;
  if (options.phpHeaders) {
    parsedPhpHeaders =
      typeof options.phpHeaders === 'string'
        ? parsePhpHeader(options.phpHeaders)
        : options.phpHeaders;
  }

  // 3. Resolve Competitor plugins
  const competitorPlugins: readonly NormalizedPlugin[] =
    options.competitorPlugins ??
    (options.comparison ? options.comparison.competitors : []);

  // 4. Collect Parser Diagnostics (kept separate)
  const diagnostics: ParseDiagnostic[] = [
    ...parsedReadme.diagnostics,
    ...(parsedPhpHeaders ? parsedPhpHeaders.diagnostics : []),
  ];

  // 5. Run Strategic & Metadata Rules
  const rawRecommendations: Array<Recommendation | null> = [
    auditPluginTitle(parsedReadme, parsedPhpHeaders),
    auditTagsCount(parsedReadme),
    auditDuplicateTags(parsedReadme),
    auditShortDescriptionLength(parsedReadme),
    auditTestedUpToFormat(parsedReadme),
    auditTestedUpToCurrentness(parsedReadme, options.releaseInfo),
    auditStableTagVsPhpVersion(parsedReadme, parsedPhpHeaders),
    auditRequiresAtLeastHeader(parsedPhpHeaders),
    auditRequiresPhpHeader(parsedPhpHeaders),
    auditExternalServiceDisclosure(parsedReadme, parsedPhpHeaders),
    auditInstallationInstructions(parsedReadme),
  ];

  // Run competitor tags intelligence
  const competitorTagRecs = auditCompetitorTags(
    parsedReadme,
    competitorPlugins,
    options.requestedTags ?? []
  );
  rawRecommendations.push(...competitorTagRecs);

  // 6. Validate, Deduplicate, and Sort Recommendations
  const seenIds = new Set<string>();
  const validRecommendations: Recommendation[] = [];

  for (const rec of rawRecommendations) {
    if (!rec) continue;
    if (seenIds.has(rec.id)) continue;

    // Strict acceptance criteria verification
    if (validateRecommendation(rec)) {
      seenIds.add(rec.id);
      validRecommendations.push(rec);
    }
  }

  const sortedRecommendations = sortRecommendations(validRecommendations);

  // 7. Calculate Summary
  let errorCount = 0;
  let warningCount = 0;
  let suggestionCount = 0;

  for (const rec of sortedRecommendations) {
    if (rec.severity === 'error') errorCount++;
    else if (rec.severity === 'warning') warningCount++;
    else if (rec.severity === 'suggestion') suggestionCount++;
  }

  const versionCheckStatus: 'checked' | 'not checked' =
    options.releaseInfo && options.releaseInfo.currentStable
      ? 'checked'
      : 'not checked';

  const summary: ReadmeAuditSummary = {
    errorCount,
    warningCount,
    suggestionCount,
    versionCheckStatus,
    totalCount: sortedRecommendations.length,
  };

  return {
    recommendations: sortedRecommendations,
    diagnostics,
    parsedReadme,
    parsedPhpHeaders,
    summary,
  };
}
