import { useMemo, useState } from 'react';
import type { CarteiraFinanceiraLinha } from '../../../api/financeiro';
import { criarMatcherTextoLivre } from '../../../utils/textoLivreBusca';
import { useColumnResize } from '../crm/hooks/useColumnResize';
import { formatarReais } from '../dashboard/dashboardFormat';
import { parseContasAtraso, parseStatusContasAtraso } from './carteiraContasAtraso';

const PAGE_SIZE = 50;

type SortKey = keyof CarteiraFinanceiraLinha;

const COLS: {
  key: SortKey;
  label: string;
  money?: boolean;
  date?: boolean;
  /** Permite quebra de linha na célula (útil em observação). */
  wrap?: boolean;
  defaultWidth: number;
}[] = [
  { key: 'PD', label: 'PD', defaultWidth: 88 },
  { key: 'Emissao', label: 'Emissão', date: true, defaultWidth: 92 },
  { key: 'previsaoAtual', label: 'Previsão Atual', date: true, defaultWidth: 100 },
  { key: 'Cliente', label: 'Cliente', defaultWidth: 160 },
  { key: 'UF', label: 'UF', defaultWidth: 44 },
  { key: 'Municipio de entrega', label: 'Município', defaultWidth: 110 },
  {
    key: 'ObservacaoPedido',
    label: 'Observação do pedido',
    wrap: true,
    defaultWidth: 280,
  },
  { key: 'Observacoes', label: 'Carrada/Rota', defaultWidth: 150 },
  {
    key: 'Condicao de pagamento do pedido de venda',
    label: 'Cond. Pagamento',
    defaultWidth: 120,
  },
  { key: 'StatusPedido', label: 'Status de entrega', defaultWidth: 100 },
  { key: 'Valor Romaneado', label: 'Saldo Romaneado', money: true, defaultWidth: 110 },
  {
    key: 'Saldo a Faturar Real',
    label: 'Saldo a Faturar Real',
    money: true,
    defaultWidth: 120,
  },
  { key: 'Saldo a Receber', label: 'Saldo a Receber', money: true, defaultWidth: 110 },
  { key: 'Venda por qual empresa?', label: 'Empresa', defaultWidth: 100 },
  { key: 'tipoF', label: 'Tipo', defaultWidth: 80 },
  { key: 'RM', label: 'RM', defaultWidth: 80 },
  { key: 'Data de entrega', label: 'Data entrega', date: true, defaultWidth: 92 },
  { key: 'Vendedor/Representante', label: 'Vendedor', defaultWidth: 120 },
  { key: 'Conta', label: 'Conta', defaultWidth: 100 },
  { key: 'Status conta', label: 'Status conta', defaultWidth: 110 },
];

const COL_IDS = COLS.map((c) => c.key) as SortKey[];

const DEFAULT_WIDTHS = Object.fromEntries(
  COLS.map((c) => [c.key, c.defaultWidth]),
) as Record<SortKey, number>;

type Props = { linhas: CarteiraFinanceiraLinha[] };

function fmtDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function CarteiraTabela({ linhas }: Props) {
  const [busca, setBusca] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('Saldo a Receber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const { tableRef, startResize } = useColumnResize(COL_IDS, DEFAULT_WIDTHS, {
    minWidthPx: 48,
    storageKey: 'carteira-financeira-detalhe-col-widths-v1',
  });

  const filtradas = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    if (!busca.trim()) return linhas;
    return linhas.filter((l) => COLS.some((c) => match(String(l[c.key] ?? ''))));
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
    let romaneado = 0;
    let faturarReal = 0;
    for (const l of filtradas) {
      receber += l['Saldo a Receber'] || 0;
      romaneado += l['Valor Romaneado'] || 0;
      faturarReal += l['Saldo a Faturar Real'] || 0;
    }
    return { receber, romaneado, faturarReal };
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
    <div className="card-panel p-4" data-pdf-block data-pdf-table>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
          className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 sm:w-72"
        />
      </div>
      <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
        Arraste a borda direita do cabeçalho para ajustar a largura das colunas.
      </p>
      <div className="overflow-x-auto">
        <table
          ref={tableRef}
          className="table-crm text-xs"
          style={{ tableLayout: 'fixed', width: 'max-content' }}
        >
          <colgroup>
            {COLS.map((c) => (
              <col key={c.key} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-600">
              {COLS.map((c, idx) => (
                <th
                  key={c.key}
                  className={`relative py-2 px-2 ${c.money ? 'text-right' : ''}`}
                >
                  <button
                    type="button"
                    className={`w-full cursor-pointer whitespace-nowrap text-left hover:text-slate-800 dark:hover:text-slate-200 ${
                      c.money ? 'text-right' : ''
                    }`}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    {sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                  {idx < COLS.length - 1 ? (
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar coluna ${c.label}`}
                      className="col-resize-handle"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        startResize(c.key, event.clientX);
                      }}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((l, i) => (
              <tr
                key={`${l.id}-${l.RM ?? ''}-${i}`}
                className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/40"
              >
                {COLS.map((c) => {
                  const v = l[c.key];
                  if (c.key === 'StatusPedido') {
                    const atrasado = v === 'Atrasado';
                    return (
                      <td key={c.key} className="px-2 py-1.5">
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
                  if (c.key === 'Status conta') {
                    const itens = parseStatusContasAtraso(v as string | null);
                    if (itens.length === 0) {
                      return (
                        <td key={c.key} className="px-2 py-1.5 text-slate-400">
                          —
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className="px-2 py-1.5">
                        <ul className="space-y-1">
                          {itens.map((item, idx) => (
                            <li
                              key={`${item.status}-${item.vencimento ?? ''}-${idx}`}
                              className="space-y-0.5"
                            >
                              <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                {item.status}
                              </span>
                              {item.vencimento ? (
                                <div className="whitespace-nowrap text-[10px] tabular-nums text-slate-600 dark:text-slate-300">
                                  {fmtDate(item.vencimento)}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </td>
                    );
                  }
                  if (c.key === 'Conta') {
                    const contas = parseContasAtraso(v as string | null);
                    if (contas.length === 0) {
                      return (
                        <td key={c.key} className="px-2 py-1.5 text-slate-400">
                          —
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className="px-2 py-1.5">
                        <ul
                          className="space-y-1"
                          title={contas
                            .map((ct) =>
                              ct.valor != null
                                ? `${ct.codigo} · ${formatarReais(ct.valor)}`
                                : ct.codigo,
                            )
                            .join(', ')}
                        >
                          {contas.map((ct) => (
                            <li key={ct.codigo} className="leading-tight">
                              <div className="whitespace-nowrap text-[11px] font-medium tabular-nums">
                                {ct.codigo}
                              </div>
                              {ct.valor != null ? (
                                <div className="whitespace-nowrap text-[10px] tabular-nums text-slate-600 dark:text-slate-300">
                                  {formatarReais(ct.valor)}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </td>
                    );
                  }
                  if (c.money) {
                    return (
                      <td
                        key={c.key}
                        className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums"
                      >
                        {formatarReais(Number(v) || 0)}
                      </td>
                    );
                  }
                  if (c.date) {
                    return (
                      <td key={c.key} className="whitespace-nowrap px-2 py-1.5">
                        {fmtDate(v as string | null)}
                      </td>
                    );
                  }
                  const texto = String(v ?? '—');
                  return (
                    <td
                      key={c.key}
                      className={`px-2 py-1.5 ${
                        c.wrap
                          ? 'break-words whitespace-normal align-top'
                          : 'truncate whitespace-nowrap'
                      }`}
                      title={texto}
                    >
                      {texto}
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
            <tr className="border-t-2 border-slate-300 font-semibold dark:border-slate-500">
              {COLS.map((c) => {
                if (c.key === 'Saldo a Receber') {
                  return (
                    <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                      {formatarReais(totais.receber)}
                    </td>
                  );
                }
                if (c.key === 'Saldo a Faturar Real') {
                  return (
                    <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                      {formatarReais(totais.faturarReal)}
                    </td>
                  );
                }
                if (c.key === 'Valor Romaneado') {
                  return (
                    <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                      {formatarReais(totais.romaneado)}
                    </td>
                  );
                }
                if (c.key === 'PD') {
                  return (
                    <td key={c.key} className="px-2 py-2">
                      Total
                    </td>
                  );
                }
                return <td key={c.key} className="px-2 py-2" />;
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          Página {pageSafe + 1} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary px-3 py-1 text-xs"
            disabled={pageSafe <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-1 text-xs"
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
