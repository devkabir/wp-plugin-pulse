import type { AppState } from '../domain/plugin-types';

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

export function announceComparisonStatus(message: string): void {
  let liveEl = document.getElementById('comparison-live');
  if (!liveEl) {
    liveEl = document.createElement('div');
    liveEl.id = 'comparison-live';
    liveEl.className = 'sr-only';
    liveEl.setAttribute('aria-live', 'polite');
    liveEl.setAttribute('aria-atomic', 'true');
    document.body.append(liveEl);
  }
  // Clear and update with a micro-tick to ensure screen readers register change
  liveEl.textContent = '';
  setTimeout(() => {
    if (liveEl) {
      liveEl.textContent = message;
    }
  }, 10);
}

function findPluginName(slug: string, state: AppState): string {
  const match = state.plugins.find((p) => p.slug === slug);
  return match?.name || slug;
}

export function renderComparisonTray(
  state: AppState,
  callbacks?: {
    onSetSubject?: (slug: string | null) => void;
    onRemoveCompetitor?: (slug: string) => void;
    onClear?: () => void;
    onCompare?: () => void;
  }
): void {
  let tray = document.getElementById('comparison-tray');
  if (!tray) {
    tray = document.createElement('aside');
    tray.id = 'comparison-tray';
    tray.className = 'comparison-tray';
    tray.setAttribute('aria-label', 'Plugin comparison selections');
    const main = document.querySelector('main') || document.body;
    main.append(tray);
  }

  const { subjectSlug, competitorSlugs } = state.comparison;
  const hasSubject = Boolean(subjectSlug);
  const competitorCount = competitorSlugs.length;
  const totalSelected = (hasSubject ? 1 : 0) + competitorCount;
  const canCompare = hasSubject && competitorCount >= 1;

  tray.innerHTML = '';

  const inner = el('div', 'comparison-tray__inner');

  // 1. Header / Selection Count
  const header = el('div', 'comparison-tray__header');
  const title = el('div', 'comparison-tray__title');
  const titleText = el('span', 'comparison-tray__title-text', 'Comparison');
  const countBadge = el(
    'span',
    `comparison-tray__count-badge ${totalSelected > 0 ? 'comparison-tray__count-badge--active' : ''}`,
    `${totalSelected} selected`
  );
  title.append(titleText, countBadge);

  const subtitle = el('p', 'comparison-tray__subtitle');
  if (!hasSubject && competitorCount === 0) {
    subtitle.textContent = 'Select one subject plugin and up to 3 competitors to compare.';
  } else if (!hasSubject) {
    subtitle.textContent = 'Set “My Plugin” (subject) to enable side-by-side comparison.';
  } else if (competitorCount === 0) {
    subtitle.textContent = 'Add at least 1 competitor to enable comparison.';
  } else {
    subtitle.textContent = `Comparing 1 subject against ${competitorCount} competitor${competitorCount > 1 ? 's' : ''}.`;
  }
  header.append(title, subtitle);

  // 2. Selection Slots (Subject + Competitors)
  const slotsContainer = el('div', 'comparison-tray__slots');

  // --- Subject Slot ---
  const subjectSlot = el('div', 'comparison-tray__slot-group comparison-tray__slot-group--subject');
  const subjectLabel = el('span', 'comparison-tray__slot-label', 'My Plugin:');
  subjectSlot.append(subjectLabel);

  if (subjectSlug) {
    const subjectName = findPluginName(subjectSlug, state);
    const pill = el('div', 'comparison-pill comparison-pill--subject');
    const nameSpan = el('span', 'comparison-pill__name', subjectName);
    nameSpan.title = subjectSlug;

    const removeBtn = el('button', 'comparison-pill__remove', '✕');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${subjectName} as My Plugin`);
    removeBtn.title = `Remove ${subjectName} as My Plugin`;
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (callbacks?.onSetSubject) {
        callbacks.onSetSubject(null);
      } else {
        tray?.dispatchEvent(
          new CustomEvent('select-subject', {
            bubbles: true,
            detail: { slug: null, name: subjectName },
          })
        );
      }
    });

    pill.append(nameSpan, removeBtn);
    subjectSlot.append(pill);
  } else {
    const emptySlot = el('div', 'comparison-pill comparison-pill--empty', 'None selected');
    subjectSlot.append(emptySlot);
  }
  slotsContainer.append(subjectSlot);

  // --- Competitors Slot ---
  const competitorsSlot = el('div', 'comparison-tray__slot-group comparison-tray__slot-group--competitors');
  const compLabel = el(
    'span',
    'comparison-tray__slot-label',
    `Competitors (${competitorCount}/3):`
  );
  competitorsSlot.append(compLabel);

  const pillsWrap = el('div', 'comparison-tray__pills-wrap');

  if (competitorCount === 0) {
    const emptyComp = el('div', 'comparison-pill comparison-pill--empty', 'No competitors');
    pillsWrap.append(emptyComp);
  } else {
    for (const compSlug of competitorSlugs) {
      const compName = findPluginName(compSlug, state);
      const pill = el('div', 'comparison-pill comparison-pill--competitor');
      const nameSpan = el('span', 'comparison-pill__name', compName);
      nameSpan.title = compSlug;

      const removeBtn = el('button', 'comparison-pill__remove', '✕');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', `Remove ${compName} from comparison`);
      removeBtn.title = `Remove ${compName} from comparison`;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks?.onRemoveCompetitor) {
          callbacks.onRemoveCompetitor(compSlug);
        } else {
          tray?.dispatchEvent(
            new CustomEvent('remove-competitor', {
              bubbles: true,
              detail: { slug: compSlug, name: compName },
            })
          );
        }
      });

      pill.append(nameSpan, removeBtn);
      pillsWrap.append(pill);
    }
  }

  competitorsSlot.append(pillsWrap);
  slotsContainer.append(competitorsSlot);

  // 3. Actions (Clear & Compare)
  const actions = el('div', 'comparison-tray__actions');

  const clearBtn = el('button', 'btn-tray-clear', 'Clear');
  clearBtn.type = 'button';
  clearBtn.id = 'btn-tray-clear';
  clearBtn.setAttribute('aria-label', 'Clear all comparison selections');
  if (totalSelected === 0) {
    clearBtn.disabled = true;
    clearBtn.setAttribute('aria-disabled', 'true');
  }
  clearBtn.addEventListener('click', () => {
    if (callbacks?.onClear) {
      callbacks.onClear();
    } else {
      tray?.dispatchEvent(new CustomEvent('clear-comparison', { bubbles: true }));
    }
  });

  const compareBtn = el(
    'button',
    `btn-tray-compare ${canCompare ? 'btn-tray-compare--enabled' : ''}`,
    'Compare'
  );
  compareBtn.type = 'button';
  compareBtn.id = 'btn-tray-compare';
  compareBtn.setAttribute('aria-label', 'Compare selected plugins');

  if (!canCompare) {
    compareBtn.disabled = true;
    compareBtn.setAttribute('aria-disabled', 'true');
    if (!hasSubject) {
      compareBtn.title = 'Select “My Plugin” to enable comparison';
    } else {
      compareBtn.title = 'Select at least one competitor to enable comparison';
    }
  } else {
    compareBtn.title = `Compare ${findPluginName(subjectSlug!, state)} with ${competitorCount} competitor${competitorCount > 1 ? 's' : ''}`;
  }

  compareBtn.addEventListener('click', () => {
    if (!canCompare) return;
    if (callbacks?.onCompare) {
      callbacks.onCompare();
    } else {
      tray?.dispatchEvent(new CustomEvent('open-comparison', { bubbles: true }));
    }
  });

  actions.append(clearBtn, compareBtn);

  inner.append(header, slotsContainer, actions);
  tray.append(inner);
}
