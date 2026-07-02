# Design Tokens — Identidade Visual Só Aço

Referência: `Manual_da_Marca_SoAco (1).pdf` (Whoopee, Fev/2021)

## Paleta de cores

| Token Tailwind | Hex | Uso |
|----------------|-----|-----|
| `soaco-navy` | `#041E42` | Header, fundo dark, cabeçalhos de tabela |
| `soaco-blue` / `primary-600` | `#1E22AA` | Botões primários, links ativos, barras de gráfico |
| `soaco-gold` / `accent-500` | `#FFAD00` | Acentos, abas ativas, KPIs de alerta |
| `soaco-gray` | `#808080` | Texto secundário, bordas |
| `soaco-graphite` | `#2E2D2C` | Cards e superfícies no dark mode |
| `soaco-white` | `#FFFFFF` | Texto principal em fundos escuros |

Escala `primary` (50–900) derivada do azul da marca para compatibilidade com classes existentes (`bg-primary-600`, etc.).

## Tipografia

- **Fonte atual:** Barlow (Google Fonts) — substituto industrial da Monda Family até disponibilização dos arquivos oficiais.
- **Tamanho base:** 15px (`html { font-size: 15px }`).

## Variáveis CSS (`:root` / `.dark`)

Injetadas por `ThemeContext` e definidas em `frontend/src/index.css`:

- `--soaco-surface` — fundo da página
- `--soaco-surface-elevated` — cards e painéis
- `--soaco-text` / `--soaco-text-muted`
- `--soaco-border`
- `--soaco-primary` / `--soaco-accent`

## Classes utilitárias (`@layer components`)

| Classe | Descrição |
|--------|-----------|
| `.btn-primary` | Botão de ação principal |
| `.btn-secondary` | Botão secundário com borda |
| `.card-panel` | Painel/card padrão |
| `.card-kpi` | Card de indicador (valor + label) |
| `.card-kpi-alert` | KPI com borda esquerda gold |
| `.card-kpi-label` | Label pequena em uppercase |
| `.card-kpi-value` | Valor numérico grande |
| `.table-head-brand` | Cabeçalho de tabela navy + texto branco |
| `.input-app` | Campo de formulário padrão |
| `.badge-pill` | Etiqueta de status arredondada |
| `.row-total-brand` | Linha de total com borda gold |
| `.alert-success` / `.alert-error` / `.alert-warn` | Mensagens de feedback |

## Arquivos principais

- `frontend/tailwind.config.js` — tokens Tailwind
- `frontend/src/index.css` — variáveis CSS e componentes
- `frontend/src/contexts/ThemeContext.tsx` — troca light/dark
- `frontend/src/components/Layout.tsx` — shell (header navy + logo)
- `frontend/public/logo-soaco-login.png` — logo oficial

## Dark / Light

- **Dark (padrão):** superfície `#000000` (preto), cards `#2E2D2C`, texto branco. Header e overlays também em preto; navy (`#041E42`) reservado para cabeçalhos de tabela e destaques de marca.
- **Light:** superfície `#f4f5f8`, cards brancos, texto `#041E42`.

Toggle disponível no header do aplicativo.
