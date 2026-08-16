import type { AppError } from '../domain/plugin-types';

export function createTableSkeletons(count = 6): DocumentFragment {
  const frag = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const row = document.createElement('tr');
    row.className = 'plugin-row plugin-row--skeleton';
    row.setAttribute('aria-hidden', 'true');

    // 1. Plugin Identity Column (Icon + Title + Author)
    const identityCell = document.createElement('td');
    identityCell.className = 'plugin-cell-primary';
    const identityWrap = document.createElement('div');
    identityWrap.className = 'plugin-identity';
    const icon = document.createElement('div');
    icon.className = 'plugin-icon-skeleton';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'plugin-title-skeleton-wrap';
    const titleLine = document.createElement('div');
    titleLine.className = 'skeleton-line skeleton-line--title';
    const authorLine = document.createElement('div');
    authorLine.className = 'skeleton-line skeleton-line--author';
    titleWrap.append(titleLine, authorLine);
    identityWrap.append(icon, titleWrap);
    identityCell.append(identityWrap);

    // 2. Lifetime Install Pace Column
    const estCell = document.createElement('td');
    estCell.className = 'col-numeric';
    const estPill = document.createElement('div');
    estPill.className = 'skeleton-pill skeleton-pill--estimate';
    estCell.append(estPill);

    // 3. Active Installs Column
    const installsCell = document.createElement('td');
    installsCell.className = 'col-numeric';
    const installsLine = document.createElement('div');
    installsLine.className = 'skeleton-line skeleton-line--metric';
    installsCell.append(installsLine);

    // 4. Rating Column
    const ratingCell = document.createElement('td');
    ratingCell.className = 'col-numeric';
    const ratingBar = document.createElement('div');
    ratingBar.className = 'skeleton-bar skeleton-bar--rating';
    ratingCell.append(ratingBar);

    // 5. Support Column
    const supportCell = document.createElement('td');
    supportCell.className = 'col-numeric';
    const supportPill = document.createElement('div');
    supportPill.className = 'skeleton-pill skeleton-pill--support';
    supportCell.append(supportPill);

    // 6. Last Updated Column
    const updatedCell = document.createElement('td');
    updatedCell.className = 'col-numeric';
    const updatedPill = document.createElement('div');
    updatedPill.className = 'skeleton-pill skeleton-pill--badge';
    updatedCell.append(updatedPill);

    row.append(identityCell, estCell, installsCell, ratingCell, supportCell, updatedCell);
    frag.append(row);
  }

  return frag;
}

export function createTableErrorRow(
  error: AppError | null,
  tag: string,
  onRetry: () => void
): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.className = 'table-status-row table-status-row--error';

  const cell = document.createElement('td');
  cell.colSpan = 6;
  cell.className = 'table-status';
  cell.setAttribute('role', 'alert');
  row.append(cell);

  const container = document.createElement('div');
  container.className = 'table-status-box table-status-box--error';

  const icon = document.createElement('div');
  icon.className = 'table-status-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = error?.kind === 'network' ? '⚡' : '⚠';

  const heading = document.createElement('h3');
  heading.className = 'table-status-title';
  if (error?.kind === 'network') {
    heading.textContent = 'Network Connection Error';
  } else if (error?.kind === 'invalid_response') {
    heading.textContent = 'Invalid API Response';
  } else if (error?.kind === 'http') {
    heading.textContent = error.statusCode ? `Server Error (HTTP ${error.statusCode})` : 'Server Error';
  } else {
    heading.textContent = 'Failed to Load Plugins';
  }

  const msg = document.createElement('p');
  msg.className = 'table-status-message';
  msg.textContent = error?.message || `Unable to load plugins for tag “${tag}”. Please try again.`;

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'btn-retry-tag';
  retryBtn.id = 'btn-retry-table';
  retryBtn.setAttribute('aria-label', `Retry loading plugins for tag ${tag}`);
  retryBtn.textContent = 'Retry Request';
  retryBtn.addEventListener('click', onRetry);

  container.append(icon, heading, msg, retryBtn);
  cell.append(container);

  return row;
}

export function createTableNoMatchesRow(query: string, onClear: () => void): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.className = 'table-status-row table-status-row--no-matches';

  const cell = document.createElement('td');
  cell.colSpan = 6;
  cell.className = 'table-status';
  cell.setAttribute('role', 'status');
  row.append(cell);

  const container = document.createElement('div');
  container.className = 'table-status-box table-status-box--no-matches';

  const icon = document.createElement('div');
  icon.className = 'table-status-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🔍';

  const heading = document.createElement('h3');
  heading.className = 'table-status-title';
  heading.textContent = 'No Matching Plugins';

  const msg = document.createElement('p');
  msg.className = 'table-status-message';
  msg.textContent = `No loaded plugins matched your filter “${query}”.`;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn-clear-filter';
  clearBtn.textContent = 'Clear Filter';
  clearBtn.addEventListener('click', onClear);

  container.append(icon, heading, msg, clearBtn);
  cell.append(container);

  return row;
}

export function createTableEmptyTagRow(tag: string): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.className = 'table-status-row table-status-row--empty';

  const cell = document.createElement('td');
  cell.colSpan = 6;
  cell.className = 'table-status';
  cell.setAttribute('role', 'status');
  row.append(cell);

  const container = document.createElement('div');
  container.className = 'table-status-box table-status-box--empty';

  const icon = document.createElement('div');
  icon.className = 'table-status-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '📂';

  const heading = document.createElement('h3');
  heading.className = 'table-status-title';
  heading.textContent = 'No Plugins Found';

  const msg = document.createElement('p');
  msg.className = 'table-status-message';
  msg.textContent = `No plugins found in the WordPress.org directory for tag “${tag}”.`;

  container.append(icon, heading, msg);
  cell.append(container);

  return row;
}

// Aliases for compatibility
export const createLoadingRow = createTableSkeletons;
export const createEmptyCollectionRow = createTableEmptyTagRow;
export const createErrorRow = (error?: AppError | null, tag = 'plugin', onRetry?: () => void) =>
  createTableErrorRow(error ?? null, tag, onRetry ?? (() => document.dispatchEvent(new CustomEvent('retry-plugin-request'))));
export const createNoMatchesRowAlias = createTableNoMatchesRow;

