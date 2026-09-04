import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EQUIPE_LABEL,
  obterComissionamentoComparativo,
  type ComparativoVendedorItem,
  type FiltrosComissionamento,
} from '../../api/comissionamento';
import {
  formatMoeda,
  formatNumero,
  formatYmdBr,
  labelMesCurto,
  PAINEL_PALETTE,
} from '../painel-comercial/painelComercialUtils';

type Props = {
  aberto: boolean;
  onClose: () => void;
  filtros: FiltrosComissionamento;
  /** Vendedores disponíveis (ranking / opções do filtro). */
  opcoesVendedores: string[];
  /** Pré-seleção (ex.: filtro atual ou ranking marcado). */
  preselecionados?: string[];
};

export default function ModalComparativoVendedores({
  aberto,
  onClose,
  filtros,
  opcoesVendedores,
  preselecionados = [],
}: Props) {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [items, setItems] = useState<ComparativoVendedorItem[]>([]);
  const [meses, setMeses] = useState<string[]>([]);

  useEffect(() => {
    if (!aberto) return;
    const base =
      preselecionados.length > 0
        ? preselecionados
        : filtros.vendedor
          ? filtros.vendedor.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
    setSelecionados([...new Set(base)].slice(0, 8));
    setItems([]);
    setMeses([]);
    setErro(null);
    setBusca('');
  }, [aberto, preselecionados, filtros.vendedor]);

  const opcoesFiltradas = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    const list = opcoesVendedores.length > 0 ? opcoesVendedores : selecionados;
    if (!q) return list;
    return list.filter((v) => v.toLocaleLowerCase('pt-BR').includes(q));
  }, [opcoesVendedores, selecionados, busca]);

  const toggle = (nome: string) => {
    setSelecionados((prev) => {
      if (prev.includes(nome)) return prev.filter((x) => x !== nome);
      if (prev.length >= 8) return prev;
      return [...prev, nome];
    });
  };

  const comparar = useCallback(async () => {
    if (selecionados.length < 2) {
      setErro('Selecione ao menos 2 vendedores.');
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data = await obterComissionamentoComparativo(filtros, selecionados);
      setItems(data.items ?? []);
      setMeses(data.meses ?? []);
      if (data.erro) setErro(data.erro);
    } catch (e) {
      setItems([]);
      setErro(e instanceof Error ? e.message : 'Erro ao comparar.');
    } finally {
      setLoading(false);
    }
  }, [filtros, selecionados]);

  const maxSerie = useMemo(
    () => Math.max(1, ...items.flatMap((it) => it.serieMensal.map((s) => s.valor))),
    [items]
  );

  if (!aberto) return null;

  const W = 640;
  const H = 240;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 56;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Comparativo entre vendedores
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Selecione 2 a 8 vendedores da seleção atual · {formatYmdBr(filtros.dataIni)} —{' '}
              {formatYmdBr(filtros.dataFim)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,16rem)_1fr]">
          <div className="flex flex-col border-b border-slate-200 lg:border-b-0 lg:border-r dark:border-slate-600">
            <div className="border-b border-slate-100 p-3 dark:border-slate-700">
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar vendedor…"
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {selecionados.length}/8 selecionado(s)
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {opcoesFiltradas.map((nome) => {
                const checked = selecionados.includes(nome);
                return (
                  <label
                    key={nome}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => toggle(nome)}
                    />
                    <span className="min-w-0 break-words text-slate-800 dark:text-slate-100">{nome}</span>
                  </label>
                );
              })}
            </div>
            <div className="border-t border-slate-200 p-3 dark:border-slate-600">
              <button
                type="button"
                disabled={loading || selecionados.length < 2}
                onClick={() => void comparar()}
                className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'Comparando…' : 'Comparar'}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {erro ? (
              <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                {erro}
              </div>
            ) : null}

            {items.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Marque os vendedores e clique em Comparar para ver KPIs e evolução lado a lado.
              </p>
            ) : null}

            {items.length > 0 ? (
              <>
                <div className="mb-4 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Vendedor</th>
                        <th className="px-2 py-1.5 text-left">Equipe</th>
                        <th className="px-2 py-1.5 text-right">Venda</th>
                        <th className="px-2 py-1.5 text-right">Pedidos</th>
                        <th className="px-2 py-1.5 text-right">Clientes</th>
                        <th className="px-2 py-1.5 text-right">Ticket méd.</th>
                        <th className="px-2 py-1.5 text-right">Custo</th>
                        <th className="px-2 py-1.5 text-right">Margem</th>
                        <th className="px-2 py-1.5 text-right">Margem %</th>
                        <th className="px-2 py-1.5 text-right">Qtde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {items.map((it, idx) => (
                        <tr key={it.vendedor}>
                          <td className="px-2 py-1.5">
                            <span
                              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: PAINEL_PALETTE.barras[idx % PAINEL_PALETTE.barras.length] }}
                            />
                            {it.vendedor}
                          </td>
                          <td className="px-2 py-1.5">{EQUIPE_LABEL[it.equipe] ?? it.equipe}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                            {formatMoeda(it.valor)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatNumero(it.pedidos)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatNumero(it.clientes)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatMoeda(it.ticketMedio)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {formatMoeda(it.custo ?? 0)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {formatMoeda(it.margem ?? 0)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {it.margemPct != null ? `${it.margemPct}%` : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatNumero(it.qtde)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Evolução mensal (valor)
                </h3>
                <div className="overflow-x-auto">
                  <svg viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full min-w-[480px]">
                    {meses.map((mes, i) => {
                      const x =
                        padL + (meses.length <= 1 ? innerW / 2 : (i / (meses.length - 1)) * innerW);
                      return (
                        <text
                          key={mes}
                          x={x}
                          y={H - 10}
                          textAnchor="end"
                          transform={`rotate(-35 ${x} ${H - 10})`}
                          className="fill-slate-500 text-[8px]"
                        >
                          {labelMesCurto(mes)}
                        </text>
                      );
                    })}
                    {items.map((it, idx) => {
                      const color = PAINEL_PALETTE.barras[idx % PAINEL_PALETTE.barras.length]!;
                      const pts = it.serieMensal.map((s, i) => {
                        const x =
                          padL +
                          (meses.length <= 1 ? innerW / 2 : (i / (meses.length - 1)) * innerW);
                        const y = padT + innerH - (s.valor / maxSerie) * innerH;
                        return `${x},${y}`;
                      });
                      return (
                        <g key={it.vendedor}>
                          <polyline
                            fill="none"
                            stroke={color}
                            strokeWidth={2}
                            points={pts.join(' ')}
                          />
                          {it.serieMensal.map((s, i) => {
                            const x =
                              padL +
                              (meses.length <= 1 ? innerW / 2 : (i / (meses.length - 1)) * innerW);
                            const y = padT + innerH - (s.valor / maxSerie) * innerH;
                            return (
                              <circle key={`${it.vendedor}-${s.mes}`} cx={x} cy={y} r={2.5} fill={color}>
                                <title>{`${it.vendedor}\n${labelMesCurto(s.mes)}\n${formatMoeda(s.valor)}`}</title>
                              </circle>
                            );
                          })}
                        </g>
                      );
                    })}
                    <text x={padL - 4} y={padT + 4} textAnchor="end" className="fill-slate-500 text-[9px]">
                      {formatMoeda(maxSerie, true)}
                    </text>
                    <text x={padL - 4} y={padT + innerH} textAnchor="end" className="fill-slate-500 text-[9px]">
                      0
                    </text>
                  </svg>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
