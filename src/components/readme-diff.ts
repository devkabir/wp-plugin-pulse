import {
  type DiffLine,
  computeLineDiff,
  summarizeDiff,
} from '../domain/text-edits';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface ReadmeDiffOptions {
  filename?: string;
  onCopy?: () => void;
  onDownload?: () => void;
}

/**
 * Component that renders an accessible, syntax-styled diff view
 * comparing original readme.txt against patched output.
 */
export function renderReadmeDiff(
  originalSource: string,
  modifiedSource: string,
  options?: ReadmeDiffOptions
): HTMLElement {
  const container = el('div', 'readme-diff-view');
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Readme diff and draft preview');

  const diffLines = computeLineDiff(originalSource, modifiedSource);
  const summary = summarizeDiff(diffLines);
  const isIdentical = originalSource === modifiedSource;

  // Header & Controls
  const header = el('div', 'readme-diff-view__header');

  const titleWrap = el('div', 'readme-diff-view__title-wrap');
  const title = el('h4', 'readme-diff-view__title', `Patch Preview: ${options?.filename || 'readme.txt'}`);
  titleWrap.append(title);

  const stats = el('div', 'readme-diff-view__stats');
  if (isIdentical) {
    const badge = el('span', 'diff-stat-badge diff-stat-badge--neutral', 'No changes (identical to original)');
    stats.append(badge);
  } else {
    const addBadge = el('span', 'diff-stat-badge diff-stat-badge--add', `+${summary.additions} line${summary.additions === 1 ? '' : 's'}`);
    const remBadge = el('span', 'diff-stat-badge diff-stat-badge--remove', `-${summary.deletions} line${summary.deletions === 1 ? '' : 's'}`);
    stats.append(addBadge, remBadge);
  }
  titleWrap.append(stats);

  // View toggle: Diff view vs Full draft text view
  const viewControls = el('div', 'readme-diff-view__controls');
  const btnUnified = el('button', 'btn-diff-mode btn-diff-mode--active', 'Diff View');
  btnUnified.type = 'button';
  btnUnified.setAttribute('aria-pressed', 'true');

  const btnFullText = el('button', 'btn-diff-mode', 'Full Draft View');
  btnFullText.type = 'button';
  btnFullText.setAttribute('aria-pressed', 'false');

  viewControls.append(btnUnified, btnFullText);
  header.append(titleWrap, viewControls);
  container.append(header);

  // Body container
  const body = el('div', 'readme-diff-view__body');

  // 1. Unified Diff Render
  const diffPre = el('pre', 'diff-container');
  diffPre.setAttribute('tabindex', '0');
  diffPre.setAttribute('aria-label', 'Unified diff line comparison');

  const table = el('table', 'diff-table');
  const tbody = el('tbody');

  diffLines.forEach((line: DiffLine) => {
    const row = el('tr', `diff-row diff-row--${line.type}`);

    // Old line number column
    const oldNumTd = el('td', 'diff-col-num diff-col-num--old', line.oldLineNumber ? String(line.oldLineNumber) : '');
    // New line number column
    const newNumTd = el('td', 'diff-col-num diff-col-num--new', line.newLineNumber ? String(line.newLineNumber) : '');

    // Marker prefix
    const markerTd = el(
      'td',
      'diff-col-marker',
      line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
    );

    // Text content column
    const textTd = el('td', 'diff-col-text', line.text || ' ');

    row.append(oldNumTd, newNumTd, markerTd, textTd);
    tbody.append(row);
  });

  table.append(tbody);
  diffPre.append(table);

  // 2. Full Draft Text Render
  const fullTextPre = el('pre', 'full-text-container');
  fullTextPre.hidden = true;
  fullTextPre.setAttribute('tabindex', '0');
  fullTextPre.setAttribute('aria-label', 'Full modified readme content');
  const codeEl = el('code', undefined, modifiedSource);
  fullTextPre.append(codeEl);

  body.append(diffPre, fullTextPre);
  container.append(body);

  // Toggle behavior
  btnUnified.addEventListener('click', () => {
    btnUnified.classList.add('btn-diff-mode--active');
    btnUnified.setAttribute('aria-pressed', 'true');
    btnFullText.classList.remove('btn-diff-mode--active');
    btnFullText.setAttribute('aria-pressed', 'false');
    diffPre.hidden = false;
    fullTextPre.hidden = true;
  });

  btnFullText.addEventListener('click', () => {
    btnFullText.classList.add('btn-diff-mode--active');
    btnFullText.setAttribute('aria-pressed', 'true');
    btnUnified.classList.remove('btn-diff-mode--active');
    btnUnified.setAttribute('aria-pressed', 'false');
    diffPre.hidden = true;
    fullTextPre.hidden = false;
  });

  return container;
}
