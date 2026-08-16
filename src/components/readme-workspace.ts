import { auditReadme, type ReadmeAuditResult } from '../domain/readme-audit';
import type { AppState, NormalizedPlugin, PluginComparison } from '../domain/plugin-types';
import {
  type ApplyEditsResult,
  type IdentifiedTextEdit,
  applyTextEdits,
} from '../domain/text-edits';
import { renderReadmeAuditResults } from './readme-audit-results';
import { renderReadmeDiff } from './readme-diff';

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

export interface ReadmeWorkspaceOptions {
  onClose?: () => void;
  state?: AppState;
}

/**
 * In-memory state structure for the Readme Workspace.
 * Keeps file contents strictly in browser memory.
 */
export interface ReadmeWorkspaceState {
  readmeSource: string;
  phpSource: string;
  readmeFileName: string | null;
  phpFileName: string | null;
  auditResult: ReadmeAuditResult | null;
  selectedRecIds: Set<string>;
  draftSource: string;
  appliedEdits: IdentifiedTextEdit[];
  hasEditsConflict: boolean;
}

/**
 * Announces status changes to screen readers.
 */
function announceWorkspaceStatus(message: string): void {
  const liveEl = document.getElementById('readme-workspace-live') || document.getElementById('comparison-live');
  if (liveEl) {
    liveEl.textContent = message;
  }
}

/**
 * Downloads plain-text readme.txt as a safe file export.
 * Does not overwrite the user's uploaded file.
 */
export function downloadReadmeFile(content: string, filename = 'readme.txt'): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();

  setTimeout(() => {
    link.remove?.();
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Copies text to clipboard with fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API failed, attempting fallback', err);
  }

  // Fallback
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.append(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Fallback clipboard copy failed', err);
    return false;
  }
}

/**
 * Renders the full Readme Optimization & Audit Workspace component.
 */
export function renderReadmeWorkspace(
  container: HTMLElement,
  options?: ReadmeWorkspaceOptions
): {
  getState: () => ReadmeWorkspaceState;
  reset: () => void;
  runAudit: () => void;
} {
  // In-memory isolated state
  const state: ReadmeWorkspaceState = {
    readmeSource: '',
    phpSource: '',
    readmeFileName: null,
    phpFileName: null,
    auditResult: null,
    selectedRecIds: new Set<string>(),
    draftSource: '',
    appliedEdits: [],
    hasEditsConflict: false,
  };

  // Clear memory on page unload
  const unloadListener = (): void => {
    state.readmeSource = '';
    state.phpSource = '';
    state.draftSource = '';
    state.selectedRecIds.clear();
    state.auditResult = null;
  };
  window.addEventListener('beforeunload', unloadListener);

  function updateDraft(): void {
    if (!state.readmeSource) {
      state.draftSource = '';
      state.appliedEdits = [];
      state.hasEditsConflict = false;
      return;
    }

    if (!state.auditResult || state.selectedRecIds.size === 0) {
      state.draftSource = state.readmeSource;
      state.appliedEdits = [];
      state.hasEditsConflict = false;
      return;
    }

    // Collect proposed edits for selected recommendation IDs
    const editsToApply: IdentifiedTextEdit[] = [];
    for (const rec of state.auditResult.recommendations) {
      if (state.selectedRecIds.has(rec.id) && rec.proposedEdit) {
        editsToApply.push({
          ...rec.proposedEdit,
          id: rec.id,
          label: rec.title,
        });
      }
    }

    const editResult: ApplyEditsResult = applyTextEdits(state.readmeSource, editsToApply);
    state.draftSource = editResult.output;
    state.appliedEdits = editResult.appliedEdits;
    state.hasEditsConflict = editResult.hasErrors;
  }

  function render(): void {
    container.innerHTML = '';
    container.className = 'readme-workspace';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Readme Optimization Workspace');

    // 1. Header & Close
    const header = el('div', 'readme-workspace__header');
    const titleWrap = el('div', 'readme-workspace__title-wrap');
    const heading = el('h2', 'readme-workspace__title', 'Readme Optimization Workspace');
    heading.id = 'readme-workspace-heading';
    heading.setAttribute('tabindex', '-1');

    const subtitle = el(
      'p',
      'readme-workspace__subtitle',
      'Audit your WordPress plugin readme.txt and main PHP header, review evidence-backed recommendations, and export a validated draft.'
    );
    titleWrap.append(heading, subtitle);

    const closeBtn = el('button', 'btn-workspace-close', '✕ Close');
    closeBtn.type = 'button';
    closeBtn.id = 'btn-readme-workspace-close';
    closeBtn.setAttribute('aria-label', 'Close Readme Workspace');
    closeBtn.addEventListener('click', () => {
      options?.onClose?.();
      container.dispatchEvent(new CustomEvent('close-readme-workspace', { bubbles: true }));
    });

    header.append(titleWrap, closeBtn);
    container.append(header);

    // 2. Privacy & Local Processing Notice (Visible Callout)
    const privacyNotice = el('aside', 'readme-workspace__privacy-callout');
    privacyNotice.setAttribute('role', 'note');
    privacyNotice.setAttribute('aria-label', 'Privacy and Local Processing Notice');

    const lockIcon = el('span', 'privacy-icon', '🔒');
    lockIcon.setAttribute('aria-hidden', 'true');

    const privacyText = el(
      'div',
      'privacy-content',
      'Privacy notice: File parsing, deterministic audit, and patch generation are processed entirely within your browser memory. Uploaded files and pasted contents are never sent over the network, saved on servers, or stored in persistent storage.'
    );
    privacyNotice.append(lockIcon, privacyText);
    container.append(privacyNotice);

    // 3. Inputs Section (Paste / Upload .txt and .php)
    const inputsSection = el('section', 'readme-workspace__inputs');
    inputsSection.setAttribute('aria-label', 'Plugin Source Input Files');

    const grid = el('div', 'readme-inputs-grid');

    // Readme Input Card
    const readmeCard = el('div', 'readme-input-card');
    const readmeCardHeader = el('div', 'readme-input-card__header');
    const readmeTitle = el('h3', 'readme-input-card__title', '1. readme.txt Source');
    const readmeBadge = el(
      'span',
      state.readmeSource ? 'file-status-badge file-status-badge--ready' : 'file-status-badge',
      state.readmeFileName ? `${state.readmeFileName} (${state.readmeSource.length} chars)` : 'Required'
    );
    readmeCardHeader.append(readmeTitle, readmeBadge);
    readmeCard.append(readmeCardHeader);

    // Upload & Dropzone controls
    const readmeControls = el('div', 'readme-input-controls');
    const readmeFileInput = el('input', 'file-input sr-only') as HTMLInputElement;
    readmeFileInput.type = 'file';
    readmeFileInput.id = 'input-upload-readme';
    readmeFileInput.accept = '.txt,text/plain';

    const readmeUploadBtn = el('label', 'btn-file-upload', '📁 Upload readme.txt');
    readmeUploadBtn.setAttribute('for', 'input-upload-readme');

    readmeFileInput.addEventListener('change', () => {
      const file = readmeFileInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          state.readmeSource = String(reader.result || '');
          state.readmeFileName = file.name;
          state.auditResult = null;
          state.selectedRecIds.clear();
          updateDraft();
          announceWorkspaceStatus(`Loaded ${file.name} (${state.readmeSource.length} characters).`);
          render();
        };
        reader.readAsText(file);
      }
    });

    readmeControls.append(readmeFileInput, readmeUploadBtn);
    readmeCard.append(readmeControls);

    // Paste Textarea
    const readmeTextareaWrap = el('div', 'readme-textarea-wrap');
    const readmeLabel = el('label', 'sr-only', 'Paste readme.txt content here');
    readmeLabel.setAttribute('for', 'textarea-readme-paste');
    const readmeTextarea = el('textarea', 'readme-textarea') as HTMLTextAreaElement;
    readmeTextarea.id = 'textarea-readme-paste';
    readmeTextarea.placeholder = 'Paste readme.txt content here or upload file above…';
    readmeTextarea.value = state.readmeSource;
    readmeTextarea.spellcheck = false;

    readmeTextarea.addEventListener('input', () => {
      state.readmeSource = readmeTextarea.value;
      if (!state.readmeFileName || state.readmeFileName === 'pasted') {
        state.readmeFileName = 'pasted';
      }
      state.auditResult = null;
      state.selectedRecIds.clear();
      updateDraft();
    });

    readmeTextareaWrap.append(readmeLabel, readmeTextarea);
    readmeCard.append(readmeTextareaWrap);
    grid.append(readmeCard);

    // PHP Header Input Card (Optional)
    const phpCard = el('div', 'readme-input-card');
    const phpCardHeader = el('div', 'readme-input-card__header');
    const phpTitle = el('h3', 'readme-input-card__title', '2. Main Plugin .php (Optional)');
    const phpBadge = el(
      'span',
      state.phpSource ? 'file-status-badge file-status-badge--ready' : 'file-status-badge',
      state.phpFileName ? `${state.phpFileName} (${state.phpSource.length} chars)` : 'Optional'
    );
    phpCardHeader.append(phpTitle, phpBadge);
    phpCard.append(phpCardHeader);

    // Upload & Dropzone controls
    const phpControls = el('div', 'readme-input-controls');
    const phpFileInput = el('input', 'file-input sr-only') as HTMLInputElement;
    phpFileInput.type = 'file';
    phpFileInput.id = 'input-upload-php';
    phpFileInput.accept = '.php,text/plain,text/x-php';

    const phpUploadBtn = el('label', 'btn-file-upload', '📁 Upload plugin .php');
    phpUploadBtn.setAttribute('for', 'input-upload-php');

    phpFileInput.addEventListener('change', () => {
      const file = phpFileInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          state.phpSource = String(reader.result || '');
          state.phpFileName = file.name;
          state.auditResult = null;
          state.selectedRecIds.clear();
          updateDraft();
          announceWorkspaceStatus(`Loaded ${file.name} (${state.phpSource.length} characters).`);
          render();
        };
        reader.readAsText(file);
      }
    });

    phpControls.append(phpFileInput, phpUploadBtn);
    phpCard.append(phpControls);

    // Paste Textarea
    const phpTextareaWrap = el('div', 'readme-textarea-wrap');
    const phpLabel = el('label', 'sr-only', 'Paste main plugin PHP header content here');
    phpLabel.setAttribute('for', 'textarea-php-paste');
    const phpTextarea = el('textarea', 'readme-textarea') as HTMLTextAreaElement;
    phpTextarea.id = 'textarea-php-paste';
    phpTextarea.placeholder = 'Paste main plugin .php header block (e.g. /* Plugin Name: ... */)…';
    phpTextarea.value = state.phpSource;
    phpTextarea.spellcheck = false;

    phpTextarea.addEventListener('input', () => {
      state.phpSource = phpTextarea.value;
      if (!state.phpFileName || state.phpFileName === 'pasted') {
        state.phpFileName = 'pasted-php';
      }
      state.auditResult = null;
      state.selectedRecIds.clear();
      updateDraft();
    });

    phpTextareaWrap.append(phpLabel, phpTextarea);
    phpCard.append(phpTextareaWrap);
    grid.append(phpCard);

    inputsSection.append(grid);

    // Action buttons toolbar for Inputs
    const inputToolbar = el('div', 'readme-inputs-toolbar');
    const btnRunAudit = el('button', 'btn-workspace-primary', '🔍 Audit Readme');
    btnRunAudit.type = 'button';
    btnRunAudit.id = 'btn-run-readme-audit';
    btnRunAudit.disabled = !state.readmeSource.trim();
    btnRunAudit.setAttribute('aria-label', 'Run deterministic audit on uploaded readme');

    btnRunAudit.addEventListener('click', () => {
      executeAudit();
    });

    const btnReset = el('button', 'btn-workspace-secondary', 'Reset Workspace');
    btnReset.type = 'button';
    btnReset.id = 'btn-reset-readme-workspace';
    btnReset.setAttribute('aria-label', 'Reset workspace and clear in-memory source contents');
    btnReset.addEventListener('click', () => {
      resetWorkspace();
    });

    inputToolbar.append(btnRunAudit, btnReset);
    inputsSection.append(inputToolbar);
    container.append(inputsSection);

    // 4. Audit Results (Diagnostics & Recommendations)
    if (state.auditResult) {
      const resultsContainer = renderReadmeAuditResults({
        diagnostics: state.auditResult.diagnostics,
        recommendations: state.auditResult.recommendations,
        selectedRecIds: state.selectedRecIds,
        onToggleSelection: (recId, isSelected) => {
          if (isSelected) {
            state.selectedRecIds.add(recId);
          } else {
            state.selectedRecIds.delete(recId);
          }
          updateDraft();
          announceWorkspaceStatus(
            `${isSelected ? 'Selected' : 'Deselected'} recommendation ${recId}. ${state.selectedRecIds.size} edits selected.`
          );
          render();
        },
        onSelectAllEdits: () => {
          if (!state.auditResult) return;
          for (const rec of state.auditResult.recommendations) {
            if (rec.proposedEdit) {
              state.selectedRecIds.add(rec.id);
            }
          }
          updateDraft();
          announceWorkspaceStatus(`Selected all ${state.selectedRecIds.size} editable recommendations.`);
          render();
        },
        onClearSelection: () => {
          state.selectedRecIds.clear();
          updateDraft();
          announceWorkspaceStatus('Cleared recommendation selections.');
          render();
        },
      });

      container.append(resultsContainer);

      // 5. Diff & Export Section (Only when readme is present)
      const exportSection = el('section', 'readme-export-section');
      exportSection.setAttribute('aria-label', 'Diff preview and export actions');

      const exportHeader = el('div', 'readme-export-section__header');
      const exportTitleWrap = el('div', 'readme-export-section__title-wrap');
      const exportTitle = el('h3', 'readme-export-section__title', 'Draft Preview & Export');

      const editsCount = state.appliedEdits.length;
      const editsBadge = el(
        'span',
        editsCount > 0 ? 'audit-count-badge audit-count-badge--suggestion' : 'audit-count-badge',
        `${editsCount} edit${editsCount === 1 ? '' : 's'} applied`
      );
      exportTitleWrap.append(exportTitle, editsBadge);

      const exportActions = el('div', 'readme-export-section__actions');

      // Copy Button
      const btnCopy = el('button', 'btn-export-action', '📋 Copy readme.txt');
      btnCopy.type = 'button';
      btnCopy.id = 'btn-copy-draft-readme';
      btnCopy.setAttribute('aria-label', 'Copy modified readme text to clipboard');
      btnCopy.addEventListener('click', async () => {
        const success = await copyToClipboard(state.draftSource);
        if (success) {
          btnCopy.textContent = '✓ Copied!';
          announceWorkspaceStatus('Draft readme.txt copied to clipboard.');
          setTimeout(() => {
            btnCopy.textContent = '📋 Copy readme.txt';
          }, 2000);
        } else {
          announceWorkspaceStatus('Could not copy to clipboard.');
        }
      });

      // Download Button
      const btnDownload = el('button', 'btn-export-action btn-export-action--primary', '⬇ Download readme.txt');
      btnDownload.type = 'button';
      btnDownload.id = 'btn-download-draft-readme';
      btnDownload.setAttribute('aria-label', 'Download modified readme.txt');
      btnDownload.title = 'Download modified readme.txt to your device (original source remains unchanged)';
      btnDownload.addEventListener('click', () => {
        downloadReadmeFile(state.draftSource, 'readme.txt');
        announceWorkspaceStatus('Downloaded readme.txt with approved edits.');
      });

      exportActions.append(btnCopy, btnDownload);
      exportHeader.append(exportTitleWrap, exportActions);
      exportSection.append(exportHeader);

      // Warning if conflicts detected
      if (state.hasEditsConflict) {
        const conflictAlert = el('div', 'conflict-alert');
        conflictAlert.setAttribute('role', 'alert');
        conflictAlert.textContent =
          '⚠️ Warning: One or more selected edits conflicted or overlapped. Conflicting edits were automatically omitted to prevent corrupting the file.';
        exportSection.append(conflictAlert);
      }

      // Render Diff
      const diffEl = renderReadmeDiff(state.readmeSource, state.draftSource, {
        filename: state.readmeFileName || 'readme.txt',
      });
      exportSection.append(diffEl);
      container.append(exportSection);
    }

    // Live announcer element
    const liveEl = el('div', 'sr-only');
    liveEl.id = 'readme-workspace-live';
    liveEl.setAttribute('aria-live', 'polite');
    liveEl.setAttribute('aria-atomic', 'true');
    container.append(liveEl);
  }

  function executeAudit(): void {
    if (!state.readmeSource.trim()) return;

    try {
      // Find competitors or comparison if present in options or state
      const competitorPlugins: readonly NormalizedPlugin[] = options?.state?.plugins || [];
      const comparison: PluginComparison | null = null; // Can be enriched from comparison state

      const result = auditReadme({
        readme: state.readmeSource,
        phpHeaders: state.phpSource ? state.phpSource : undefined,
        comparison,
        competitorPlugins,
      });

      state.auditResult = result;
      // Do not auto-select edits; user selection is required per acceptance criteria
      state.selectedRecIds.clear();
      updateDraft();

      const totalIssues = result.summary.totalCount;
      const diagCount = result.diagnostics.length;
      announceWorkspaceStatus(
        `Audit complete: Found ${diagCount} parser diagnostic${diagCount === 1 ? '' : 's'} and ${totalIssues} recommendation${totalIssues === 1 ? '' : 's'}.`
      );

      render();
    } catch (err) {
      console.error('Error during readme audit:', err);
      announceWorkspaceStatus('An error occurred while auditing the readme.');
    }
  }

  function resetWorkspace(): void {
    state.readmeSource = '';
    state.phpSource = '';
    state.readmeFileName = null;
    state.phpFileName = null;
    state.auditResult = null;
    state.selectedRecIds.clear();
    state.draftSource = '';
    state.appliedEdits = [];
    state.hasEditsConflict = false;

    announceWorkspaceStatus('Workspace reset. In-memory file contents cleared.');
    render();
  }

  // Initial render
  render();

  return {
    getState: () => ({ ...state, selectedRecIds: new Set(state.selectedRecIds) }),
    reset: resetWorkspace,
    runAudit: executeAudit,
  };
}
