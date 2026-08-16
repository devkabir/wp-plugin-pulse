/**
 * Domain module for validating, sorting, conflict detection,
 * applying non-overlapping text edits, and generating before/after diffs.
 */

export interface TextEdit {
  start: number; // 0-indexed character offset in source
  end: number;   // 0-indexed character offset in source
  newText: string;
}

export interface IdentifiedTextEdit extends TextEdit {
  id?: string;
  label?: string;
}

export interface EditConflict {
  editA: IdentifiedTextEdit;
  editB: IdentifiedTextEdit;
  reason: string;
}

export interface ApplyEditsResult {
  output: string;
  appliedEdits: IdentifiedTextEdit[];
  rejectedEdits: Array<{ edit: IdentifiedTextEdit; reason: string }>;
  conflicts: EditConflict[];
  hasErrors: boolean;
}

export type DiffChangeType = 'add' | 'remove' | 'context';

export interface DiffLine {
  type: DiffChangeType;
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  unchanged: number;
}

/**
 * Validates a single text edit against source length bounds.
 */
export function validateTextEdit(edit: TextEdit, sourceLength: number): { valid: boolean; error?: string } {
  if (!edit || typeof edit !== 'object') {
    return { valid: false, error: 'Edit must be an object.' };
  }
  if (typeof edit.start !== 'number' || !Number.isInteger(edit.start) || edit.start < 0) {
    return { valid: false, error: `Invalid start offset: ${edit.start}` };
  }
  if (typeof edit.end !== 'number' || !Number.isInteger(edit.end) || edit.end < edit.start) {
    return { valid: false, error: `Invalid end offset: ${edit.end} (start: ${edit.start})` };
  }
  if (edit.start > sourceLength || edit.end > sourceLength) {
    return {
      valid: false,
      error: `Edit range [${edit.start}, ${edit.end}] exceeds source length ${sourceLength}`,
    };
  }
  if (typeof edit.newText !== 'string') {
    return { valid: false, error: 'Edit newText must be a string.' };
  }
  return { valid: true };
}

/**
 * Checks if two text edits overlap or conflict.
 *
 * Conflict rules:
 * - Two range replacements [start, end] overlap if Math.max(a.start, b.start) < Math.min(a.end, b.end).
 * - If one or both are zero-length insertions (start === end):
 *   - An insertion at offset X overlaps a range edit [start, end] if start < X < end.
 *   - Multiple insertions at the EXACT same insertion point (a.start === b.start === a.end === b.end) conflict
 *     because execution order would be ambiguous.
 *   - An insertion at a range boundary (e.g. insertion at 5 and range [5, 10] or [0, 5]) is flagged if overlapping
 *     range changes the character boundaries.
 */
export function doEditsOverlap(a: TextEdit, b: TextEdit): boolean {
  // Case 1: Both are point insertions at the same offset
  if (a.start === a.end && b.start === b.end) {
    return a.start === b.start;
  }

  // Case 2: One is point insertion, other is range replacement
  if (a.start === a.end) {
    // Insertion inside b's non-empty range
    return a.start > b.start && a.start < b.end;
  }
  if (b.start === b.end) {
    return b.start > a.start && b.start < a.end;
  }

  // Case 3: Both are range replacements
  // They overlap if the intersection interval has positive length
  const overlapStart = Math.max(a.start, b.start);
  const overlapEnd = Math.min(a.end, b.end);
  return overlapStart < overlapEnd;
}

/**
 * Finds all pairwise conflicts among a list of proposed edits.
 */
export function findEditConflicts(edits: readonly IdentifiedTextEdit[]): EditConflict[] {
  const conflicts: EditConflict[] = [];
  const n = edits.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const editA = edits[i];
      const editB = edits[j];
      if (doEditsOverlap(editA, editB)) {
        conflicts.push({
          editA,
          editB,
          reason: `Edit range [${editA.start}, ${editA.end}] overlaps with edit range [${editB.start}, ${editB.end}]`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Sorts edits descending by start offset (highest offset to lowest offset).
 * If start offsets are equal, sorts descending by end offset.
 */
export function sortEditsDescending(edits: readonly IdentifiedTextEdit[]): IdentifiedTextEdit[] {
  return [...edits].sort((a, b) => {
    if (b.start !== a.start) {
      return b.start - a.start;
    }
    return b.end - a.end;
  });
}

/**
 * Applies a list of text edits to a source string.
 *
 * Requirements:
 * 1. Validates all edit ranges against source length.
 * 2. Detects and rejects overlapping/conflicting edits.
 * 3. Applies edits from highest offset to lowest offset so offsets remain stable without drift.
 * 4. Leaves the original source string unmodified (pure function).
 */
export function applyTextEdits(
  source: string,
  edits: readonly IdentifiedTextEdit[]
): ApplyEditsResult {
  if (typeof source !== 'string') {
    throw new TypeError('Source must be a string.');
  }

  if (!edits || edits.length === 0) {
    return {
      output: source,
      appliedEdits: [],
      rejectedEdits: [],
      conflicts: [],
      hasErrors: false,
    };
  }

  const rejectedEdits: Array<{ edit: IdentifiedTextEdit; reason: string }> = [];
  const validEdits: IdentifiedTextEdit[] = [];

  // 1. Boundary & shape validation
  for (const edit of edits) {
    const val = validateTextEdit(edit, source.length);
    if (!val.valid) {
      rejectedEdits.push({ edit, reason: val.error || 'Invalid edit specification.' });
    } else {
      validEdits.push(edit);
    }
  }

  // 2. Conflict detection
  const conflicts = findEditConflicts(validEdits);
  if (conflicts.length > 0) {
    const conflictingSet = new Set<IdentifiedTextEdit>();
    for (const c of conflicts) {
      conflictingSet.add(c.editA);
      conflictingSet.add(c.editB);
    }

    for (const badEdit of conflictingSet) {
      rejectedEdits.push({
        edit: badEdit,
        reason: 'Overlapping / conflicting edit detected with another selected edit.',
      });
    }

    // Filter out conflicting edits so no corrupt output can ever be produced
    const nonConflicting = validEdits.filter((e) => !conflictingSet.has(e));
    const sorted = sortEditsDescending(nonConflicting);

    let output = source;
    for (const edit of sorted) {
      output = output.slice(0, edit.start) + edit.newText + output.slice(edit.end);
    }

    return {
      output,
      appliedEdits: sorted,
      rejectedEdits,
      conflicts,
      hasErrors: true,
    };
  }

  // 3. Apply edits in descending order (highest offset to lowest offset)
  const sorted = sortEditsDescending(validEdits);
  let output = source;

  for (const edit of sorted) {
    output = output.slice(0, edit.start) + edit.newText + output.slice(edit.end);
  }

  return {
    output,
    appliedEdits: sorted,
    rejectedEdits,
    conflicts: [],
    hasErrors: rejectedEdits.length > 0,
  };
}

/**
 * Computes a line-by-line diff between original text and modified text.
 * Uses a classic Longest Common Subsequence (LCS) algorithm on lines.
 */
export function computeLineDiff(original: string, modified: string): DiffLine[] {
  const oldLines = original.length > 0 ? original.split('\n') : [];
  const newLines = modified.length > 0 ? modified.split('\n') : [];

  const n = oldLines.length;
  const m = newLines.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) {
    return newLines.map((text, idx) => ({
      type: 'add',
      text,
      newLineNumber: idx + 1,
    }));
  }
  if (m === 0) {
    return oldLines.map((text, idx) => ({
      type: 'remove',
      text,
      oldLineNumber: idx + 1,
    }));
  }

  // LCS DP matrix
  // matrix[i][j] stores length of LCS of oldLines[0..i-1] and newLines[0..j-1]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff lines
  let i = n;
  let j = m;
  const resultReversed: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      resultReversed.push({
        type: 'context',
        text: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      resultReversed.push({
        type: 'add',
        text: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      resultReversed.push({
        type: 'remove',
        text: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return resultReversed.reverse();
}

/**
 * Summarizes additions, deletions, and unchanged lines in a diff.
 */
export function summarizeDiff(diffLines: readonly DiffLine[]): DiffSummary {
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const line of diffLines) {
    if (line.type === 'add') additions++;
    else if (line.type === 'remove') deletions++;
    else unchanged++;
  }

  return { additions, deletions, unchanged };
}

/**
 * Formats a plain-text unified diff representation with header.
 */
export function formatUnifiedDiff(
  original: string,
  modified: string,
  filename = 'readme.txt'
): string {
  const diffLines = computeLineDiff(original, modified);
  if (diffLines.length === 0) {
    return '--- ' + filename + '\n+++ ' + filename + ' (no changes)';
  }

  const lines: string[] = [
    `--- a/${filename}`,
    `+++ b/${filename}`,
  ];

  for (const line of diffLines) {
    if (line.type === 'add') {
      lines.push(`+${line.text}`);
    } else if (line.type === 'remove') {
      lines.push(`-${line.text}`);
    } else {
      lines.push(` ${line.text}`);
    }
  }

  return lines.join('\n');
}
