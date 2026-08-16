function createStatusRow(cellClass: string, content: HTMLElement | string): HTMLTableRowElement {
  const row = document.createElement('tr');
  const cell = document.createElement('td');

  cell.colSpan = 6;
  cell.className = 'table-status';
  cell.setAttribute('role', 'status');
  cell.setAttribute('aria-live', 'polite');
  row.append(cell);

  const inner = document.createElement('div');
  inner.className = `table-status-inner${cellClass ? ' ' + cellClass : ''}`;
  if (typeof content === 'string') {
    inner.textContent = content;
  } else {
    inner.append(content);
  }
  cell.append(inner);

  return row;
}

export function createLoadingRow(): HTMLTableRowElement {
  const innerWrap = document.createElement('div');
  innerWrap.className = 'table-status-content';

  const spinner = document.createElement('span');
  spinner.className = 'loader';
  spinner.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = 'Loading plugins…';

  innerWrap.append(spinner, text);
  return createStatusRow('table-status--loading', innerWrap);
}

export function createErrorRow(): HTMLTableRowElement {
  const innerWrap = document.createElement('div');
  innerWrap.className = 'table-status-content table-status-content--error';

  const text = document.createElement('span');
  text.textContent = 'Unable to load plugins. Please try again.';

  innerWrap.append(text);
  return createStatusRow('table-status--error', innerWrap);
}

export function createNoMatchesRow(query: string, onClear: () => void): HTMLTableRowElement {
  const innerWrap = document.createElement('div');
  innerWrap.className = 'table-status-content table-status-content--empty';

  const msg = document.createElement('p');
  msg.className = 'table-status-message';
  msg.textContent = `No plugins found matching “${query}”.`;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn-clear-filter';
  clearBtn.textContent = 'Clear filter';
  clearBtn.addEventListener('click', onClear);

  innerWrap.append(msg, clearBtn);
  return createStatusRow('table-status--no-matches', innerWrap);
}

export function createEmptyCollectionRow(tag: string): HTMLTableRowElement {
  const innerWrap = document.createElement('div');
  innerWrap.className = 'table-status-content table-status-content--empty';

  const msg = document.createElement('p');
  msg.className = 'table-status-message';
  msg.textContent = `No plugins found in the WordPress.org directory for tag “${tag}”.`;

  innerWrap.append(msg);
  return createStatusRow('table-status--empty-tag', innerWrap);
}
