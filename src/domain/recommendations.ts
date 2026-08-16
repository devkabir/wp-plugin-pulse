/**
 * Core models and helper functions for deterministic audit recommendations.
 */

export type RecommendationCategory =
  | 'syntax'
  | 'metadata'
  | 'compatibility'
  | 'content'
  | 'positioning'
  | 'privacy';

export type RecommendationSeverity = 'error' | 'warning' | 'suggestion';

export type RecommendationImpact = 'high' | 'medium' | 'low';

export type RecommendationConfidence = 'high' | 'medium' | 'low';

export interface Evidence {
  field?: string;
  matchedText?: string;
  snippet?: string;
  source?: string;
  detail?: string;
  slug?: string;
  line?: number;
}

export interface TextEdit {
  start: number; // 0-indexed character offset in source
  end: number;   // 0-indexed character offset in source
  newText: string;
}

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  severity: RecommendationSeverity;
  impact: RecommendationImpact;
  confidence: RecommendationConfidence;
  title: string;
  reason: string;
  evidence: Evidence[];
  proposedEdit?: TextEdit;
  requiresConfirmation: boolean;
}

export interface WordPressReleaseInfo {
  currentStable: string;
  currentRc?: string | null;
  minimumSupported?: string;
  checkedAt?: string;
  isStale?: boolean;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  error: 3,
  warning: 2,
  suggestion: 1,
};

const IMPACT_WEIGHT: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const CONFIDENCE_WEIGHT: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Deterministically sorts recommendations by:
 * 1. Severity desc (error > warning > suggestion)
 * 2. Impact desc (high > medium > low)
 * 3. Confidence desc (high > medium > low)
 * 4. Stable ID asc (alphabetical)
 */
export function sortRecommendations(
  recommendations: readonly Recommendation[]
): Recommendation[] {
  if (!Array.isArray(recommendations)) return [];

  const copy = [...recommendations];
  copy.sort((a, b) => {
    const sevDiff = (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0);
    if (sevDiff !== 0) return sevDiff;

    const impDiff = (IMPACT_WEIGHT[b.impact] ?? 0) - (IMPACT_WEIGHT[a.impact] ?? 0);
    if (impDiff !== 0) return impDiff;

    const confDiff = (CONFIDENCE_WEIGHT[b.confidence] ?? 0) - (CONFIDENCE_WEIGHT[a.confidence] ?? 0);
    if (confDiff !== 0) return confDiff;

    return a.id.localeCompare(b.id);
  });

  return copy;
}

/**
 * Validates that a recommendation satisfies domain acceptance criteria:
 * - Has at least one evidence item
 * - Has non-empty title and reason
 * - If category is compatibility, requiresConfirmation is strictly true and has no automatic edit
 */
export function validateRecommendation(rec: Recommendation): boolean {
  if (!rec || typeof rec !== 'object') return false;
  if (!rec.id || typeof rec.id !== 'string') return false;
  if (!rec.title || typeof rec.title !== 'string') return false;
  if (!rec.reason || typeof rec.reason !== 'string') return false;
  if (!Array.isArray(rec.evidence) || rec.evidence.length === 0) return false;

  if (rec.category === 'compatibility') {
    if (rec.requiresConfirmation !== true) return false;
    if (rec.proposedEdit !== undefined) return false;
  }

  return true;
}
