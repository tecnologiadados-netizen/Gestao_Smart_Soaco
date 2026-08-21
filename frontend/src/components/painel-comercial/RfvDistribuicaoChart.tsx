import type { RfvDistribuicaoItem } from '../../api/rfvClientes';
import { formatMoeda, formatNumero } from './painelComercialUtils';
import { isScoreSelecionado, type RfvSelecao } from './rfvSelecao';

const BAR_MAX_PX = 100;

function BarChart({
  titulo,
  dim,
  items,
  selecao,
  onSelectScore,
}: {
  titulo: string;
  dim: 'r' | 'f' | 'v';
  items: RfvDistribuicaoItem[];
  selecao: RfvSelecao;
  onSelectScore: (dim: 'r' | 'f' | 'v', score: number) => void;
}) {
  const maxValor = Math.max(...items.map((i) => i.valor), 1);
  const prefix = dim === 'r' ? 'R' : dim === 'f' ? 'F' : 'V';

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{titulo}</p>
      <div className="flex h-[140px] items-end justify-center gap-1.5 px-1">
        {items.map((item) => {
          const hPx =
            item.valor > 0 ? Math.max(10, Math.round((item.valor / maxValor) * BAR_MAX_PX)) : 4;
          const ativo = isScoreSelecionado(selecao, dim, item.score);
          const dimmed = selecao?.tipo === 'score' && !ativo;
          return (
            <button
              key={item.score}
              type="button"
              title={`${prefix}${item.score}: ${formatNumero(item.clientes)} clientes · ${formatMoeda(item.valor)}`}
              onClick={() => onSelectScore(dim, item.score)}
              aria-pressed={ativo}
              className={`group flex w-9 flex-col items-center justify-end transition ${dimmed ? 'opacity-40' : ''} ${ativo ? 'scale-[1.02]' : ''}`}
            >
              <span className="mb-0.5 text-center text-[9px] leading-tight text-slate-600 dark:text-slate-300">
                <span className="block font-semibold text-slate-700 dark:text-slate-200">{formatNumero(item.clientes)}</span>
                <span className="block opacity-80">{formatMoeda(item.valor, true)}</span>
              </span>
              <span
                className={`w-full rounded-t-md bg-emerald-500/85 transition group-hover:brightness-110 dark:bg-emerald-400/75 ${ativo ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                style={{ height: `${hPx}px` }}
              />
              <span className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">{prefix}{item.score}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function RfvDistribuicaoChart({
  distribuicao,
  selecao,
  loading,
  onSelectScore,
}: {
  distribuicao: { recencia: RfvDistribuicaoItem[]; frequencia: RfvDistribuicaoItem[]; valor: RfvDistribuicaoItem[] } | null;
  selecao: RfvSelecao;
  loading?: boolean;
  onSelectScore: (dim: 'r' | 'f' | 'v', score: number) => void;
}) {
  if (loading) {
    return (
      <div className="card-panel min-h-[180px] flex-1 animate-pulse p-4">
        <div className="h-full rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (!distribuicao) return null;

  return (
    <div className="card-panel flex min-h-[180px] flex-1 flex-col p-4">
      <div className="flex flex-1 flex-col md:flex-row md:gap-2">
        <BarChart titulo="Clientes por Recência" dim="r" items={distribuicao.recencia} selecao={selecao} onSelectScore={onSelectScore} />
        <BarChart titulo="Clientes por Frequência" dim="f" items={distribuicao.frequencia} selecao={selecao} onSelectScore={onSelectScore} />
        <BarChart titulo="Clientes por Valor" dim="v" items={distribuicao.valor} selecao={selecao} onSelectScore={onSelectScore} />
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-500 dark:text-slate-400">
        Quintis: quantidade de clientes tende a ser parecida em cada faixa; a altura da barra representa o faturamento do score.
      </p>
    </div>
  );
}
