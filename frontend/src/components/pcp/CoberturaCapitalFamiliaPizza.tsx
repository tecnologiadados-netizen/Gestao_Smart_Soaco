import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type FatiaCapitalFamilia = {
  familia: string;
  capital: number;
  itens: number;
  magnitude: number;
};

const PIE_PALETTE = [
  '#0d9488',
  '#6366f1',
  '#f59e0b',
  '#e11d48',
  '#059669',
  '#8b5cf6',
  '#0284c7',
  '#ea580c',
  '#64748b',
];

const PIE_LABEL_MIN_PCT = 0.06;

function truncarRotulo(texto: string, max = 22): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type Props = {
  fatias: FatiaCapitalFamilia[];
  formatCapital: (valor: number | null | undefined) => string;
  familiaAtiva?: string | null;
  onSelecionarFamilia?: (familia: string) => void;
};

export default function CoberturaCapitalFamiliaPizza({
  fatias,
  formatCapital,
  familiaAtiva,
  onSelecionarFamilia,
}: Props) {
  const pieData = fatias.map((f) => ({
    name: truncarRotulo(f.familia),
    fullName: f.familia,
    value: f.magnitude,
    capital: f.capital,
    itens: f.itens,
  }));

  if (pieData.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center py-10 text-center text-xs text-slate-500">
        Nenhum item com valor firme calculado neste recorte.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="w-full overflow-visible" style={{ height: 248 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 22, right: 22, bottom: 22, left: 22 }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={78}
              paddingAngle={1}
              labelLine={false}
              label={({ percent }) => {
                if ((percent ?? 0) < PIE_LABEL_MIN_PCT) return null;
                return `${((percent ?? 0) * 100).toFixed(0)}%`;
              }}
              cursor={onSelecionarFamilia ? 'pointer' : undefined}
              onClick={(entry) => {
                const full =
                  (entry as { payload?: { fullName?: string } })?.payload?.fullName ??
                  (entry as { fullName?: string }).fullName;
                if (full && onSelecionarFamilia) onSelecionarFamilia(full);
              }}
            >
              {pieData.map((d) => {
                const idx = fatias.findIndex((f) => f.familia === d.fullName);
                const cor = PIE_PALETTE[(idx >= 0 ? idx : 0) % PIE_PALETTE.length]!;
                const ativo = familiaAtiva === d.fullName;
                return (
                  <Cell
                    key={d.fullName}
                    fill={cor}
                    stroke={ativo ? '#0ea5e9' : cor}
                    strokeWidth={ativo ? 3 : 0}
                  />
                );
              })}
            </Pie>
            <Tooltip
              formatter={(_value, _name, item) => {
                const payload = item?.payload as
                  | { fullName?: string; capital?: number; itens?: number }
                  | undefined;
                const label = payload?.fullName ?? String(_name);
                const capital = payload?.capital ?? 0;
                const itens = payload?.itens ?? 0;
                return [`${formatCapital(capital)} · ${itens} itens`, label];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="max-h-28 space-y-1 overflow-y-auto pr-0.5 text-[11px] text-slate-600 dark:text-slate-300">
        {fatias.map((f, idx) => {
          const ativo = familiaAtiva === f.familia;
          const cor = PIE_PALETTE[idx % PIE_PALETTE.length]!;
          return (
            <li key={f.familia}>
              <button
                type="button"
                onClick={() => onSelecionarFamilia?.(f.familia)}
                className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition ${
                  ativo
                    ? 'bg-slate-200 ring-1 ring-sky-500 dark:bg-slate-800 dark:ring-sky-400'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cor }} />
                <span className="min-w-0 flex-1 truncate" title={f.familia}>
                  {f.familia}
                </span>
                <span className="shrink-0 tabular-nums font-medium">{formatCapital(f.capital)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const COBERTURA_PIE_MAX_FATIAS = 8;
/** Bucket sintético das fatias menores — nome distinto de famílias reais do Nomus (ex.: OUTROS). */
export const COBERTURA_PIE_BUCKET_DEMAIS = 'Demais famílias';

export function agruparCapitalPorFamiliaPie(
  itens: { familiaProduto: string; valorFirme: number | null }[],
  maxFatias = COBERTURA_PIE_MAX_FATIAS
): FatiaCapitalFamilia[] {
  const map = new Map<string, { capital: number; itens: number }>();
  for (const item of itens) {
    if (item.valorFirme == null || !Number.isFinite(item.valorFirme)) continue;
    // Produto com valor firme &lt; 0 não entra na soma da família (ex.: −10k + 4k + 1k → fatia R$ 5k).
    if (item.valorFirme < 0) continue;
    const familia = item.familiaProduto.trim() || 'Sem família';
    const atual = map.get(familia) ?? { capital: 0, itens: 0 };
    atual.capital += item.valorFirme;
    atual.itens += 1;
    map.set(familia, atual);
  }

  const ordenado = [...map.entries()]
    .map(([familia, { capital, itens: qtd }]) => ({
      familia,
      capital,
      itens: qtd,
      magnitude: capital,
    }))
    .filter((f) => f.capital > 0)
    .sort((a, b) => b.capital - a.capital);

  if (ordenado.length <= maxFatias) return ordenado;

  const top = ordenado.slice(0, maxFatias - 1);
  const resto = ordenado.slice(maxFatias - 1);
  const demais = resto.reduce(
    (acc, f) => ({
      capital: acc.capital + f.capital,
      itens: acc.itens + f.itens,
      magnitude: acc.magnitude + f.magnitude,
    }),
    { capital: 0, itens: 0, magnitude: 0 }
  );

  return [
    ...top,
    {
      familia: COBERTURA_PIE_BUCKET_DEMAIS,
      capital: demais.capital,
      itens: demais.itens,
      magnitude: demais.magnitude,
    },
  ];
}
