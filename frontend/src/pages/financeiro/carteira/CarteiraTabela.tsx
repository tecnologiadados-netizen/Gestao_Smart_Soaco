import { useMemo, useState } from 'react';
import type { CarteiraFinanceiraLinha } from '../../../api/financeiro';
import { criarMatcherTextoLivre } from '../../../utils/textoLivreBusca';
import { formatarReais } from '../dashboard/dashboardFormat';

const PAGE_SIZE = 50;

type SortKey = keyof CarteiraFinanceiraLinha;

const COLS: { key: SortKey; label: string; money?: boolean; date?: boolean }[] = [
  { key: 'PD', label: 'PD' },
  { key: 'Emissao', label: 'Emissão', date: true },
  { key: 'Cliente', label: 'Cliente' },
  { key: 'UF', label: 'UF' },
  { key: 'Municipio de entrega', label: 'Município' },
  { key: 'Observacoes', label: 'Carrada/Rota' },
  { key: 'Condicao de pagamento do pedido de venda', label: 'Cond. Pagamento' },
  { key: 'StatusPedido', label: 'Status' },
  { key: 'Valor Pendente', label: 'Saldo a Faturar', money: true },
  { key: 'Valor Romaneado', label: 'Saldo Romaneado', money: true },
  { key: 'Saldo a Faturar Real', label: 'Saldo a Receber', money: true },
  { key: 'Venda por qual empresa?', label: 'Empresa' },
  { key: 'tipoF', label: 'Tipo' },
  { key: 'RM', label: 'RM' },
  { key: 'Data de entrega', label: 'Data entrega', date: true },
  { key: 'Vendedor/Representante', label: 'Vendedor' },
];

type Props = { linhas: CarteiraFinanceiraLinha[] };

function fmtDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function CarteiraTabela({ linhas }: Props) {
  const [busca, setBusca] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('Saldo a Faturar Real');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const filtradas = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    if (!busca.trim()) return linhas;
    return linhas.filter((l) =>
      COLS.some((c) => match(String(l[c.key] ?? '')))
    );
  }, [linhas, busca]);

  const ordenadas = useMemo(() => {
    const arr = [...filtradas];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtradas, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(ordenadas.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const slice = ordenadas.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);

  const totais = useMemo(() => {
    let receber = 0;
    let faturar = 0;
    let romaneado = 0;
    for (const l of filtradas) {
      receber += l['Saldo a Faturar Real'] || 0;
      faturar += l['Valor Pendente'] || 0;
      romaneado += l['Valor Romaneado'] || 0;
    }
    return { receber, faturar, romaneado };
  }, [filtradas]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  }

  return (
    <div className="card-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Detalhamento ({filtradas.length.toLocaleString('pt-BR')} linhas)
        </h3>
        <input
          type="search"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPage(0);
          }}
          placeholder="Busca global (use % como curinga)"
          className="rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-sm px-3 py-1.5 w-full sm:w-72"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-600 text-left text-slate-500">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`py-2 px-2 whitespace-nowrap cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 ${c.money ? 'text-right' : ''}`}
                  onClick={() => toggleSort(c.key)}
                >
                  {c.label}
                  {sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((l, i) => (
              <tr
                key={`${l.id}-${l.RM ?? ''}-${i}`}
                className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                {COLS.map((c) => {
                  const v = l[c.key];
                  if (c.key === 'StatusPedido') {
                    const atrasado = v === 'Atrasado';
                    return (
                      <td key={c.key} className="py-1.5 px-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            atrasado
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                          }`}
                        >
                          {String(v ?? '—')}
                        </span>
                      </td>
                    );
                  }
                  if (c.money) {
                    return (
                      <td key={c.key} className="py-1.5 px-2 text-right whitespace-nowrap tabular-nums">
                        {formatarReais(Number(v) || 0)}
                      </td>
                    );
                  }
                  if (c.date) {
                    return (
                      <td key={c.key} className="py-1.5 px-2 whitespace-nowrap">
                        {fmtDate(v as string | null)}
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} className="py-1.5 px-2 max-w-[180px] truncate" title={String(v ?? '')}>
                      {String(v ?? '—')}
                    </td>
                  );
                })}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="py-8 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-500 font-semibold">
              {COLS.map((c) => {
                if (c.key === 'Saldo a Faturar Real') {
                  return (
                    <td key={c.key} className="py-2 px-2 text-right tabular-nums">
                      {formatarReais(totais.receber)}
                    </td>
                  );
                }
                if (c.key === 'Valor Pendente') {
                  return (
                    <td key={c.key} className="py-2 px-2 text-right tabular-nums">
                      {formatarReais(totais.faturar)}
                    </td>
                  );
                }
                if (c.key === 'Valor Romaneado') {
                  return (
                    <td key={c.key} className="py-2 px-2 text-right tabular-nums">
                      {formatarReais(totais.romaneado)}
                    </td>
                  );
                }
                if (c.key === 'PD') {
                  return (
                    <td key={c.key} className="py-2 px-2">
                      Total
                    </td>
                  );
                }
                return <td key={c.key} className="py-2 px-2" />;
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
        <span>
          Página {pageSafe + 1} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary text-xs px-3 py-1"
            disabled={pageSafe <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn-secondary text-xs px-3 py-1"
            disabled={pageSafe >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
