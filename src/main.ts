import './style.css';
import { createIcons, Activity, Search } from 'lucide';
import { fetchPlugins } from './api/plugins';
import { renderPluginTable } from './components/plugin-table';
import { appState, beginLoading, failLoading, finishLoading } from './state/app-state';

let activeRequest: AbortController | null = null;

async function loadPlugins(tag = 'form-builder'): Promise<void> {
  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  beginLoading(tag);
  renderPluginTable(appState);

  try {
    const collection = await fetchPlugins(tag, 1, request.signal);
    if (request !== activeRequest) return;
    finishLoading(collection);
    renderPluginTable(appState);
  } catch (error) {
    if (request.signal.aborted || request !== activeRequest) return;
    console.error(error);
    failLoading(error);
    renderPluginTable(appState);
  } finally {
    if (request === activeRequest) activeRequest = null;
  }
}

function setActiveChip(activeTag: string | null): void {
  document.querySelectorAll<HTMLButtonElement>('#tag-chips .chip').forEach((chip) => {
    chip.classList.toggle('chip--active', chip.dataset.tag === activeTag);
  });
}

function initControls(): void {
  const tagInput = document.getElementById('tag-input') as HTMLInputElement | null;
  const submitTag = (): void => {
    const tag = tagInput?.value.trim();
    if (!tag) return;
    setActiveChip(null);
    void loadPlugins(tag);
  };

  document.getElementById('tag-chips')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest<HTMLButtonElement>('.chip');
    if (!chip?.dataset.tag) return;
    setActiveChip(chip.dataset.tag);
    if (tagInput) tagInput.value = '';
    void loadPlugins(chip.dataset.tag);
  });
  document.getElementById('tag-submit')?.addEventListener('click', submitTag);
  tagInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitTag();
  });
}

createIcons({ icons: { Activity, Search }, attrs: { 'stroke-width': 1.75 } });
initControls();
void loadPlugins();
