import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * ─── Theme ───────────────────────────────────────────────────────────
 *
 * THREE STATES, NOT TWO. "System" is a real choice and the default one: it means "follow the OS",
 * and it keeps following it when the OS changes at sunset. Collapsing it into a light/dark boolean
 * on first load would silently freeze whatever the OS happened to be saying at that moment.
 *
 * The provider owns one side effect: stamping `data-theme` on <html>, or removing it for system.
 * Everything visual follows from there, because the palette in index.css is defined against that
 * attribute — no component subscribes to this context to pick colours, and none needs to.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'scorelo.theme';

interface ThemeContextValue {
  /** What the customer chose. 'system' means "whatever the OS says, now and later". */
  preference: ThemePreference;
  /** What that currently resolves to — the value actually on screen. */
  theme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  /** Flips to the opposite of what is currently showing, leaving 'system' behind. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

/**
 * Reads the stored choice.
 *
 * Wrapped because storage throws outright in some contexts — a private window with site data
 * blocked, an embedded webview — and a theme preference is never worth a blank screen.
 */
function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Storage unavailable: fall through to the OS preference, which needs no permission.
  }
  return 'system';
}

/**
 * Applies the theme to the document.
 *
 * Exported and called once from index.html's inline bootstrap as well as from the provider, so the
 * attribute is set BEFORE React paints. Without that, a dark-mode customer sees a white flash on
 * every load — the page renders light, then corrects itself a frame later.
 */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved: ResolvedTheme = preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference;

  // 'system' removes the attribute rather than stamping the resolved value. That is what keeps the
  // OS in charge: index.css's prefers-color-scheme block only applies when nothing is stamped.
  if (preference === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', preference);

  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [theme, setTheme] = useState<ResolvedTheme>(() => applyTheme(readStoredPreference()));

  // Re-apply whenever the choice changes, and persist it. Persisting failures are swallowed for
  // the same reason reads are: the app must work with storage disabled, just without memory.
  useEffect(() => {
    setTheme(applyTheme(preference));
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // No persistence available — the choice still applies for this session.
    }
  }, [preference]);

  // While following the system, track it live. Someone whose OS switches at sunset should see the
  // app switch too, without a reload.
  useEffect(() => {
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(applyTheme('system'));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  // A theme chosen in one tab should not leave the others disagreeing with storage.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setPreferenceState(readStoredPreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), []);

  // Toggling from 'system' commits to the opposite of what is on screen — the customer is reaching
  // for the switch because they want the other one, not because they want to keep following the OS.
  const toggle = useCallback(() => {
    setPreferenceState((current) => {
      const showing = current === 'system' ? (prefersDark() ? 'dark' : 'light') : current;
      return showing === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}
