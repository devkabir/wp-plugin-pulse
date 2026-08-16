import type { AppState, KpiSummaryMetrics } from '../domain/plugin-types';
import { computeKpiSummary } from '../domain/plugin-kpi';

/**
 * KPI card descriptor. Each card has a label, primary value, an optional
 * sub-label for context, and an optional helper text explaining the metric.
 */
interface KpiCardSpec {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  helper?: string;
  /** Accent color modifier: 'default' | 'accent' | 'success' | 'warning' */
  tone?: 'default' | 'accent' | 'success' | 'warning';
}

function buildCards(metrics: KpiSummaryMetrics): KpiCardSpec[] {
  const leader = metrics.topEstimatedInstallsLeader;
  const isPartial = !metrics.isFullyLoaded;
  const shareDisplay =
    metrics.dominantPluginInstallShare !== null
      ? `${metrics.dominantPluginInstallShare}% of ${isPartial ? 'loaded' : 'all'} installs`
      : null;

  // Concentration tone: monopoly (≥50%) = warning, shared (<30%) = success
  const concentrationTone: KpiCardSpec['tone'] =
    metrics.dominantPluginInstallShare !== null && metrics.dominantPluginInstallShare >= 50
      ? 'warning'
      : metrics.dominantPluginInstallShare !== null && metrics.dominantPluginInstallShare < 30
        ? 'success'
        : 'default';

  // Rating bar tone: high bar (≥4.5) = warning for newcomers, low bar (<3.5) = opportunity
  const ratingTone: KpiCardSpec['tone'] =
    metrics.weightedCommunityRating !== null && metrics.weightedCommunityRating >= 4.5
      ? 'warning'
      : metrics.weightedCommunityRating !== null && metrics.weightedCommunityRating < 3.5
        ? 'success'
        : 'default';

  const gapTone: KpiCardSpec['tone'] =
    metrics.staleCount >= 5 ? 'success' : metrics.staleCount >= 2 ? 'default' : 'default';

  return [
    {
      id: 'kpi-crowded',
      label: 'How crowded?',
      value: `${metrics.totalResults} plugins`,
      subValue: isPartial
        ? `${metrics.totalLoaded} loaded (${metrics.loadedPagesCount} of ${metrics.totalPages} pages)`
        : `All ${metrics.totalLoaded} plugins loaded (${metrics.totalPages} ${metrics.totalPages === 1 ? 'page' : 'pages'})`,
      helper: isPartial
        ? `Total plugins tagged in this niche across ${metrics.totalPages} pages. Load all pages for the full collection.`
        : 'Total plugins tagged in this niche. More competition means harder discoverability on WordPress.org.',
      tone: 'default',
    },
    {
      id: 'kpi-leader',
      label: isPartial ? 'Leader (loaded set)' : 'Who dominates?',
      value: leader ? leader.activeInstallsDisplay : '—',
      subValue: leader
        ? isPartial
          ? `${leader.name} (top of ${metrics.totalLoaded} loaded)`
          : leader.name
        : 'No clear leader',
      helper: leader
        ? isPartial
          ? `${leader.name} leads the ${metrics.totalLoaded} currently loaded plugins. Load all ${metrics.totalPages} pages to confirm global tag ranking.`
          : `${leader.name} is the overall install leader across all ${metrics.totalResults} plugins. Est. ${leader.installsPerDayDisplay} new installs/day (active installs ÷ days listed).`
        : 'No plugin with measurable traction found in this set.',
      tone: 'accent',
    },
    {
      id: 'kpi-concentration',
      label: 'Market share',
      value: shareDisplay ?? '—',
      subValue: isPartial
        ? metrics.dominantPluginInstallShare !== null
          ? `${metrics.dominantPluginInstallShare}% share of loaded installs`
          : 'Moderately shared'
        : metrics.dominantPluginInstallShare !== null && metrics.dominantPluginInstallShare >= 50
          ? 'One plugin dominates — tough to dislodge'
          : metrics.dominantPluginInstallShare !== null && metrics.dominantPluginInstallShare < 30
            ? 'Fragmented — room to compete'
            : 'Moderately shared',
      helper: isPartial
        ? "The top loaded plugin's active installs as a share of currently loaded installs. Load all pages for full market concentration."
        : "The #1 plugin's active installs as a share of the total. A high share means you'd be entering a monopolized niche.",
      tone: concentrationTone,
    },
    {
      id: 'kpi-rating-bar',
      label: 'Rating bar to beat',
      value: metrics.weightedCommunityRatingDisplay,
      subValue:
        metrics.weightedCommunityRating !== null && metrics.weightedCommunityRating >= 4.5
          ? 'out of 5 — high standard'
          : metrics.weightedCommunityRating !== null && metrics.weightedCommunityRating < 3.5
            ? 'out of 5 — low bar, opportunity'
            : metrics.weightedCommunityRating !== null
              ? 'out of 5 — average standard'
              : 'no ratings yet',
      helper:
        'Weighted average rating across this tag, by review count. This is the quality floor your plugin needs to clear to be competitive.',
      tone: ratingTone,
    },
    {
      id: 'kpi-support-bar',
      label: 'Support bar',
      value: metrics.overallSupportResolutionRateDisplay,
      subValue:
        metrics.overallSupportResolutionRate !== null
          ? 'threads resolved across this niche'
          : 'no support data',
      helper:
        'How well existing plugins handle support. A low rate signals a weak support culture — a differentiation opportunity if you commit to responsiveness.',
      tone: 'default',
    },
    {
      id: 'kpi-gap',
      label: 'Abandoned slots',
      value: `${metrics.staleCount}`,
      subValue:
        metrics.staleCount > 0
          ? `plugin${metrics.staleCount === 1 ? '' : 's'} not updated in 12+ months`
          : 'all plugins recently maintained',
      helper:
        'Plugins with no update in over a year. Stale, installed plugins with unresolved issues are niches you could take with active development.',
      tone: gapTone,
    },
  ];
}

function createKpiCard(spec: KpiCardSpec): HTMLElement {
  const card = document.createElement('article');
  card.className = `kpi-card kpi-card--${spec.tone ?? 'default'}`;
  card.setAttribute('aria-labelledby', `${spec.id}-label`);

  const labelEl = document.createElement('h3');
  labelEl.id = `${spec.id}-label`;
  labelEl.className = 'kpi-card__label';
  labelEl.textContent = spec.label;

  const valueEl = document.createElement('p');
  valueEl.className = 'kpi-card__value';
  valueEl.setAttribute('aria-label', `${spec.label}: ${spec.value}`);
  valueEl.textContent = spec.value;

  card.append(labelEl, valueEl);

  if (spec.subValue) {
    const subEl = document.createElement('p');
    subEl.className = 'kpi-card__sub';
    subEl.textContent = spec.subValue;
    card.append(subEl);
  }

  if (spec.helper) {
    const helperEl = document.createElement('p');
    helperEl.className = 'kpi-card__helper';
    helperEl.textContent = spec.helper;
    card.append(helperEl);
  }

  return card;
}

function createKpiSkeleton(): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 6; i++) {
    const card = document.createElement('article');
    card.className = 'kpi-card kpi-card--skeleton';
    card.setAttribute('aria-hidden', 'true');
    const lbl = document.createElement('div');
    lbl.className = 'kpi-card__skeleton-label';
    const val = document.createElement('div');
    val.className = 'kpi-card__skeleton-value';
    const sub = document.createElement('div');
    sub.className = 'kpi-card__skeleton-sub';
    card.append(lbl, val, sub);
    frag.append(card);
  }
  return frag;
}

/**
 * Render (or update) the KPI summary section.
 * - Shows skeleton cards while loading.
 * - Hides the section on error.
 * - Renders computed KPI cards when ready.
 *
 * Calculations use the full loaded collection (appState.plugins), not any
 * locally filtered subset. The section header states this explicitly.
 */
export function renderKpiSummary(state: AppState): void {
  const section = document.getElementById('kpi-summary');
  if (!section) return;

  if (state.status === 'loading') {
    section.hidden = false;
    const grid = section.querySelector<HTMLElement>('.kpi-grid');
    if (grid) grid.replaceChildren(createKpiSkeleton());
    return;
  }

  if (state.status === 'error' || state.status === 'idle') {
    section.hidden = true;
    return;
  }

  // status === 'ready'
  if (state.plugins.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;

  const metrics = computeKpiSummary(
    state.plugins,
    state.totalResults,
    state.totalPages,
    state.loadedPages.length
  );

  const grid = section.querySelector<HTMLElement>('.kpi-grid');
  if (!grid) return;

  const cards = buildCards(metrics);
  grid.replaceChildren(...cards.map(createKpiCard));

  // Update context note
  const context = section.querySelector<HTMLElement>('.kpi-context');
  if (context) {
    const tag = state.activeTag;
    const loaded = state.plugins.length;
    const total = state.totalResults;
    const loadedPagesCount = state.loadedPages.length;
    const totalPages = state.totalPages;

    context.textContent =
      !metrics.isFullyLoaded
        ? `Based on ${loaded} of ${total} plugins tagged "${tag}" (${loadedPagesCount} of ${totalPages} pages loaded). Load all pages for complete competitive landscape.`
        : `Based on all ${total} plugins tagged "${tag}" across ${totalPages} ${totalPages === 1 ? 'page' : 'pages'}.`;
  }
}
