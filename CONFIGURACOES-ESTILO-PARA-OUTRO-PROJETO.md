# Configurações de estilo do Gestão Smart 2.0 — para colar em outro projeto

Use este guia no **Cursor** (ou em outro projeto) para replicar o mesmo visual: fontes, cores, dark mode, gráficos e padrões de layout.

---

## 1. Dependências (package.json)

```json
{
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14"
  }
}
```

*(Se o projeto já usa Vite + React, mantenha as deps existentes e adicione estas.)*

---

## 2. Fonte — Google Fonts (index.html)

No `<head>` do seu `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

---

## 3. Tailwind (tailwind.config.js)

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 1.5s linear infinite',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['15px', { lineHeight: '1.5' }],
      },
      colors: {
        primary: { 600: '#2563eb', 700: '#1d4ed8' },
        slate: { 850: '#172033' },
      },
    },
  },
  plugins: [],
};
```

- **Dark mode:** ativado por classe (`class` no `html`/`documentElement`).
- **Fonte:** Poppins como `font-sans`.
- **Tamanho base:** 15px, line-height 1.5.
- **Cores:** `primary-600` / `primary-700` (azul); `slate-850` para fundos escuros.

---

## 4. PostCSS (postcss.config.js)

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## 5. CSS global (src/index.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  font-size: 15px;
  width: 100%;
}

body {
  @apply bg-slate-100 text-slate-800 font-sans antialiased dark:bg-slate-900 dark:text-slate-100;
  width: 100%;
  margin: 0;
}

#root {
  width: 100%;
  min-height: 100vh;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes melhorPrecoIn {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}
.animate-melhor-preco-in {
  animation: melhorPrecoIn 0.35s ease-out forwards;
}
```

*(Remova ou adapte keyframes que não for usar.)*

---

## 6. Dark mode — ThemeContext (React)

Crie `src/contexts/ThemeContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'app_theme'; // troque pelo nome do seu app

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
```

No `main.tsx` (ou equivalente), envolva o app com `<ThemeProvider>`:

```tsx
import { ThemeProvider } from './contexts/ThemeContext';
// ...
<ThemeProvider>
  <App />
</ThemeProvider>
```

---

## 7. Padrões de UI (classes Tailwind)

Use estas classes para manter o mesmo “estilo Gestão Smart” no outro projeto.

### Botão primário
```html
<button class="rounded-lg bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-medium text-white">
  Ação principal
</button>
```

### Botão secundário
```html
<button class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600">
  Cancelar
</button>
```

### Card / painel
```html
<div class="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4 shadow-sm">
  Conteúdo
</div>
```

### Card de gráfico (com borda e fundo suave)
```html
<div class="bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl p-5">
  <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Título</h3>
  <!-- gráfico ou conteúdo -->
</div>
```

### Input
```html
<input
  type="text"
  class="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-primary-600 focus:border-transparent"
  placeholder="Placeholder"
/>
```

### Tabela
- Container: `rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden`
- Cabeçalho: `p-3 text-slate-500 dark:text-slate-400 font-medium`
- Células: `p-3 text-slate-700 dark:text-slate-200`
- Linhas: `border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30`

### Barras de gráfico (cor primária)
```html
<div class="h-4 rounded bg-primary-600" style="width: 60%;" />
```

### Loading (spinner)
```html
<div class="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
```

### Toast / alerta sucesso
```html
<div class="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-4 py-2 text-sm">
  Sucesso.
</div>
```

### Toast / alerta erro
```html
<div class="rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-2 text-sm">
  Erro.
</div>
```

### Aviso (amber)
```html
<div class="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
  Aviso.
</div>
```

---

## 8. Resumo de tokens

| Uso            | Valor |
|----------------|--------|
| Fonte          | Poppins (400, 500, 600, 700) |
| Tamanho base   | 15px |
| Cor primária   | `#2563eb` (600), `#1d4ed8` (700) |
| Fundo claro    | `bg-slate-100` |
| Fundo escuro   | `bg-slate-900` (dark) |
| Texto claro    | `text-slate-800` |
| Texto escuro   | `text-slate-100` (dark) |
| Bordas         | `rounded-lg` (botões/inputs), `rounded-xl` (cards) |
| Bordas de card | `border-slate-200 dark:border-slate-600` |

---

## 9. Checklist no novo projeto

1. Instalar Tailwind + PostCSS + Autoprefixer e criar `tailwind.config.js` e `postcss.config.js` como acima.
2. Colar o bloco de fontes no `index.html`.
3. Colar o conteúdo de `index.css` (e ajustar keyframes se quiser).
4. Se for React: criar `ThemeContext`, envolver o app com `ThemeProvider` e usar `darkMode: 'class'` no Tailwind.
5. Nos componentes, usar as classes dos “Padrões de UI” (botões, cards, inputs, tabelas, toasts).
6. Gráficos: usar as mesmas cores (`primary-600`, `slate-*`) e o mesmo estilo de card (`rounded-xl`, borda, fundo `slate-200/60` / `slate-800/60`).

Com isso, o outro projeto fica com a mesma “cara” de fontes, cores, dark mode e componentes que o Gestão Smart 2.0.
