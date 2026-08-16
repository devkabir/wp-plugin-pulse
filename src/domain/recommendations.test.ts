import { describe, expect, it } from 'bun:test';
import {
  type Recommendation,
  sortRecommendations,
  validateRecommendation,
} from './recommendations';

describe('PR 8 — Recommendations Domain Model & Sorting', () => {
  it('stably sorts recommendations by severity, impact, confidence, and ID', () => {
    const recs: Recommendation[] = [
      {
        id: 'rec-c-warning-med',
        category: 'metadata',
        severity: 'warning',
        impact: 'medium',
        confidence: 'high',
        title: 'Rec C',
        reason: 'Reason C',
        evidence: [{ field: 'Tags', matchedText: 'foo' }],
        requiresConfirmation: false,
      },
      {
        id: 'rec-a-error-high',
        category: 'syntax',
        severity: 'error',
        impact: 'high',
        confidence: 'high',
        title: 'Rec A',
        reason: 'Reason A',
        evidence: [{ field: 'Title', matchedText: 'bar' }],
        requiresConfirmation: false,
      },
      {
        id: 'rec-d-suggestion-low',
        category: 'content',
        severity: 'suggestion',
        impact: 'low',
        confidence: 'medium',
        title: 'Rec D',
        reason: 'Reason D',
        evidence: [{ field: 'Content', matchedText: 'baz' }],
        requiresConfirmation: true,
      },
      {
        id: 'rec-b-error-high-2',
        category: 'metadata',
        severity: 'error',
        impact: 'high',
        confidence: 'high',
        title: 'Rec B',
        reason: 'Reason B',
        evidence: [{ field: 'Tags', matchedText: 'qux' }],
        requiresConfirmation: false,
      },
      {
        id: 'rec-e-warning-high',
        category: 'compatibility',
        severity: 'warning',
        impact: 'high',
        confidence: 'high',
        title: 'Rec E',
        reason: 'Reason E',
        evidence: [{ field: 'Tested up to', matchedText: '6.0' }],
        requiresConfirmation: true,
      },
    ];

    const sorted = sortRecommendations(recs);

    // Expected order:
    // 1. rec-a-error-high (error, impact high, conf high, id rec-a-...)
    // 2. rec-b-error-high-2 (error, impact high, conf high, id rec-b-...)
    // 3. rec-e-warning-high (warning, impact high, conf high)
    // 4. rec-c-warning-med (warning, impact med, conf high)
    // 5. rec-d-suggestion-low (suggestion, impact low, conf med)
    expect(sorted.map((r) => r.id)).toEqual([
      'rec-a-error-high',
      'rec-b-error-high-2',
      'rec-e-warning-high',
      'rec-c-warning-med',
      'rec-d-suggestion-low',
    ]);
  });

  it('handles empty and malformed array gracefully in sortRecommendations', () => {
    expect(sortRecommendations([])).toEqual([]);
    // @ts-expect-error test invalid input
    expect(sortRecommendations(null)).toEqual([]);
  });

  it('validates that every recommendation must include evidence', () => {
    const validRec: Recommendation = {
      id: 'rec-valid',
      category: 'metadata',
      severity: 'warning',
      impact: 'medium',
      confidence: 'high',
      title: 'Valid Rec',
      reason: 'A good reason with proof.',
      evidence: [{ field: 'Tags', matchedText: 'form' }],
      requiresConfirmation: false,
    };

    expect(validateRecommendation(validRec)).toBe(true);

    const invalidRecNoEvidence: Recommendation = {
      ...validRec,
      evidence: [],
    };
    expect(validateRecommendation(invalidRecNoEvidence)).toBe(false);

    const invalidRecEmptyReason: Recommendation = {
      ...validRec,
      reason: '',
    };
    expect(validateRecommendation(invalidRecEmptyReason)).toBe(false);
  });

  it('enforces that compatibility recommendations require confirmation and cannot have automatic edits', () => {
    const validCompatRec: Recommendation = {
      id: 'rec-compat',
      category: 'compatibility',
      severity: 'warning',
      impact: 'high',
      confidence: 'high',
      title: 'Check Tested up to',
      reason: 'Tested up to version needs verification.',
      evidence: [{ field: 'Tested up to', matchedText: '6.7' }],
      requiresConfirmation: true,
      proposedEdit: undefined,
    };

    expect(validateRecommendation(validCompatRec)).toBe(true);

    const invalidCompatNoConfirm: Recommendation = {
      ...validCompatRec,
      requiresConfirmation: false,
    };
    expect(validateRecommendation(invalidCompatNoConfirm)).toBe(false);

    const invalidCompatAutoEdit: Recommendation = {
      ...validCompatRec,
      proposedEdit: { start: 10, end: 15, newText: '6.8' },
    };
    expect(validateRecommendation(invalidCompatAutoEdit)).toBe(false);
  });
});
