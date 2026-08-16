import './style.css';

async function loadPlugins(tag = 'form-builder') {
  const endpoint = new URL('https://api.wordpress.org/plugins/info/1.2/');
  endpoint.searchParams.set('action', 'query_plugins');
  endpoint.searchParams.set('request[tag]', tag);
  endpoint.searchParams.set('request[per_page]', '100');
  endpoint.searchParams.set('request[page]', '1');

  const response = await fetch(endpoint);
  const data = await response.json();
  const tbody = document.getElementById('plugins-body');

  tbody.innerHTML = data.plugins.map((plugin) => {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const daysSinceAdded = Math.max(
      1,
      Math.floor((new Date() - new Date(plugin.added)) / millisecondsPerDay),
    );
    const installsPerDay = (plugin.active_installs / daysSinceAdded).toFixed(1);
    const stars = `${(plugin.rating / 20).toFixed(1)} ★`;

    return `
      <tr>
        <td><strong>${plugin.name}</strong></td>
        <td>~${installsPerDay} / day (${plugin.active_installs.toLocaleString()} total)</td>
        <td>${stars} (${plugin.num_ratings})</td>
        <td>${plugin.support_threads || 0} open</td>
      </tr>
    `;
  }).join('');
}

loadPlugins();
