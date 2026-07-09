import { formatMoeda, formatPct, classVar } from './painelComercialUtils';

type Row = {
  codigoProduto: string;
  descricaoProduto: string;
  grupoProduto: string;
  valor: number;
  valorBase: number;
  valorVarPct: number | null;
};

function Tabela({
  title,
  rows,
  onRowClick,
}: {
  title: string;
  rows: Row[];
  onRowClick: (row: Row) => void;
}) {
  return (
    <div className="card-panel flex min-h-[320px] flex-col p-5">
      <div className="mb-3 shrink-0">
        <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Variação por produto (valor).</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-slate-900/80">
            <tr className="text-[11px] text-slate-500">
              <th className="py-2 pr-2 font-semibold">Produto</th>
              <th className="py-2 pr-2 font-semibold">Grupo</th>
              <th className="py-2 pr-2 font-semibold text-right">Valor</th>
              <th className="py-2 pr-2 font-semibold text-right">Δ%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.codigoProduto} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => onRowClick(r)}
                    className="text-left text-xs font-medium text-slate-700 hover:text-primary-600 dark:text-slate-200 dark:hover:text-primary-400"
                    title={`${r.codigoProduto} — ${r.descricaoProduto}`}
                  >
                    <span className="block truncate">{r.codigoProduto}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{r.descricaoProduto}</span>
                  </button>
                </td>
                <td className="py-2 pr-2">
                  <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{r.grupoProduto}</span>
                </td>
                <td className="py-2 pr-2 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                  {formatMoeda(r.valor, true)}
                </td>
                <td className={`py-2 pr-2 text-right tabular-nums font-semibold ${classVar(r.valorVarPct)}`}>
                  {formatPct(r.valorVarPct)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  Sem dados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PainelComercialGanhadoresPerdedores({
  ganhadores,
  perdedores,
  loading,
  onProdutoClick,
}: {
  ganhadores: Row[];
  perdedores: Row[];
  loading?: boolean;
  onProdutoClick: (codigoProduto: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 xl:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="card-panel min-h-[320px] animate-pulse p-5">
            <div className="mb-4 h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-[260px] rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Tabela title="Ganhadores (alta)" rows={ganhadores} onRowClick={(r) => onProdutoClick(r.codigoProduto)} />
      <Tabela title="Perdedores (queda)" rows={perdedores} onRowClick={(r) => onProdutoClick(r.codigoProduto)} />
    </div>
  );
}

