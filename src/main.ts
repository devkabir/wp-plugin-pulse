import './style.css';
import { createIcons, Activity, Search } from 'lucide';
import { createPluginRow } from './components/plugin-row';
import { createErrorRow, createLoadingRow } from './components/table-status-row';
import { decodeHtmlEntities } from './utils/decode-html-entities';

interface Plugin {
  name: string;
  added: string;
  active_installs: number;
  rating: number;
  num_ratings: number;
  support_threads?: number;
}

interface PluginResponse {
  plugins?: Plugin[];
}

async function loadPlugins(tag = 'form-builder'): Promise<void> {
  const tbody = document.getElementById('plugins-body');
  const metaEl = document.getElementById('results-meta');

  if (!(tbody instanceof HTMLTableSectionElement)) {
    throw new Error('Plugin table body was not found.');
  }

  if (metaEl) metaEl.textContent = '';
  tbody.replaceChildren(createLoadingRow());

  const endpoint = new URL('https://api.wordpress.org/plugins/info/1.2/');
  endpoint.searchParams.set('action', 'query_plugins');
  endpoint.searchParams.set('request[tag]', tag);
  endpoint.searchParams.set('request[per_page]', '100');
  endpoint.searchParams.set('request[page]', '1');

  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error(`Plugin request failed with status ${response.status}.`);
    }

    const data = await response.json() as PluginResponse;
    const plugins = data.plugins ?? [];

    const rows = plugins.map((plugin) => {
      const millisecondsPerDay = 1000 * 60 * 60 * 24;
      const daysSinceAdded = Math.max(
        1,
        Math.floor((Date.now() - new Date(plugin.added).getTime()) / millisecondsPerDay),
      );
      const installsPerDay = (plugin.active_installs / daysSinceAdded).toFixed(1);
      const ratingOutOf5 = plugin.rating / 20;
      const stars = `${ratingOutOf5.toFixed(1)} ★`;

      return createPluginRow({
        name: decodeHtmlEntities(plugin.name),
        installsPerDay,
        activeInstalls: plugin.active_installs,
        stars,
        ratingPercent: plugin.rating, // plugin.rating is 0–100
        numberOfRatings: plugin.num_ratings,
        supportThreads: plugin.support_threads ?? 0,
      });
    });

    tbody.replaceChildren(...rows);

    if (metaEl) {
      metaEl.textContent = plugins.length > 0
        ? `Showing ${plugins.length} plugin${plugins.length === 1 ? '' : 's'} tagged "${tag}"`
        : `No plugins found for tag "${tag}"`;
    }
  } catch (error) {
    console.error(error);
    tbody.replaceChildren(createErrorRow());
    if (metaEl) metaEl.textContent = '';
  }
}

function setActiveChip(activeTag: string | null): void {
  document.querySelectorAll<HTMLButtonElement>('#tag-chips .chip').forEach((chip) => {
    const isActive = chip.dataset.tag === activeTag;
    chip.classList.toggle('chip--active', isActive);
  });
}

function initControls(): void {
  const tagInput = document.getElementById('tag-input') as HTMLInputElement | null;
  const tagSubmit = document.getElementById('tag-submit') as HTMLButtonElement | null;

  // Chip buttons
  document.getElementById('tag-chips')?.addEventListener('click', (e) => {
    const chip = (e.target as Element).closest<HTMLButtonElement>('.chip');
    if (!chip?.dataset.tag) return;

    const tag = chip.dataset.tag;
    setActiveChip(tag);
    if (tagInput) tagInput.value = '';
    void loadPlugins(tag);
  });

  // Custom tag submit via button
  tagSubmit?.addEventListener('click', () => {
    const tag = tagInput?.value.trim();
    if (!tag) return;
    setActiveChip(null);
    void loadPlugins(tag);
  });

  // Custom tag submit via Enter key
  tagInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const tag = tagInput.value.trim();
    if (!tag) return;
    setActiveChip(null);
    void loadPlugins(tag);
  });
}

function initIcons(): void {
  // createIcons scans the DOM for data-lucide="<name>" elements and replaces them with SVGs.
  createIcons({
    icons: { Activity, Search },
    attrs: { 'stroke-width': 1.75 },
  });
}

initIcons();
initControls();
void loadPlugins();
