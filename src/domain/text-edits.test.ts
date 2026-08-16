import { describe, expect, test } from 'bun:test';
import {
  type IdentifiedTextEdit,
  type TextEdit,
  applyTextEdits,
  computeLineDiff,
  doEditsOverlap,
  findEditConflicts,
  formatUnifiedDiff,
  sortEditsDescending,
  summarizeDiff,
  validateTextEdit,
} from './text-edits';

describe('PR 9 — Text Edits Domain Logic', () => {
  describe('validateTextEdit', () => {
    test('validates within source length bounds', () => {
      expect(validateTextEdit({ start: 0, end: 5, newText: 'hello' }, 10).valid).toBe(true);
      expect(validateTextEdit({ start: 5, end: 5, newText: 'insert' }, 10).valid).toBe(true);
      expect(validateTextEdit({ start: 10, end: 10, newText: 'end' }, 10).valid).toBe(true);
    });

    test('rejects negative or invalid offsets', () => {
      expect(validateTextEdit({ start: -1, end: 5, newText: '' }, 10).valid).toBe(false);
      expect(validateTextEdit({ start: 5, end: 3, newText: '' }, 10).valid).toBe(false);
      expect(validateTextEdit({ start: 1.5, end: 5, newText: '' }, 10).valid).toBe(false);
    });

    test('rejects offsets exceeding source length', () => {
      expect(validateTextEdit({ start: 0, end: 15, newText: '' }, 10).valid).toBe(false);
      expect(validateTextEdit({ start: 11, end: 11, newText: '' }, 10).valid).toBe(false);
    });
  });

  describe('doEditsOverlap and findEditConflicts', () => {
    test('identifies non-overlapping edits', () => {
      const a: TextEdit = { start: 0, end: 5, newText: 'A' };
      const b: TextEdit = { start: 5, end: 10, newText: 'B' };
      const c: TextEdit = { start: 12, end: 15, newText: 'C' };

      expect(doEditsOverlap(a, b)).toBe(false);
      expect(doEditsOverlap(b, c)).toBe(false);
      expect(doEditsOverlap(a, c)).toBe(false);

      expect(findEditConflicts([a, b, c])).toHaveLength(0);
    });

    test('detects partial overlap between ranges', () => {
      const a: IdentifiedTextEdit = { id: '1', start: 0, end: 6, newText: 'A' };
      const b: IdentifiedTextEdit = { id: '2', start: 4, end: 10, newText: 'B' };

      expect(doEditsOverlap(a, b)).toBe(true);
      const conflicts = findEditConflicts([a, b]);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].editA.id).toBe('1');
      expect(conflicts[0].editB.id).toBe('2');
    });

    test('detects nested overlap', () => {
      const outer: IdentifiedTextEdit = { id: 'outer', start: 2, end: 20, newText: 'X' };
      const inner: IdentifiedTextEdit = { id: 'inner', start: 5, end: 10, newText: 'Y' };

      expect(doEditsOverlap(outer, inner)).toBe(true);
      expect(findEditConflicts([outer, inner])).toHaveLength(1);
    });

    test('detects exact duplicate ranges', () => {
      const a: IdentifiedTextEdit = { id: 'a', start: 5, end: 10, newText: '1' };
      const b: IdentifiedTextEdit = { id: 'b', start: 5, end: 10, newText: '2' };

      expect(doEditsOverlap(a, b)).toBe(true);
      expect(findEditConflicts([a, b])).toHaveLength(1);
    });

    test('detects duplicate point insertions at identical offsets', () => {
      const ins1: IdentifiedTextEdit = { id: 'ins1', start: 4, end: 4, newText: 'A' };
      const ins2: IdentifiedTextEdit = { id: 'ins2', start: 4, end: 4, newText: 'B' };

      expect(doEditsOverlap(ins1, ins2)).toBe(true);
      expect(findEditConflicts([ins1, ins2])).toHaveLength(1);
    });

    test('detects point insertion inside an active range replacement', () => {
      const range: IdentifiedTextEdit = { id: 'range', start: 0, end: 10, newText: 'Replace' };
      const point: IdentifiedTextEdit = { id: 'point', start: 5, end: 5, newText: 'Insert' };

      expect(doEditsOverlap(range, point)).toBe(true);
      expect(findEditConflicts([range, point])).toHaveLength(1);
    });
  });

  describe('sortEditsDescending', () => {
    test('orders edits descending by start offset', () => {
      const edits: IdentifiedTextEdit[] = [
        { id: '1', start: 10, end: 15, newText: 'mid' },
        { id: '2', start: 0, end: 5, newText: 'first' },
        { id: '3', start: 25, end: 30, newText: 'last' },
      ];

      const sorted = sortEditsDescending(edits);
      expect(sorted.map((e) => e.id)).toEqual(['3', '1', '2']);
    });
  });

  describe('applyTextEdits', () => {
    test('returns original string when no edits are provided', () => {
      const source = '=== Plugin Name ===\nContributors: john';
      const result = applyTextEdits(source, []);
      expect(result.output).toBe(source);
      expect(result.appliedEdits).toHaveLength(0);
      expect(result.hasErrors).toBe(false);
    });

    test('applies single range edit correctly', () => {
      const source = '=== Old Title ===\nStable tag: 1.0.0';
      const edits: IdentifiedTextEdit[] = [
        { id: 'title', start: 4, end: 13, newText: 'New Title' },
      ];

      const result = applyTextEdits(source, edits);
      expect(result.output).toBe('=== New Title ===\nStable tag: 1.0.0');
      expect(result.hasErrors).toBe(false);
      expect(source).toBe('=== Old Title ===\nStable tag: 1.0.0'); // Source left untouched
    });

    test('applies multiple edits from highest offset to lowest without offset drift', () => {
      // Original offsets:
      // "0123456789012345678901234567890"
      // "=== Form Builder ===\nTags: seo, forms\nStable tag: 1.0.0"
      const source = '=== Form Builder ===\nTags: seo, forms\nStable tag: 1.0.0';

      const tagStart = source.indexOf('seo, forms');
      const tagEnd = tagStart + 'seo, forms'.length;

      const titleStart = source.indexOf('Form Builder');
      const titleEnd = titleStart + 'Form Builder'.length;

      const versionStart = source.indexOf('1.0.0');
      const versionEnd = versionStart + '1.0.0'.length;

      // Supply in mixed/arbitrary order
      const edits: IdentifiedTextEdit[] = [
        { id: 'tag', start: tagStart, end: tagEnd, newText: 'forms, form-builder, drag-drop' },
        { id: 'title', start: titleStart, end: titleEnd, newText: 'Awesome Forms' },
        { id: 'version', start: versionStart, end: versionEnd, newText: '2.0.0' },
      ];

      const result = applyTextEdits(source, edits);
      expect(result.output).toBe('=== Awesome Forms ===\nTags: forms, form-builder, drag-drop\nStable tag: 2.0.0');
      expect(result.appliedEdits.map((e) => e.id)).toEqual(['version', 'tag', 'title']);
      expect(result.hasErrors).toBe(false);
    });

    test('handles point insertion (start === end)', () => {
      const source = '=== Title ===\nContributors: user';
      const insertPoint = source.indexOf('Contributors:');
      const edits: IdentifiedTextEdit[] = [
        { id: 'header', start: insertPoint, end: insertPoint, newText: 'Donate link: https://example.com\n' },
      ];

      const result = applyTextEdits(source, edits);
      expect(result.output).toBe('=== Title ===\nDonate link: https://example.com\nContributors: user');
      expect(result.hasErrors).toBe(false);
    });

    test('preserves CRLF line endings when applying edits', () => {
      const source = '=== Title ===\r\nTags: old\r\nStable tag: 1.0\r\n';
      const tagStart = source.indexOf('old');
      const tagEnd = tagStart + 3;

      const edits: IdentifiedTextEdit[] = [
        { id: 'tag', start: tagStart, end: tagEnd, newText: 'new, tags' },
      ];

      const result = applyTextEdits(source, edits);
      expect(result.output).toBe('=== Title ===\r\nTags: new, tags\r\nStable tag: 1.0\r\n');
      expect(result.output).toContain('\r\n');
    });

    test('rejects conflicting/overlapping edits to prevent corrupt output', () => {
      const source = '=== My Plugin ===\nTags: tag1, tag2, tag3';
      const tagStart = source.indexOf('tag1, tag2, tag3');
      const tagEnd = tagStart + 'tag1, tag2, tag3'.length;

      const edits: IdentifiedTextEdit[] = [
        { id: 'editA', start: tagStart, end: tagEnd, newText: 'replaced-all' },
        { id: 'editB', start: tagStart + 6, end: tagStart + 10, newText: 'partial' },
      ];

      const result = applyTextEdits(source, edits);
      expect(result.hasErrors).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.rejectedEdits.length).toBeGreaterThanOrEqual(2);
      // Because both conflicted, neither corrupts the output
      expect(result.output).toBe(source);
    });
  });

  describe('computeLineDiff and formatUnifiedDiff', () => {
    test('computes identical diff for unchanged strings', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const diff = computeLineDiff(text, text);

      expect(diff).toHaveLength(3);
      expect(diff.every((d) => d.type === 'context')).toBe(true);

      const summary = summarizeDiff(diff);
      expect(summary.additions).toBe(0);
      expect(summary.deletions).toBe(0);
      expect(summary.unchanged).toBe(3);
    });

    test('identifies additions, deletions, and context lines', () => {
      const original = 'Header\nOld Tag\nFooter';
      const modified = 'Header\nNew Tag\nExtra Line\nFooter';

      const diff = computeLineDiff(original, modified);
      const summary = summarizeDiff(diff);

      expect(summary.deletions).toBe(1); // Old Tag
      expect(summary.additions).toBe(2); // New Tag, Extra Line
      expect(summary.unchanged).toBe(2); // Header, Footer
    });

    test('formats a standard unified diff string', () => {
      const original = '=== Old Plugin ===\nVersion: 1.0';
      const modified = '=== New Plugin ===\nVersion: 1.0';

      const formatted = formatUnifiedDiff(original, modified, 'readme.txt');
      expect(formatted).toContain('--- a/readme.txt');
      expect(formatted).toContain('+++ b/readme.txt');
      expect(formatted).toContain('-=== Old Plugin ===');
      expect(formatted).toContain('+=== New Plugin ===');
      expect(formatted).toContain(' Version: 1.0');
    });
  });
});
