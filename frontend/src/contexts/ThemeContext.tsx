import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'gestorpedidos_theme';

const SOACO_VARS_LIGHT: Record<string, string> = {
  '--soaco-surface': '#f4f5f8',
  '--soaco-surface-elevated': '#ffffff',
  '--soaco-text': '#041E42',
  '--soaco-text-muted': '#808080',
  '--soaco-border': 'rgb(128 128 128 / 0.3)',
  '--soaco-primary': '#1E22AA',
  '--soaco-accent': '#FFAD00',
};

const SOACO_VARS_DARK: Record<string, string> = {
  '--soaco-surface': '#000000',
  '--soaco-surface-elevated': '#2E2D2C',
  '--soaco-text': '#ffffff',
  '--soaco-text-muted': 'rgb(255 255 255 / 0.7)',
  '--soaco-border': 'rgb(128 128 128 / 0.35)',
  '--soaco-primary': '#1E22AA',
  '--soaco-accent': '#FFAD00',
};

function applySoacoCssVars(root: HTMLElement, theme: Theme) {
  const vars = theme === 'dark' ? SOACO_VARS_DARK : SOACO_VARS_LIGHT;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    applySoacoCssVars(root, theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
