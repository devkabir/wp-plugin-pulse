import type { NormalizedPlugin } from '../domain/plugin-types';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCell(className?: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  return cell;
}

export function createPluginRow(plugin: NormalizedPlugin): HTMLTableRowElement {
  const row = document.createElement('tr');

  // — Plugin name cell
  const nameCell = createCell();
  const nameEl = el('span', 'plugin-name', plugin.name);
  nameCell.append(nameEl);

  // — Installs / day cell
  const ipDayCell = createCell('col-numeric');
  const ipDayPrimary = el('div', 'stat-primary', `~${plugin.estimatedInstallsPerDayDisplay} / day`);
  ipDayCell.append(ipDayPrimary);

  // — Active installs cell
  const installsCell = createCell('col-numeric');
  const installsPrimary = el('div', 'stat-primary', plugin.activeInstallsDisplay);
  installsCell.append(installsPrimary);

  // — Rating cell
  const ratingCell = createCell('col-numeric');
  const ratingWrap = el('div', 'rating-wrap');
  const ratingScore = el('span', 'rating-score', `${plugin.ratingScoreDisplay} ★`);
  const ratingBar = el('div', 'rating-bar');
  const ratingBarFill = el('div', 'rating-bar-fill');
  ratingBarFill.style.width = `${plugin.ratingPercent}%`;
  ratingBar.append(ratingBarFill);
  const ratingCount = el('span', 'rating-count', `${plugin.ratingCount.toLocaleString()} ratings`);
  ratingWrap.append(ratingScore, ratingBar, ratingCount);
  ratingCell.append(ratingWrap);

  // — Support threads cell
  const supportCell = createCell('col-numeric');
  const badgeLevel =
    plugin.supportThreads === 0 ? 'low'
    : plugin.supportThreads < 10 ? 'low'
    : plugin.supportThreads < 30 ? 'medium'
    : 'high';
  const badge = el('span', `support-badge support-badge--${badgeLevel}`, `${plugin.supportThreads} open`);
  supportCell.append(badge);

  row.append(nameCell, ipDayCell, installsCell, ratingCell, supportCell);

  return row;
}
