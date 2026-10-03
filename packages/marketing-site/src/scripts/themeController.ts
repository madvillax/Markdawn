type Theme = 'light' | 'dark' | 'system';

const isTheme = (value: string | null): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

const readTheme = (): Theme => {
  const storedTheme = localStorage.getItem('metakip-theme');
  return isTheme(storedTheme) ? storedTheme : 'system';
};

export const initializeThemeController = (): void => {
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const boundToggles = new WeakSet<HTMLButtonElement>();
  let transitionTimeout: number | undefined;
  const applyTheme = (theme: Theme, persist: boolean, animate = false): void => {
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('theme-transitioning');
      if (transitionTimeout !== undefined) window.clearTimeout(transitionTimeout);
      transitionTimeout = window.setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
        transitionTimeout = undefined;
      }, 260);
    }

    const isDark = theme === 'dark' || (theme === 'system' && systemTheme.matches);
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark ? '#111111' : '#ffffff');
    document.querySelectorAll<HTMLLinkElement>('[data-theme-icon]').forEach((icon) => {
      const size = icon.dataset.themeIcon;
      if (size) icon.href = `/icon-${isDark ? 'dark' : 'light'}-${size}.png`;
    });
    document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((toggle) => {
      const nextTheme = isDark ? 'light' : 'dark';
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', `Switch to ${nextTheme} theme`);
      toggle.setAttribute('title', `Switch to ${nextTheme} theme`);
    });
    if (persist) localStorage.setItem('metakip-theme', theme);
    window.dispatchEvent(new CustomEvent('metakip-theme-change', { detail: isDark }));
  };
  const initialize = (): void => {
    const themeToggles = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
    if (themeToggles.length === 0) throw new Error('Theme toggle is required');
    themeToggles.forEach((themeToggle) => {
      if (!boundToggles.has(themeToggle)) {
        boundToggles.add(themeToggle);
        themeToggle.addEventListener('click', () => {
          const nextTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
          applyTheme(nextTheme, true, true);
        });
      }
    });
    applyTheme(readTheme(), false);
  };

  systemTheme.addEventListener('change', () => {
    if (readTheme() === 'system') applyTheme('system', false, true);
  });
  // Reapply before painting the new document to avoid a light-theme flash.
  document.addEventListener('astro:after-swap', () => applyTheme(readTheme(), false));
  document.addEventListener('astro:page-load', initialize);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
};
