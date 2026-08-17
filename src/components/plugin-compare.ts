import type {
  ComparisonOpportunity,
  ComparisonRow,
  ComparisonStatus,
  ComparisonValue,
  FeatureComparison,
  FeatureStatus,
  NormalizedPlugin,
  PluginComparison,
} from '../domain/plugin-types';

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

/**
 * Renders status icon + text badge ensuring color is never the sole indicator.
 */
function renderStatusBadge(status?: ComparisonStatus): HTMLElement {
  const badge = el('span', `cmp-status-badge cmp-status-badge--${status || 'neutral'}`);
  const icon = el('span', 'cmp-status-badge__icon');
  icon.setAttribute('aria-hidden', 'true');
  const label = el('span', 'cmp-status-badge__label');

  switch (status) {
    case 'advantage':
      icon.textContent = '✓';
      label.textContent = 'Advantage';
      break;
    case 'disadvantage':
      icon.textContent = '⚠';
      label.textContent = 'Gap';
      break;
    case 'insufficient_data':
      icon.textContent = '—';
      label.textContent = 'No data';
      break;
    case 'unknown':
      icon.textContent = '?';
      label.textContent = 'Unknown';
      break;
    case 'match':
      icon.textContent = '≈';
      label.textContent = 'Match';
      break;
    case 'neutral':
    default:
      icon.textContent = '•';
      label.textContent = 'Neutral';
      break;
  }

  badge.append(icon, label);
  return badge;
}

/**
 * Renders feature presence status (present, absent, unknown) with distinct icons and labels.
 */
function renderFeatureStatusBadge(status: FeatureStatus): HTMLElement {
  const badge = el('span', `cmp-feature-badge cmp-feature-badge--${status}`);
  const icon = el('span', 'cmp-feature-badge__icon');
  icon.setAttribute('aria-hidden', 'true');
  const label = el('span', 'cmp-feature-badge__label');

  switch (status) {
    case 'present':
      icon.textContent = '✓';
      label.textContent = 'Present';
      break;
    case 'absent':
      icon.textContent = '✕';
      label.textContent = 'Not detected';
      break;
    case 'unknown':
    default:
      icon.textContent = '?';
      label.textContent = 'Unconfirmed';
      badge.setAttribute('title', 'Not mentioned in available summary or description');
      break;
  }

  badge.append(icon, label);
  return badge;
}

/**
 * Renders a table cell for a ComparisonValue (used in compatibility, maintenance, trust rows).
 */
function renderComparisonCell(
  val: ComparisonValue,
  isSubject: boolean
): HTMLTableCellElement {
  const td = el(
    'td',
    `cmp-table__cell ${isSubject ? 'cmp-table__cell--subject' : 'cmp-table__cell--competitor'}`
  );

  const valueWrap = el('div', 'cmp-cell-content');
  const displaySpan = el('span', 'cmp-cell-value', val.display);
  valueWrap.append(displaySpan);

  // If status is advantage or disadvantage or insufficient_data, show status badge
  if (val.status && val.status !== 'neutral') {
    valueWrap.append(renderStatusBadge(val.status));
  }

  if (val.note) {
    const note = el('small', 'cmp-cell-note', val.note);
    valueWrap.append(note);
  }

  td.append(valueWrap);
  return td;
}

/**
 * Renders the comparison table headers for Subject and Competitors.
 */
function renderTableHead(
  subject: NormalizedPlugin,
  competitors: readonly NormalizedPlugin[],
  callbacks?: {
    onRemoveCompetitor?: (slug: string) => void;
    onSetSubject?: (slug: string | null) => void;
  }
): HTMLTableSectionElement {
  const thead = el('thead', 'cmp-table__head');
  const tr = el('tr', 'cmp-table__head-row');

  // 1. Metric Label Column
  const thMetric = el('th', 'cmp-table__th cmp-table__th--metric', 'Metric / Feature');
  thMetric.setAttribute('scope', 'col');
  tr.append(thMetric);

  // 2. Subject (My Plugin) Column
  const thSubject = el('th', 'cmp-table__th cmp-table__th--subject');
  thSubject.setAttribute('scope', 'col');

  const subjectHeader = el('div', 'cmp-plugin-header cmp-plugin-header--subject');
  const subjectBadge = el('span', 'cmp-plugin-badge cmp-plugin-badge--subject', 'My Plugin');
  subjectHeader.append(subjectBadge);

  const subjectTitle = el('div', 'cmp-plugin-header__title');
  const subjectLink = el('a', 'cmp-plugin-header__link', subject.name) as HTMLAnchorElement;
  subjectLink.href = subject.pluginUrl || `https://wordpress.org/plugins/${subject.slug}/`;
  subjectLink.target = '_blank';
  subjectLink.rel = 'noopener noreferrer';
  subjectTitle.append(subjectLink);
  subjectHeader.append(subjectTitle);

  const subjectMeta = el('div', 'cmp-plugin-header__meta');
  const slugSpan = el('code', 'cmp-plugin-header__slug', subject.slug);
  const versionSpan = el('span', 'cmp-plugin-header__version', `v${subject.version}`);
  subjectMeta.append(slugSpan, versionSpan);
  subjectHeader.append(subjectMeta);

  if (callbacks?.onSetSubject) {
    const changeBtn = el('button', 'cmp-plugin-header__action-btn', 'Change');
    changeBtn.type = 'button';
    changeBtn.setAttribute('aria-label', `Change My Plugin (${subject.name})`);
    changeBtn.addEventListener('click', () => callbacks.onSetSubject?.(null));
    subjectHeader.append(changeBtn);
  }

  thSubject.append(subjectHeader);
  tr.append(thSubject);

  // 3. Competitor Columns
  for (const comp of competitors) {
    const thComp = el('th', 'cmp-table__th cmp-table__th--competitor');
    thComp.setAttribute('scope', 'col');

    const compHeader = el('div', 'cmp-plugin-header cmp-plugin-header--competitor');
    const compBadge = el('span', 'cmp-plugin-badge cmp-plugin-badge--competitor', 'Competitor');
    compHeader.append(compBadge);

    const compTitle = el('div', 'cmp-plugin-header__title');
    const compLink = el('a', 'cmp-plugin-header__link', comp.name) as HTMLAnchorElement;
    compLink.href = comp.pluginUrl || `https://wordpress.org/plugins/${comp.slug}/`;
    compLink.target = '_blank';
    compLink.rel = 'noopener noreferrer';
    compTitle.append(compLink);
    compHeader.append(compTitle);

    const compMeta = el('div', 'cmp-plugin-header__meta');
    const compSlug = el('code', 'cmp-plugin-header__slug', comp.slug);
    const compVersion = el('span', 'cmp-plugin-header__version', `v${comp.version}`);
    compMeta.append(compSlug, compVersion);
    compHeader.append(compMeta);

    if (callbacks?.onRemoveCompetitor) {
      const removeBtn = el('button', 'cmp-plugin-header__action-btn', 'Remove');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', `Remove ${comp.name} from comparison`);
      removeBtn.addEventListener('click', () => callbacks.onRemoveCompetitor?.(comp.slug));
      compHeader.append(removeBtn);
    }

    thComp.append(compHeader);
    tr.append(thComp);
  }

  thead.append(tr);
  return thead;
}

/**
 * Creates a section header row in the table body spanning all columns.
 */
function renderGroupHeaderRow(
  title: string,
  totalCols: number,
  description?: string
): HTMLTableRowElement {
  const tr = el('tr', 'cmp-table__group-row');
  const td = el('th', 'cmp-table__group-header');
  td.colSpan = totalCols;
  td.setAttribute('scope', 'colgroup');

  const titleEl = el('span', 'cmp-table__group-title', title);
  td.append(titleEl);

  if (description) {
    const descEl = el('span', 'cmp-table__group-desc', description);
    td.append(descEl);
  }

  tr.append(td);
  return tr;
}

/**
 * Renders standard comparison rows (label + subject cell + competitor cells).
 */
function renderRows(
  rows: readonly ComparisonRow[],
  tbody: HTMLTableSectionElement
): void {
  for (const row of rows) {
    const tr = el('tr', `cmp-table__data-row cmp-table__data-row--${row.key}`);
    const th = el('th', 'cmp-table__row-header', row.label);
    th.setAttribute('scope', 'row');
    tr.append(th);

    // Subject cell
    tr.append(renderComparisonCell(row.subject, true));

    // Competitor cells
    for (const compVal of row.competitors) {
      tr.append(renderComparisonCell(compVal, false));
    }

    tbody.append(tr);
  }
}

/**
 * Renders feature matrix rows.
 */
function renderFeatureRows(
  features: readonly FeatureComparison[],
  tbody: HTMLTableSectionElement
): void {
  for (const feat of features) {
    const tr = el('tr', `cmp-table__data-row cmp-table__data-row--feature`);
    const th = el('th', 'cmp-table__row-header');
    th.setAttribute('scope', 'row');

    const nameEl = el('div', 'cmp-feature-name', feat.featureName);
    th.append(nameEl);

    if (feat.description) {
      const descEl = el('small', 'cmp-feature-desc', feat.description);
      th.append(descEl);
    }
    tr.append(th);

    // Subject cell
    const tdSubject = el('td', 'cmp-table__cell cmp-table__cell--subject');
    const subjectWrap = el('div', 'cmp-cell-content');
    subjectWrap.append(renderFeatureStatusBadge(feat.subjectStatus));
    if (feat.subjectEvidence && feat.subjectEvidence.length > 0) {
      const ev = feat.subjectEvidence[0];
      const evText = el(
        'small',
        'cmp-evidence-tag',
        `Matched in ${ev.field.replace('_', ' ')}: "${ev.matchedText}"`
      );
      subjectWrap.append(evText);
    }
    tdSubject.append(subjectWrap);
    tr.append(tdSubject);

    // Competitor cells
    for (const comp of feat.competitors) {
      const tdComp = el('td', 'cmp-table__cell cmp-table__cell--competitor');
      const compWrap = el('div', 'cmp-cell-content');
      compWrap.append(renderFeatureStatusBadge(comp.status));
      if (comp.evidence && comp.evidence.length > 0) {
        const ev = comp.evidence[0];
        const evText = el(
          'small',
          'cmp-evidence-tag',
          `Matched in ${ev.field.replace('_', ' ')}: "${ev.matchedText}"`
        );
        compWrap.append(evText);
      }
      tdComp.append(compWrap);
      tr.append(tdComp);
    }

    tbody.append(tr);
  }
}

/**
 * Renders tag positioning group.
 */
function renderTagIntelligenceSection(
  tags: PluginComparison['tags'],
  _subject: NormalizedPlugin,
  competitors: readonly NormalizedPlugin[],
  tbody: HTMLTableSectionElement
): void {
  const totalCols = 1 + 1 + competitors.length;

  // 1. Shared tags row
  const trShared = el('tr', 'cmp-table__data-row');
  const thShared = el('th', 'cmp-table__row-header', 'Shared Tags');
  thShared.setAttribute('scope', 'row');
  trShared.append(thShared);

  const tdShared = el('td', 'cmp-table__cell');
  tdShared.colSpan = totalCols - 1;

  if (tags.shared.length > 0) {
    const chips = el('div', 'cmp-tag-chips');
    for (const tag of tags.shared) {
      const chip = el('span', 'cmp-tag-chip cmp-tag-chip--shared', tag);
      chips.append(chip);
    }
    tdShared.append(chips);
  } else {
    tdShared.append(el('span', 'cmp-text-muted', 'No shared tags found between subject and competitors.'));
  }
  trShared.append(tdShared);
  tbody.append(trShared);

  // 2. Subject-only tags row
  const trSubjOnly = el('tr', 'cmp-table__data-row');
  const thSubjOnly = el('th', 'cmp-table__row-header', 'Subject-Only Tags');
  thSubjOnly.setAttribute('scope', 'row');
  trSubjOnly.append(thSubjOnly);

  const tdSubjOnly = el('td', 'cmp-table__cell');
  tdSubjOnly.colSpan = totalCols - 1;

  if (tags.subjectOnly.length > 0) {
    const chips = el('div', 'cmp-tag-chips');
    for (const tag of tags.subjectOnly) {
      const chip = el('span', 'cmp-tag-chip cmp-tag-chip--subject-only', tag);
      chips.append(chip);
    }
    tdSubjOnly.append(chips);
  } else {
    tdSubjOnly.append(el('span', 'cmp-text-muted', 'None (all subject tags shared with competitors).'));
  }
  trSubjOnly.append(tdSubjOnly);
  tbody.append(trSubjOnly);

  // 3. Competitor-only tags row
  const trCompOnly = el('tr', 'cmp-table__data-row');
  const thCompOnly = el('th', 'cmp-table__row-header', 'Competitor Tags (Omitted)');
  thCompOnly.setAttribute('scope', 'row');
  trCompOnly.append(thCompOnly);

  const tdCompOnly = el('td', 'cmp-table__cell');
  tdCompOnly.colSpan = totalCols - 1;

  if (tags.competitorOnly.length > 0) {
    const chips = el('div', 'cmp-tag-chips');
    for (const item of tags.competitorOnly) {
      const chip = el(
        'span',
        'cmp-tag-chip cmp-tag-chip--competitor-only',
        `${item.tag} (${item.usedBy.length})`
      );
      chip.title = `Used by: ${item.usedBy.join(', ')}`;
      chips.append(chip);
    }
    tdCompOnly.append(chips);
  } else {
    tdCompOnly.append(el('span', 'cmp-text-muted', 'No competitor-only tags detected.'));
  }
  trCompOnly.append(tdCompOnly);
  tbody.append(trCompOnly);
}

/**
 * Renders strategic opportunities list with "Why?" disclosure showing source plugins and matched fields.
 */
export function renderOpportunities(
  opportunities: readonly ComparisonOpportunity[]
): HTMLElement {
  const container = el('div', 'cmp-opportunities');
  const header = el('div', 'cmp-opportunities__header');
  const title = el('h3', 'cmp-opportunities__title', 'Strategic Gaps & Opportunities');
  const countBadge = el('span', 'cmp-opportunities__badge', `${opportunities.length} found`);
  header.append(title, countBadge);
  container.append(header);

  if (opportunities.length === 0) {
    const emptyMsg = el(
      'p',
      'cmp-opportunities__empty',
      'No immediate strategic gaps identified across the selected comparison set.'
    );
    container.append(emptyMsg);
    return container;
  }

  const list = el('div', 'cmp-opportunities__list');

  for (const opp of opportunities) {
    const card = el('article', `cmp-opp-card cmp-opp-card--${opp.impact}`);

    // Top row: Category, Title, Badges (Impact + Confidence)
    const cardHead = el('div', 'cmp-opp-card__header');
    const titleWrap = el('div', 'cmp-opp-card__title-wrap');
    const catBadge = el('span', `cmp-opp-cat cmp-opp-cat--${opp.category}`, opp.category.toUpperCase());
    const oppTitle = el('h4', 'cmp-opp-card__title', opp.title);
    titleWrap.append(catBadge, oppTitle);

    const badgesWrap = el('div', 'cmp-opp-card__badges');
    const impactBadge = el('span', `cmp-badge cmp-badge--impact-${opp.impact}`, `${opp.impact.toUpperCase()} IMPACT`);
    const confBadge = el('span', `cmp-badge cmp-badge--conf-${opp.confidence}`, `${opp.confidence} conf`);
    badgesWrap.append(impactBadge, confBadge);

    cardHead.append(titleWrap, badgesWrap);
    card.append(cardHead);

    // Reason / Description
    const reason = el('p', 'cmp-opp-card__reason', opp.reason);
    card.append(reason);

    // "Why?" Disclosure (Requirement 5: Add “Why?” disclosure to every opportunity showing source plugins and matched fields)
    const details = el('details', 'cmp-opp-why');
    const summary = el('summary', 'cmp-opp-why__summary', 'Why? View evidence');
    details.append(summary);

    const whyContent = el('div', 'cmp-opp-why__content');

    const sourceHeader = el('p', 'cmp-opp-why__sources');
    const sourceStrong = el('strong', undefined, 'Source plugins: ');
    sourceHeader.append(sourceStrong, opp.evidenceSlugs.join(', '));
    whyContent.append(sourceHeader);

    if (opp.evidence && opp.evidence.length > 0) {
      const evidenceList = el('ul', 'cmp-opp-why__evidence-list');
      for (const ev of opp.evidence) {
        const item = el('li', 'cmp-opp-why__evidence-item');
        const slugCode = el('code', undefined, ev.slug);
        const fieldName = el('span', 'cmp-opp-why__field', ` (${ev.field || 'matched field'}): `);
        const detailText = el('span', 'cmp-opp-why__detail', ev.detail || 'Matched criteria');
        item.append(slugCode, fieldName, detailText);
        evidenceList.append(item);
      }
      whyContent.append(evidenceList);
    } else {
      const fallbackNote = el(
        'p',
        'cmp-opp-why__note',
        `Determined by comparing metrics & tags against selected competitor plugins (${opp.evidenceSlugs.join(', ')}).`
      );
      whyContent.append(fallbackNote);
    }

    details.append(whyContent);
    card.append(details);

    list.append(card);
  }

  container.append(list);
  return container;
}

/**
 * Builds full comparison workspace table DOM element.
 */
export function renderComparisonWorkspace(
  comparison: PluginComparison,
  callbacks?: {
    onRemoveCompetitor?: (slug: string) => void;
    onSetSubject?: (slug: string | null) => void;
  }
): HTMLElement {
  const wrapper = el('div', 'cmp-workspace-inner');

  // 1. Table Wrapper (Responsive with horizontal scrolling at 320px)
  const tableWrapper = el('div', 'cmp-table-wrapper');
  tableWrapper.setAttribute('role', 'region');
  tableWrapper.setAttribute('aria-label', 'Head-to-head plugin comparison table');
  tableWrapper.setAttribute('tabindex', '0');

  const table = el('table', 'cmp-table');
  table.setAttribute('aria-label', `Comparison of ${comparison.subject.name} against ${comparison.competitors.length} competitors`);

  // Table Caption for screen readers
  const caption = el(
    'caption',
    'sr-only',
    `Side-by-side comparison between subject plugin ${comparison.subject.name} and ${comparison.competitors.length} competitor plugins.`
  );
  table.append(caption);

  // Table Head
  const thead = renderTableHead(comparison.subject, comparison.competitors, callbacks);
  table.append(thead);

  // Table Body
  const tbody = el('tbody', 'cmp-table__body');
  const totalCols = 1 + 1 + comparison.competitors.length;

  // Group 1: Adoption & Trust (Active Installs, Lifetime Pace, Ratings, Support)
  tbody.append(renderGroupHeaderRow('1. Adoption & Trust Signals', totalCols, 'Active installations, average pace, ratings, and support resolution'));
  renderRows(comparison.trust, tbody);

  // Group 2: WordPress & PHP Compatibility
  tbody.append(renderGroupHeaderRow('2. Compatibility & Requirements', totalCols, 'WordPress and PHP versions supported'));
  renderRows(comparison.compatibility, tbody);

  // Group 3: Update Freshness & Maintenance
  tbody.append(renderGroupHeaderRow('3. Maintenance & Release Freshness', totalCols, 'Recency of updates and directory listing date'));
  renderRows(comparison.maintenance, tbody);

  // Group 4: Confirmed & Unknown Features
  tbody.append(renderGroupHeaderRow('4. Feature Matrix', totalCols, 'Detected features, absences, and unconfirmed items'));
  renderFeatureRows(comparison.features, tbody);

  // Group 5: Tags and Positioning
  tbody.append(renderGroupHeaderRow('5. Tags & Market Positioning', totalCols, 'Shared tags vs competitor-exclusive tags'));
  renderTagIntelligenceSection(comparison.tags, comparison.subject, comparison.competitors, tbody);

  table.append(tbody);
  tableWrapper.append(table);
  wrapper.append(tableWrapper);

  // Opportunities Section below table
  const oppSection = renderOpportunities(comparison.opportunities);
  wrapper.append(oppSection);

  return wrapper;
}

/**
 * Generates formatted Markdown representation of the comparison.
 * Includes slugs, source URLs, observation time, and metric definitions.
 */
export function generateComparisonMarkdown(comparison: PluginComparison): string {
  const timestamp = new Date().toISOString();
  const readableTime = new Date().toUTCString();

  const lines: string[] = [];

  lines.push(`# WP Plugin Pulse — Head-to-Head Comparison`);
  lines.push(``);
  lines.push(`**Observation Time:** ${readableTime} (\`${timestamp}\`)`);
  lines.push(``);

  // Metric Definitions
  lines.push(`## Metric Definitions`);
  lines.push(``);
  lines.push(`- **Lifetime Install Pace:** Reported active installs divided by days since the plugin was added. Not recent growth.`);
  lines.push(`- **Community Rating:** Aggregated star rating score (0.0–5.0) and total review count from WordPress.org.`);
  lines.push(`- **Support Resolution Rate:** Percentage of WordPress.org support forum threads marked as resolved.`);
  lines.push(`- **Maintenance Freshness:** Classified by recency of the last release: Fresh (< 30 days), Moderate (< 6 months), Aging (< 12 months), Stale (12+ months).`);
  lines.push(``);

  // Compared Plugins
  lines.push(`## Compared Plugins`);
  lines.push(``);
  lines.push(`### Subject Plugin (My Plugin)`);
  lines.push(`- **Name:** ${comparison.subject.name}`);
  lines.push(`- **Slug:** \`${comparison.subject.slug}\``);
  lines.push(`- **Source URL:** https://wordpress.org/plugins/${comparison.subject.slug}/`);
  lines.push(`- **Version:** ${comparison.subject.version}`);
  lines.push(`- **Author:** ${comparison.subject.authorName}`);
  lines.push(``);

  lines.push(`### Competitors (${comparison.competitors.length})`);
  for (const comp of comparison.competitors) {
    lines.push(`- **${comp.name}** (\`${comp.slug}\`) — v${comp.version}`);
    lines.push(`  - Source URL: https://wordpress.org/plugins/${comp.slug}/`);
    lines.push(`  - Author: ${comp.authorName}`);
  }
  lines.push(``);

  // Key Adoption & Trust Metrics Table
  lines.push(`## Key Metrics Summary`);
  lines.push(``);
  const headers = ['Metric', `${comparison.subject.name} (Subject)`, ...comparison.competitors.map((c) => c.name)];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

  for (const row of comparison.trust) {
    const rowVals = [row.label, row.subject.display, ...row.competitors.map((c) => c.display)];
    lines.push(`| ${rowVals.join(' | ')} |`);
  }
  lines.push(``);

  // Compatibility & Maintenance Table
  lines.push(`## Compatibility & Maintenance`);
  lines.push(``);
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

  for (const row of comparison.compatibility) {
    const rowVals = [row.label, row.subject.display, ...row.competitors.map((c) => c.display)];
    lines.push(`| ${rowVals.join(' | ')} |`);
  }
  for (const row of comparison.maintenance) {
    const rowVals = [row.label, row.subject.display, ...row.competitors.map((c) => c.display)];
    lines.push(`| ${rowVals.join(' | ')} |`);
  }
  lines.push(``);

  // Feature Matrix Table
  lines.push(`## Feature Matrix`);
  lines.push(``);
  lines.push(`| Feature | ${comparison.subject.name} | ${comparison.competitors.map((c) => c.name).join(' | ')} |`);
  lines.push(`| --- | --- | ${comparison.competitors.map(() => '---').join(' | ')} |`);

  for (const feat of comparison.features) {
    const formatFeatStatus = (status: FeatureStatus) => {
      if (status === 'present') return '✓ Present';
      if (status === 'absent') return '✕ Not detected';
      return '? Unknown';
    };
    const rowVals = [
      feat.featureName,
      formatFeatStatus(feat.subjectStatus),
      ...feat.competitors.map((c) => formatFeatStatus(c.status)),
    ];
    lines.push(`| ${rowVals.join(' | ')} |`);
  }
  lines.push(``);

  // Tag Positioning
  lines.push(`## Tags & Positioning`);
  lines.push(``);
  lines.push(`- **Shared Tags:** ${comparison.tags.shared.length > 0 ? comparison.tags.shared.join(', ') : 'None'}`);
  lines.push(`- **Subject-Only Tags:** ${comparison.tags.subjectOnly.length > 0 ? comparison.tags.subjectOnly.join(', ') : 'None'}`);
  lines.push(
    `- **Competitor-Only Tags:** ${
      comparison.tags.competitorOnly.length > 0
        ? comparison.tags.competitorOnly.map((t) => `${t.tag} (${t.usedBy.join(', ')})`).join(', ')
        : 'None'
    }`
  );
  lines.push(``);

  // Strategic Opportunities
  lines.push(`## Strategic Opportunities`);
  lines.push(``);
  if (comparison.opportunities.length === 0) {
    lines.push(`*No strategic gaps identified.*`);
  } else {
    for (const opp of comparison.opportunities) {
      lines.push(`### [${opp.impact.toUpperCase()}] ${opp.title} (${opp.category})`);
      lines.push(`- **Reason:** ${opp.reason}`);
      lines.push(`- **Confidence:** ${opp.confidence}`);
      lines.push(`- **Evidence Slugs:** ${opp.evidenceSlugs.join(', ')}`);
      if (opp.evidence && opp.evidence.length > 0) {
        lines.push(`- **Evidence Details:**`);
        for (const ev of opp.evidence) {
          lines.push(`  - \`${ev.slug}\` (${ev.field || 'field'}): ${ev.detail || 'Matched'}`);
        }
      }
      lines.push(``);
    }
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(`*Generated by WP Plugin Pulse — Competitive Intelligence & Readme Optimization*`);

  return lines.join('\n');
}

/**
 * Downloads comparison as Markdown Blob.
 */
export function downloadComparisonMarkdown(comparison: PluginComparison): void {
  const markdown = generateComparisonMarkdown(comparison);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const subjectSlug = comparison.subject.slug || 'plugin';
  const competitorSlugs = comparison.competitors.map((c) => c.slug).join('-vs-');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `comparison-${subjectSlug}-vs-${competitorSlugs}-${dateStr}.md`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();

  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 100);
}
