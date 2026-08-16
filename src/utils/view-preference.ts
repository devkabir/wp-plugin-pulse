import type { ActiveView } from '../domain/plugin-types';

export const STORAGE_KEY_VIEW = 'wp_plugin_pulse_view';

/**
 * Retrieves the stored view preference from localStorage.
 * Falls back to 'table' if absent or invalid.
 */
export function getStoredView(): ActiveView {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_VIEW);
    if (stored === 'table' || stored === 'cards') {
      return stored;
    }
  } catch {
    // Ignore storage exceptions (e.g. security sandbox)
  }
  return 'table';
}

/**
 * Persists the user's preferred view to localStorage.
 */
export function setStoredView(view: ActiveView): void {
  try {
    localStorage.setItem(STORAGE_KEY_VIEW, view);
  } catch {
    // Ignore storage exceptions
  }
}
