function createStatusRow(message: string, className: string): HTMLTableRowElement {
  const row = document.createElement('tr');
  const cell = document.createElement('td');

  cell.colSpan = 4;
  cell.className = className;
  cell.setAttribute('role', 'status');
  cell.setAttribute('aria-live', 'polite');
  row.append(cell);

  const spinner = document.createElement('span');
  spinner.className = 'loader';
  spinner.setAttribute('aria-hidden', 'true');
  cell.append(spinner, message);

  return row;
}

export function createLoadingRow(): HTMLTableRowElement {
  return createStatusRow('Loading plugins…', 'table-status table-status--loading');
}

export function createErrorRow(): HTMLTableRowElement {
  const row = createStatusRow('Unable to load plugins. Please try again.', 'table-status');
  row.querySelector('.loader')?.remove();

  return row;
}
