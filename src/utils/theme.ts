export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'wp_plugin_pulse_theme';

export function getStoredTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch {
    // Local storage might be blocked/inaccessible
  }
  return null;
}

export function setStoredTheme(theme: Theme | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (theme) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function getEffectiveTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  return getSystemTheme();
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;

  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  if (metaColorScheme) {
    metaColorScheme.setAttribute('content', theme);
  }

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const label = `Switch to ${nextTheme} theme`;
    toggleBtn.setAttribute('aria-label', label);
    toggleBtn.setAttribute('title', label);
  }
}

export function toggleTheme(): Theme {
  const current = getEffectiveTheme();
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  setStoredTheme(next);
  applyTheme(next);
  return next;
}

export function initTheme(): void {
  const initialTheme = getEffectiveTheme();
  applyTheme(initialTheme);

  const toggleBtn = document.getElementById('theme-toggle');
  toggleBtn?.addEventListener('click', () => {
    toggleTheme();
  });

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (event) => {
      // Only react to OS changes if user hasn't explicitly set a preference
      if (!getStoredTheme()) {
        const newSystemTheme: Theme = event.matches ? 'dark' : 'light';
        applyTheme(newSystemTheme);
      }
    });
  }
}
