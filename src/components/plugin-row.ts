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

function elNS(
  tag: string,
  attrs: Record<string, string> = {}
): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, val] of Object.entries(attrs)) {
    node.setAttribute(key, val);
  }
  return node;
}

function createCell(className?: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  return cell;
}

export function createPluginRow(plugin: NormalizedPlugin): HTMLTableRowElement {
  const row = document.createElement('tr');
  const slugId = plugin.slug || plugin.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  // ==========================================
  // Column 1: Plugin
  // ==========================================
  const nameCell = createCell('col-plugin');
  const identityDiv = el('div', 'plugin-identity');

  // Icon
  const iconWrap = el('div', 'plugin-icon-wrap');
  iconWrap.setAttribute('aria-hidden', 'true');
  
  const fallbackSvg = elNS('svg', {
    class: 'plugin-icon-fallback',
    viewBox: '0 0 48 48',
    'aria-hidden': 'true'
  });
  const fallbackRect = elNS('rect', {
    width: '48', height: '48', rx: '8', fill: 'currentColor', opacity: '0.15'
  });
  const fallbackText = elNS('text', {
    x: '50%', y: '50%', 'dominant-baseline': 'central', 'text-anchor': 'middle',
    'font-size': '24', 'font-family': 'sans-serif', 'font-weight': 'bold', fill: 'currentColor'
  });
  fallbackText.textContent = plugin.name ? plugin.name.charAt(0).toUpperCase() : 'P';
  fallbackSvg.append(fallbackRect, fallbackText);
  
  if (plugin.iconUrl) {
    const img = el('img', 'plugin-icon');
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.setAttribute('width', '48');
    img.setAttribute('height', '48');
    img.setAttribute('alt', '');
    img.src = plugin.iconUrl;
    
    img.addEventListener('error', () => {
      img.style.display = 'none';
      iconWrap.append(fallbackSvg);
    });
    iconWrap.append(img);
  } else {
    iconWrap.append(fallbackSvg);
  }

  // Info
  const infoDiv = el('div', 'plugin-info');
  
  const nameLink = el('a', 'plugin-name-link', plugin.name);
  nameLink.href = plugin.pluginUrl;
  nameLink.target = '_blank';
  nameLink.rel = 'noopener noreferrer';
  infoDiv.append(nameLink);

  const authorDiv = el('div', 'plugin-author');
  authorDiv.append('by ');
  if (plugin.authorProfileUrl) {
    const authorLink = el('a', 'plugin-author-link', plugin.authorName || 'Unknown');
    authorLink.href = plugin.authorProfileUrl;
    authorLink.target = '_blank';
    authorLink.rel = 'noopener noreferrer';
    authorDiv.append(authorLink);
  } else {
    authorDiv.append(el('span', '', plugin.authorName || 'Unknown'));
  }
  infoDiv.append(authorDiv);

  let shortDesc = plugin.shortDescription || '';
  if (shortDesc.length > 100) {
    shortDesc = shortDesc.substring(0, 100) + '…';
  }
  const descDiv = el('div', 'plugin-short-desc', shortDesc);
  infoDiv.append(descDiv);

  const metaRow = el('div', 'plugin-meta-row');
  const versionBadge = el('span', 'version-badge', `v${plugin.version}`);
  
  const freshnessLabelMap: Record<string, string> = {
    'fresh': 'Active',
    'moderate': 'Moderate',
    'aging': 'Aging',
    'stale': 'Stale',
    'unknown': '—'
  };
  let freshnessClass = plugin.freshness;
  if (!freshnessLabelMap[freshnessClass]) freshnessClass = 'unknown';
  const labelText = freshnessLabelMap[freshnessClass] || '—';
  
  const freshnessBadge = el('span', `freshness-badge freshness-badge--${freshnessClass}`, labelText);
  if (plugin.lastUpdatedRelative) {
    freshnessBadge.title = `Last updated: ${plugin.lastUpdatedRelative}`;
  }
  
  const detailsToggle = el('button', 'details-toggle', 'Details');
  detailsToggle.type = 'button';
  detailsToggle.setAttribute('aria-expanded', 'false');
  detailsToggle.setAttribute('aria-controls', `details-${slugId}`);
  
  metaRow.append(versionBadge, freshnessBadge, detailsToggle);
  infoDiv.append(metaRow);

  const detailsPanel = el('div', 'plugin-details');
  detailsPanel.id = `details-${slugId}`;
  detailsPanel.hidden = true;
  
  const addDetail = (label: string, value: string) => {
    const row = el('div', 'details-section');
    row.append(el('span', 'details-label', label), el('span', '', value));
    detailsPanel.append(row);
  };
  addDetail('WP:', `${plugin.requiresWordPress ?? '—'} — ${plugin.testedWordPress ?? '—'}`);
  addDetail('PHP:', plugin.requiresPhp ?? '—');
  if (plugin.requiredPlugins && plugin.requiredPlugins.length > 0) {
    addDetail('Requires:', plugin.requiredPlugins.join(', '));
  }
    addDetail('Downloads (lifetime):', `${plugin.lifetimeDownloadsDisplay} cumulative`);

    if (plugin.tags && plugin.tags.length > 0) {
      const tagsRow = el('div', 'details-section details-tags-section');
      tagsRow.append(el('span', 'details-label', 'Tags:'));
      const tagsList = el('div', 'plugin-tags-list');
      for (const tag of plugin.tags) {
        const tagBtn = el('button', 'plugin-tag-chip', tag);
        tagBtn.type = 'button';
        tagBtn.setAttribute('data-tag', tag);
        tagBtn.setAttribute('title', `Explore plugins tagged "${tag}"`);
        tagBtn.setAttribute('aria-label', `Explore plugins tagged "${tag}"`);
        tagBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          tagBtn.dispatchEvent(new CustomEvent('select-tag', { bubbles: true, detail: { tag } }));
        });
        tagsList.append(tagBtn);
      }
      tagsRow.append(tagsList);
      detailsPanel.append(tagsRow);
    }
    
    if (plugin.downloadUrl) {
      const dlLink = el('a', 'details-link', 'Download .zip');
      dlLink.href = plugin.downloadUrl;
      dlLink.target = '_blank';
      dlLink.rel = 'noopener noreferrer';
      detailsPanel.append(dlLink);
    }

    detailsToggle.addEventListener('click', () => {
      const isHidden = detailsPanel.hidden;
      detailsPanel.hidden = !isHidden;
      detailsToggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });

    infoDiv.append(detailsPanel);
    identityDiv.append(iconWrap, infoDiv);
  nameCell.append(identityDiv);

  // ==========================================
  // Column 2: Estimated Installs / Day
  // ==========================================
  const ipDayCell = createCell('col-numeric');
  if (plugin.estimatedInstallsPerDay === 0) {
    const unavail = el('span', 'stat-unavailable', '—');
    unavail.title = 'Cannot estimate: plugin added date is unavailable.';
    ipDayCell.append(unavail);
  } else {
    ipDayCell.append(el('div', 'stat-primary', `~${plugin.estimatedInstallsPerDayDisplay}`));
    ipDayCell.append(el('div', 'stat-secondary stat-hint', 'est. per day'));
  }

  // ==========================================
  // Column 3: Active Installs
  // ==========================================
  const installsCell = createCell('col-numeric');
  installsCell.append(el('div', 'stat-primary', plugin.activeInstallsDisplay));
  if (plugin.activeInstalls >= 1000000) {
    installsCell.append(el('div', 'stat-secondary stat-hint', 'reported (may be capped)'));
  }

  // ==========================================
  // Column 4: Rating
  // ==========================================
  const ratingCell = createCell('col-numeric');
  const ratingWrap = el('div', 'rating-wrap');
  
  if (plugin.ratingCount === 0) {
    const ratingTop = el('div', 'rating-top');
    ratingTop.append(el('span', 'rating-score', '—'));
    const ratingBar = el('div', 'rating-bar');
    ratingBar.setAttribute('role', 'meter');
    ratingBar.setAttribute('aria-valuenow', '0');
    ratingBar.setAttribute('aria-valuemin', '0');
    ratingBar.setAttribute('aria-valuemax', '100');
    ratingBar.setAttribute('aria-label', 'Rating: 0 out of 5');
    const ratingBarFill = el('div', 'rating-bar-fill');
    ratingBarFill.style.width = '0%';
    ratingBar.append(ratingBarFill);
    ratingWrap.append(ratingTop, ratingBar, el('span', 'rating-count', 'No ratings'));
  } else {
    const ratingTop = el('div', 'rating-top');
    const rScore = el('span', 'rating-score', `${plugin.ratingScoreDisplay} ★`);
    rScore.setAttribute('aria-label', `${plugin.ratingScoreDisplay} out of 5 stars`);
    ratingTop.append(rScore);
    
    const distToggle = el('button', 'rating-dist-toggle');
    distToggle.type = 'button';
    distToggle.setAttribute('aria-expanded', 'false');
    distToggle.setAttribute('aria-controls', `rating-dist-${slugId}`);
    distToggle.setAttribute('aria-label', 'Show rating distribution');
    distToggle.textContent = '▾';
    ratingTop.append(distToggle);
    
    const ratingBar = el('div', 'rating-bar');
    ratingBar.setAttribute('role', 'meter');
    ratingBar.setAttribute('aria-valuenow', plugin.ratingPercent.toString());
    ratingBar.setAttribute('aria-valuemin', '0');
    ratingBar.setAttribute('aria-valuemax', '100');
    ratingBar.setAttribute('aria-label', `Rating: ${plugin.ratingScoreDisplay} out of 5`);
    const ratingBarFill = el('div', 'rating-bar-fill');
    ratingBarFill.style.width = `${plugin.ratingPercent}%`;
    ratingBar.append(ratingBarFill);
    
    ratingWrap.append(ratingTop, ratingBar, el('span', 'rating-count', `${plugin.ratingCount.toLocaleString()} ratings`));
    
    const distPanel = el('div', 'rating-dist');
    distPanel.id = `rating-dist-${slugId}`;
    distPanel.hidden = true;
    
    const stars = [5, 4, 3, 2, 1];
    for (const star of stars) {
      const count = plugin.ratingDistribution?.[star as 1|2|3|4|5] || 0;
      let pct = plugin.ratingCount > 0 ? (count / plugin.ratingCount) * 100 : 0;
      if (pct > 100) pct = 100;
      if (pct < 0) pct = 0;
      
      const rRow = el('div', 'rating-dist-row');
      rRow.append(el('span', 'rating-dist-star', `${star}★`));
      
      const barWrap = el('div', 'rating-dist-bar-wrap');
      const bar = el('div', 'rating-dist-bar');
      bar.style.width = `${pct}%`;
      barWrap.append(bar);
      rRow.append(barWrap);
      
      rRow.append(el('span', 'rating-dist-count', count.toString()));
      distPanel.append(rRow);
    }
    ratingWrap.append(distPanel);
    
    distToggle.addEventListener('click', () => {
      const isHidden = distPanel.hidden;
      distPanel.hidden = !isHidden;
      distToggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });
  }
  ratingCell.append(ratingWrap);

  // ==========================================
  // Column 5: Support
  // ==========================================
  const supportCell = createCell('col-numeric');
  const supWrap = el('div', 'support-wrap');
  
  const supCounts = el('div', 'support-counts');
  supCounts.append(
    el('span', 'support-resolved', `${plugin.supportThreadsResolved} resolved`),
    el('span', 'support-separator', ' / '),
    el('span', 'support-total', `${plugin.supportThreads} total`)
  );
  supWrap.append(supCounts);
  
  if (plugin.supportResolutionRate !== null) {
    const rate = plugin.supportResolutionRate;
    const supBar = el('div', 'support-bar');
    supBar.setAttribute('role', 'meter');
    supBar.setAttribute('aria-valuenow', rate.toString());
    supBar.setAttribute('aria-valuemin', '0');
    supBar.setAttribute('aria-valuemax', '100');
    supBar.setAttribute('aria-label', `Support resolution: ${rate.toFixed(0)}%`);
    const supBarFill = el('div', 'support-bar-fill');
    supBarFill.style.width = `${rate}%`;
    supBar.append(supBarFill);
    
    supWrap.append(supBar, el('div', 'support-rate', `${rate.toFixed(0)}% resolved`));
  } else {
    supWrap.append(el('div', 'support-rate stat-unavailable', 'No threads'));
  }
  supportCell.append(supWrap);

  // ==========================================
  // Column 6: Last Updated
  // ==========================================
  const updatedCell = createCell('col-numeric');
  updatedCell.append(el('div', 'stat-primary', plugin.lastUpdatedRelative || '—'));
  if (plugin.lastUpdatedAt) {
    const d = new Date(plugin.lastUpdatedAt);
    updatedCell.append(el('div', 'stat-secondary', d.toLocaleDateString()));
  }

  row.append(nameCell, ipDayCell, installsCell, ratingCell, supportCell, updatedCell);

  return row;
}
