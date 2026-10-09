import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchUltimasVendasClientePainel,
  formatEmissaoPainelBr,
  type UltimaVendaCliente,
} from '../../api/painelComercial';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pctFmt = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function empresaLabel(v: UltimaVendaCliente): string {
  if (v.vendaPorEmpresa.trim()) return v.vendaPorEmpresa;
  if (v.empresaId === 1) return 'Só Aço';
  if (v.empresaId === 2) return 'Só Móveis';
  return '—';
}

export type PainelComercialUltimasVendasModalProps = {
  clienteId: number;
  cliente: string;
  pdAtual: string;
  onClose: () => void;
};

export default function PainelComercialUltimasVendasModal({
  clienteId,
  cliente,
  pdAtual,
  onClose,
}: PainelComercialUltimasVendasModalProps) {
  const [vendas, setVendas] = useState<UltimaVendaCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const loadId = useRef(0);

  useEffect(() => {
    const ac = new AbortController();
    const id = ++loadId.current;
    setLoading(true);
    setErro(null);
    fetchUltimasVendasClientePainel({
      clienteId: clienteId > 0 ? clienteId : undefined,
      cliente,
      limit: 15,
      signal: ac.signal,
    })
      .then((res) => {
        if (loadId.current !== id) return;
        setVendas(res.vendas);
        setErro(res.erro ?? null);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted || loadId.current !== id) return;
        setErro(e instanceof Error ? e.message : 'Erro ao carregar as vendas.');
        setVendas([]);
      })
      .finally(() => {
        if (loadId.current === id) setLoading(false);
      });
    return () => ac.abort();
  }, [clienteId, cliente]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-[min(96rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-ultimas-vendas-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-primary-600 px-5 py-4 text-white dark:border-slate-600">
          <div className="min-w-0">
            <h2 id="painel-ultimas-vendas-titulo" className="truncate text-lg font-bold tracking-tight">
              Últimas vendas
            </h2>
            <p className="mt-0.5 truncate text-sm text-white/90" title={cliente}>
              {cliente}
            </p>
            <p className="mt-1 text-xs text-white/80">
              Até 15 pedidos mais recentes, fora do período do painel. A linha do pedido atual fica destacada.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-white/90 hover:bg-white/15"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="px-5 py-8 text-sm text-slate-500">Carregando vendas…</p>
          ) : erro ? (
            <p className="px-5 py-8 text-sm text-rose-700 dark:text-rose-300">{erro}</p>
          ) : vendas.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">Nenhuma venda encontrada para este cliente.</p>
          ) : (
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 font-semibold">Emissão</th>
                  <th className="px-3 py-2 font-semibold">PD</th>
                  <th className="px-3 py-2 font-semibold">Empresa</th>
                  <th className="px-3 py-2 font-semibold">Vendedor</th>
                  <th className="px-3 py-2 font-semibold">Forma</th>
                  <th className="px-3 py-2 font-semibold">Condição</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor total</th>
                  <th className="px-3 py-2 text-right font-semibold">Desconto</th>
                  <th className="px-3 py-2 text-right font-semibold">Total c/ desconto</th>
                  <th className="px-3 py-2 text-right font-semibold">Entrada</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => {
                  const atual = v.pd === pdAtual;
                  return (
                    <tr
                      key={`${v.pdId}-${v.pd}`}
                      className={`border-t border-slate-200 align-top dark:border-slate-700 ${
                        atual ? 'bg-primary-50 dark:bg-primary-950/40' : 'odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-900/20 dark:even:bg-slate-800/30'
                      }`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatEmissaoPainelBr(v.emissao)}</td>
                      <td className="px-3 py-2 font-semibold text-primary-700 dark:text-primary-300">
                        {v.pd}
                        {atual ? (
                          <span className="ml-1.5 text-[10px] font-semibold uppercase text-primary-600 dark:text-primary-300">
                            atual
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{empresaLabel(v)}</td>
                      <td className="max-w-[180px] px-3 py-2" title={v.vendedorRepresentante}>
                        {v.vendedorRepresentante || '—'}
                      </td>
                      <td className="max-w-[140px] px-3 py-2" title={v.formaPagamento}>
                        {v.formaPagamento || '—'}
                      </td>
                      <td className="max-w-[180px] px-3 py-2" title={v.condicaoPagamento}>
                        {v.condicaoPagamento || '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl.format(v.valorTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl.format(v.valorDesconto)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{brl.format(v.totalPedido)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {v.somaEntrada > 0 ? (
                          <>
                            <span className="font-medium">{brl.format(v.somaEntrada)}</span>
                            <span className="block text-[11px] text-slate-500">{pctFmt(v.pctEntrada * 100)}</span>
                            {v.entradas.length > 0 ? (
                              <ul className="mt-1 space-y-0.5 text-[11px] font-normal text-slate-600 dark:text-slate-300">
                                {v.entradas.map((e, i) => (
                                  <li key={`${v.pdId}-e-${i}`}>
                                    {e.vencimento ? formatEmissaoPainelBr(e.vencimento) : 'Sem vencimento'} · {brl.format(e.valor)}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-slate-400">Sem entrada</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
