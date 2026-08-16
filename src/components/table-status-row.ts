function createStatusRow(message: string, cellClass: string): HTMLTableRowElement {
  const row = document.createElement('tr');
  const cell = document.createElement('td');

  cell.colSpan = 5;
  cell.className = 'table-status';
  cell.setAttribute('role', 'status');
  cell.setAttribute('aria-live', 'polite');
  row.append(cell);

  const inner = document.createElement('div');
  inner.className = `table-status-inner${cellClass ? ' ' + cellClass : ''}`;
  cell.append(inner);

  const spinner = document.createElement('span');
  spinner.className = 'loader';
  spinner.setAttribute('aria-hidden', 'true');
  inner.append(spinner, message);

  return row;
}

export function createLoadingRow(): HTMLTableRowElement {
  return createStatusRow('Loading plugins…', 'table-status--loading');
}

export function createErrorRow(): HTMLTableRowElement {
  const row = createStatusRow('Unable to load plugins. Please try again.', 'table-status--error');
  row.querySelector('.loader')?.remove();

  return row;
}
