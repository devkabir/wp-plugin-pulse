import type { ParseDiagnostic } from '../domain/readme-types';
import type { Recommendation, RecommendationSeverity } from '../domain/recommendations';

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

export interface ReadmeAuditResultsOptions {
  diagnostics: readonly ParseDiagnostic[];
  recommendations: readonly Recommendation[];
  selectedRecIds: Set<string>;
  onToggleSelection?: (recId: string, isSelected: boolean) => void;
  onSelectAllEdits?: () => void;
  onClearSelection?: () => void;
}

/**
 * Renders parser diagnostics (first) followed by recommendations
 * grouped into Errors, Warnings, and Suggestions.
 */
export function renderReadmeAuditResults(
  options: ReadmeAuditResultsOptions
): HTMLElement {
  const container = el('div', 'readme-audit-results');
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Readme audit diagnostics and recommendations');

  const { diagnostics, recommendations, selectedRecIds } = options;

  // 1. Parser Diagnostics (ALWAYS DISPLAYED BEFORE RECOMMENDATIONS)
  if (diagnostics.length > 0) {
    const diagSection = el('section', 'readme-diagnostics-section');
    diagSection.setAttribute('aria-label', 'Parser Diagnostics');

    const diagHeader = el('div', 'readme-diagnostics-section__header');
    const diagTitle = el('h4', 'readme-diagnostics-section__title', 'Parser Diagnostics & Syntax Errors');
    const diagBadge = el(
      'span',
      'audit-count-badge audit-count-badge--error',
      `${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`
    );
    diagHeader.append(diagTitle, diagBadge);
    diagSection.append(diagHeader);

    const diagList = el('div', 'readme-diagnostics-list');
    diagnostics.forEach((diag) => {
      const item = el('div', `diag-item diag-item--${diag.severity}`);
      item.setAttribute('role', 'alert');

      const itemHeader = el('div', 'diag-item__header');
      const badge = el('span', `severity-badge severity-badge--${diag.severity}`, diag.severity.toUpperCase());
      const code = el('code', 'diag-item__code', diag.code);
      itemHeader.append(badge, code);

      if (diag.line !== undefined) {
        const lineBadge = el('span', 'diag-item__line', `Line ${diag.line}`);
        itemHeader.append(lineBadge);
      }

      const msg = el('p', 'diag-item__message', diag.message);
      item.append(itemHeader, msg);
      diagList.append(item);
    });

    diagSection.append(diagList);
    container.append(diagSection);
  }

  // 2. Recommendations Header & Global Selection Controls
  const recSection = el('section', 'readme-recommendations-section');
  recSection.setAttribute('aria-label', 'Strategic Recommendations');

  const recHeader = el('div', 'readme-recommendations-section__header');
  const titleWrap = el('div', 'readme-recommendations-section__title-wrap');
  const title = el('h3', 'readme-recommendations-section__title', 'Optimization Recommendations');

  const totalCount = recommendations.length;
  const countBadge = el('span', 'audit-total-badge', `${totalCount} Recommendation${totalCount === 1 ? '' : 's'}`);
  titleWrap.append(title, countBadge);

  const actionControls = el('div', 'readme-recommendations-section__actions');

  const editableRecs = recommendations.filter((r) => Boolean(r.proposedEdit));
  if (editableRecs.length > 0) {
    const btnSelectAll = el('button', 'btn-rec-action', 'Select All Edits');
    btnSelectAll.type = 'button';
    btnSelectAll.setAttribute('aria-label', `Select all ${editableRecs.length} automatic edits`);
    btnSelectAll.addEventListener('click', () => {
      options.onSelectAllEdits?.();
    });

    const btnClear = el('button', 'btn-rec-action btn-rec-action--secondary', 'Clear Selection');
    btnClear.type = 'button';
    btnClear.setAttribute('aria-label', 'Clear all recommendation selections');
    btnClear.addEventListener('click', () => {
      options.onClearSelection?.();
    });

    actionControls.append(btnSelectAll, btnClear);
  }

  recHeader.append(titleWrap, actionControls);
  recSection.append(recHeader);

  if (recommendations.length === 0) {
    const emptyNotice = el('div', 'audit-empty-state');
    emptyNotice.append(el('p', undefined, '✓ No errors, warnings, or missing metadata found! Your readme passes all audit rules.'));
    recSection.append(emptyNotice);
    container.append(recSection);
    return container;
  }

  // Group recommendations by errors, warnings, and suggestions
  const groups: Array<{
    severity: RecommendationSeverity;
    title: string;
    items: Recommendation[];
  }> = [
    {
      severity: 'error',
      title: 'Errors & Critical Fixes',
      items: recommendations.filter((r) => r.severity === 'error'),
    },
    {
      severity: 'warning',
      title: 'Warnings & Review Items',
      items: recommendations.filter((r) => r.severity === 'warning'),
    },
    {
      severity: 'suggestion',
      title: 'Growth & Optimization Suggestions',
      items: recommendations.filter((r) => r.severity === 'suggestion'),
    },
  ];

  groups.forEach((group) => {
    if (group.items.length === 0) return;

    const groupWrap = el('div', `recommendation-group recommendation-group--${group.severity}`);
    const groupHeader = el('div', 'recommendation-group__header');
    const groupTitle = el('h4', 'recommendation-group__title', group.title);
    const groupCount = el(
      'span',
      `audit-count-badge audit-count-badge--${group.severity}`,
      `${group.items.length}`
    );
    groupHeader.append(groupTitle, groupCount);
    groupWrap.append(groupHeader);

    const itemsContainer = el('div', 'recommendation-cards-list');

    group.items.forEach((rec) => {
      const card = renderRecommendationCard(rec, selectedRecIds.has(rec.id), (isSelected) => {
        options.onToggleSelection?.(rec.id, isSelected);
      });
      itemsContainer.append(card);
    });

    groupWrap.append(itemsContainer);
    recSection.append(groupWrap);
  });

  container.append(recSection);
  return container;
}

/**
 * Renders an individual recommendation card.
 */
function renderRecommendationCard(
  rec: Recommendation,
  isSelected: boolean,
  onToggle: (selected: boolean) => void
): HTMLElement {
  const card = el('div', `rec-card rec-card--${rec.severity}`);
  card.id = `rec-${rec.id}`;

  const topRow = el('div', 'rec-card__top');

  // Checkbox or Status marker
  const selectWrap = el('div', 'rec-card__select');
  if (rec.proposedEdit) {
    const inputId = `rec-check-${rec.id}`;
    const checkbox = el('input', 'rec-checkbox') as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.id = inputId;
    checkbox.checked = isSelected;
    checkbox.setAttribute('aria-label', `Apply edit: ${rec.title}`);

    checkbox.addEventListener('change', () => {
      onToggle(checkbox.checked);
    });

    const label = el('label', 'rec-checkbox-label', 'Apply edit');
    label.setAttribute('for', inputId);

    selectWrap.append(checkbox, label);
  } else if (rec.requiresConfirmation) {
    const manualBadge = el('span', 'rec-manual-badge', 'Manual review required');
    selectWrap.append(manualBadge);
  } else {
    const infoBadge = el('span', 'rec-manual-badge rec-manual-badge--suggestion', 'Actionable suggestion');
    selectWrap.append(infoBadge);
  }

  // Badges (Category, Impact, Confidence)
  const badgesWrap = el('div', 'rec-card__badges');
  const catBadge = el('span', 'rec-badge rec-badge--category', rec.category);
  const impBadge = el('span', `rec-badge rec-badge--impact-${rec.impact}`, `${rec.impact} impact`);
  const confBadge = el('span', `rec-badge rec-badge--conf-${rec.confidence}`, `${rec.confidence} confidence`);

  badgesWrap.append(catBadge, impBadge, confBadge);
  topRow.append(selectWrap, badgesWrap);
  card.append(topRow);

  // Content
  const title = el('h5', 'rec-card__title', rec.title);
  const reason = el('p', 'rec-card__reason', rec.reason);
  card.append(title, reason);

  // Evidence list
  if (rec.evidence && rec.evidence.length > 0) {
    const evidenceBlock = el('div', 'rec-card__evidence');
    const evidenceTitle = el('span', 'rec-card__evidence-title', 'Evidence:');
    const evidenceList = el('ul', 'rec-card__evidence-list');

    rec.evidence.forEach((ev) => {
      const li = el('li', 'rec-card__evidence-item');
      if (ev.detail) {
        li.textContent = ev.detail;
      } else if (ev.snippet) {
        li.textContent = `"${ev.snippet}" in ${ev.source || ev.field || 'content'}`;
      } else if (ev.matchedText) {
        li.textContent = `Matched text: "${ev.matchedText}" (${ev.field || 'source'})`;
      } else if (ev.slug) {
        li.textContent = `Competitor citation: ${ev.slug}`;
      }
      if (ev.line) {
        const lineSpan = el('span', 'rec-card__evidence-line', ` (Line ${ev.line})`);
        li.append(lineSpan);
      }
      evidenceList.append(li);
    });

    evidenceBlock.append(evidenceTitle, evidenceList);
    card.append(evidenceBlock);
  }

  // Proposed Edit Preview
  if (rec.proposedEdit) {
    const editPreview = el('div', 'rec-card__proposed-edit');
    const editTitle = el('span', 'rec-card__proposed-title', 'Proposed Patch:');
    const codePre = el('pre', 'rec-card__proposed-code');
    codePre.textContent = rec.proposedEdit.newText;
    editPreview.append(editTitle, codePre);
    card.append(editPreview);
  }

  return card;
}
