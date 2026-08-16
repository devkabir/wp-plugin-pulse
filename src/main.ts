import './style.css';
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

  if (!(tbody instanceof HTMLTableSectionElement)) {
    throw new Error('Plugin table body was not found.');
  }

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

    const rows = (data.plugins ?? []).map((plugin) => {
      const millisecondsPerDay = 1000 * 60 * 60 * 24;
      const daysSinceAdded = Math.max(
        1,
        Math.floor((Date.now() - new Date(plugin.added).getTime()) / millisecondsPerDay),
      );
      const installsPerDay = (plugin.active_installs / daysSinceAdded).toFixed(1);
      const stars = `${(plugin.rating / 20).toFixed(1)} ★`;

      return createPluginRow({
        name: decodeHtmlEntities(plugin.name),
        installsPerDay,
        activeInstalls: plugin.active_installs,
        stars,
        numberOfRatings: plugin.num_ratings,
        supportThreads: plugin.support_threads ?? 0,
      });
    });

    tbody.replaceChildren(...rows);
  } catch (error) {
    console.error(error);
    tbody.replaceChildren(createErrorRow());
  }
}

void loadPlugins();
