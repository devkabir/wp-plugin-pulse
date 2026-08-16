import { comparePlugins } from '../domain/plugin-comparison';
import type { AppState, NormalizedPlugin, PluginComparison } from '../domain/plugin-types';
import {
  downloadComparisonMarkdown,
  renderComparisonWorkspace,
} from './plugin-compare';

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

export interface ComparisonSectionOptions {
  onClose?: () => void;
  onExport?: (comparison: PluginComparison) => void;
  onSetSubject?: (slug: string | null) => void;
  onRemoveCompetitor?: (slug: string) => void;
}

/**
 * Finds a plugin from state by its slug.
 */
function findPlugin(state: AppState, slug: string): NormalizedPlugin | undefined {
  return state.plugins.find((p) => p.slug === slug);
}

/**
 * Renders the Head-to-Head Comparison workspace section.
 * Renders as a normal page region so large tables remain accessible and scrollable.
 */
export function renderComparisonSection(
  state: AppState,
  options?: ComparisonSectionOptions
): HTMLElement {
  let section = document.getElementById('comparison-section');
  if (!section) {
    section = document.createElement('section');
    section.id = 'comparison-section';
    section.className = 'comparison-section';
    section.setAttribute('aria-label', 'Head-to-head plugin comparison workspace');

    // Insert above results or before pagination
    const main = document.querySelector('main');
    const tableWrapper = document.getElementById('table-view-wrapper');
    if (main && tableWrapper) {
      main.insertBefore(section, tableWrapper);
    } else if (main) {
      main.append(section);
    }
  }

  section.innerHTML = '';

  const { subjectSlug, competitorSlugs } = state.comparison;

  // Header Container
  const header = el('div', 'comparison-section__header');

  const titleWrap = el('div', 'comparison-section__title-wrap');
  const title = el('h2', 'comparison-section__title', 'Head-to-Head Comparison');
  title.id = 'comparison-heading';
  title.setAttribute('tabindex', '-1');

  const subtitle = el('p', 'comparison-section__subtitle');
  titleWrap.append(title, subtitle);

  const toolbar = el('div', 'comparison-section__toolbar');

  // Check if subject and competitors are available
  const subject = subjectSlug ? findPlugin(state, subjectSlug) : undefined;
  const competitors = competitorSlugs
    .map((slug) => findPlugin(state, slug))
    .filter((p): p is NormalizedPlugin => Boolean(p));

  const hasValidComparison = Boolean(subject && competitors.length >= 1);

  let currentComparison: PluginComparison | null = null;
  if (hasValidComparison && subject) {
    currentComparison = comparePlugins(subject, competitors);
  }

  // Export Markdown Action (Requirement 6: Add an “Export Markdown” action using a Blob download)
  if (currentComparison) {
    const exportBtn = el('button', 'btn-comparison-export', 'Export Markdown');
    exportBtn.type = 'button';
    exportBtn.id = 'btn-comparison-export';
    exportBtn.setAttribute('aria-label', 'Export comparison report as Markdown');
    exportBtn.title = 'Download structured Markdown report with source URLs and metric definitions';

    exportBtn.addEventListener('click', () => {
      if (options?.onExport && currentComparison) {
        options.onExport(currentComparison);
      } else if (currentComparison) {
        downloadComparisonMarkdown(currentComparison);
      }
    });

    toolbar.append(exportBtn);
  }

  // Close Workspace Action (Requirement 7: Restore focus to the Compare button when the workspace closes)
  const closeBtn = el('button', 'btn-comparison-close', '✕ Close');
  closeBtn.type = 'button';
  closeBtn.id = 'btn-comparison-close';
  closeBtn.setAttribute('aria-label', 'Close comparison workspace');
  closeBtn.title = 'Close comparison workspace (Esc)';

  const handleClose = (): void => {
    if (options?.onClose) {
      options.onClose();
    } else {
      section?.dispatchEvent(new CustomEvent('close-comparison', { bubbles: true }));
    }
  };

  closeBtn.addEventListener('click', handleClose);
  toolbar.append(closeBtn);

  header.append(titleWrap, toolbar);
  section.append(header);

  // Content rendering
  const content = el('div', 'comparison-section__content');

  if (!subjectSlug) {
    subtitle.textContent = 'No subject plugin selected.';
    const emptyNotice = el('div', 'comparison-section__empty');
    emptyNotice.append(
      el(
        'p',
        undefined,
        'Please select a subject plugin (“My Plugin”) and at least one competitor to compare.'
      )
    );
    content.append(emptyNotice);
  } else if (!subject) {
    subtitle.textContent = `Loading subject plugin "${subjectSlug}"…`;
    const loadingNotice = el('div', 'comparison-section__loading', 'Fetching subject plugin details…');
    content.append(loadingNotice);
  } else if (competitors.length === 0) {
    subtitle.textContent = `Comparing "${subject.name}" — waiting for competitors.`;
    const emptyNotice = el('div', 'comparison-section__empty');
    emptyNotice.append(
      el(
        'p',
        undefined,
        `Selected "${subject.name}" as My Plugin. Add 1 to 3 competitor plugins to view head-to-head metrics.`
      )
    );
    content.append(emptyNotice);
  } else if (currentComparison) {
    subtitle.textContent = `Comparing ${subject.name} against ${competitors.length} competitor${
      competitors.length > 1 ? 's' : ''
    }: ${competitors.map((c) => c.name).join(', ')}.`;

    const workspaceEl = renderComparisonWorkspace(currentComparison, {
      onSetSubject: options?.onSetSubject,
      onRemoveCompetitor: options?.onRemoveCompetitor,
    });
    content.append(workspaceEl);
  }

  section.append(content);

  return section;
}

/**
 * Closes the comparison section workspace and restores focus to the Compare button.
 */
export function closeComparisonSection(): void {
  const section = document.getElementById('comparison-section');
  if (section) {
    section.hidden = true;
  }

  // Restore focus to the compare button in tray (Requirement 7)
  const compareBtn = document.getElementById('btn-tray-compare');
  if (compareBtn && !compareBtn.hidden && !compareBtn.hasAttribute('disabled')) {
    compareBtn.focus();
  }
}
