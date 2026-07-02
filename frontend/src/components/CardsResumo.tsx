import { useState, useRef, useCallback, useEffect } from 'react';
import type { Resumo, Pedido } from '../api/pedidos';
import { listarPedidosPorDataEntrega } from '../api/pedidos';

interface CardsResumoProps {
  resumo: Resumo | null;
  loading?: boolean;
}

function getTodayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function CardsResumo({ resumo, loading }: CardsResumoProps) {
  const [tooltipEntregaHoje, setTooltipEntregaHoje] = useState(false);
  const [pedidosHoje, setPedidosHoje] = useState<Pedido[]>([]);
  const [loadingTooltip, setLoadingTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 });
  const cardEntregaHojeRef = useRef<HTMLDivElement>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tooltipEntregaHoje || !cardEntregaHojeRef.current) return;
    const rect = cardEntregaHojeRef.current.getBoundingClientRect();
    setTooltipPos({
      left: Math.min(rect.left, window.innerWidth - 320),
      top: rect.bottom + 8,
    });
  }, [tooltipEntregaHoje]);

  const clearTooltipTimeout = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  }, []);

  const scheduleHideTooltip = useCallback(() => {
    clearTooltipTimeout();
    tooltipTimeoutRef.current = setTimeout(() => setTooltipEntregaHoje(false), 300);
  }, [clearTooltipTimeout]);

  const handleEntregaHojeMouseEnter = useCallback(() => {
    clearTooltipTimeout();
    setTooltipEntregaHoje(true);
    if (pedidosHoje.length === 0 && !loadingTooltip) {
      setLoadingTooltip(true);
      const hoje = getTodayISO();
      listarPedidosPorDataEntrega(hoje)
        .then(setPedidosHoje)
        .catch(() => setPedidosHoje([]))
        .finally(() => setLoadingTooltip(false));
    }
  }, [clearTooltipTimeout, loadingTooltip, pedidosHoje.length]);

  const handleEntregaHojeMouseLeave = useCallback(() => {
    scheduleHideTooltip();
  }, [scheduleHideTooltip]);

  const handleTooltipMouseEnter = useCallback(() => {
    clearTooltipTimeout();
    setTooltipEntregaHoje(true);
  }, [clearTooltipTimeout]);

  const handleTooltipMouseLeave = useCallback(() => {
    scheduleHideTooltip();
  }, [scheduleHideTooltip]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-200 dark:bg-slate-800 rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-2/3 mb-3" />
            <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!resumo) return null;

  const cards = [
    { label: 'Total de pedidos', value: resumo.total, color: 'text-primary-600 dark:text-primary-400', key: 'total', alert: false },
    { label: 'Entrega hoje', value: resumo.entregaHoje, color: 'text-emerald-600 dark:text-emerald-400', key: 'entregaHoje', alert: false },
    { label: 'Atrasados', value: resumo.atrasados, color: 'text-accent-600 dark:text-accent-500', key: 'atrasados', alert: true },
    {
      label: 'Lead time médio (dias)',
      value: resumo.leadTimeMedioDias ?? '-',
      color: 'text-soaco-gray dark:text-white/80',
      key: 'leadTime',
      alert: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          ref={c.key === 'entregaHoje' ? cardEntregaHojeRef : undefined}
          className={`relative ${c.alert ? 'card-kpi-alert' : 'card-kpi'}`}
          onMouseEnter={c.key === 'entregaHoje' ? handleEntregaHojeMouseEnter : undefined}
          onMouseLeave={c.key === 'entregaHoje' ? handleEntregaHojeMouseLeave : undefined}
        >
          <p className="card-kpi-label">{c.label}</p>
          <p className={`card-kpi-value mt-1 ${c.color}`}>{c.value}</p>

          {c.key === 'entregaHoje' && tooltipEntregaHoje && (
            <div
              className="fixed z-[100] rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden min-w-[280px] max-w-[420px]"
              style={{
                left: tooltipPos.left,
                top: tooltipPos.top,
              }}
              onMouseEnter={handleTooltipMouseEnter}
              onMouseLeave={handleTooltipMouseLeave}
            >
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Pedidos com entrega hoje
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {resumo.entregaHoje} {resumo.entregaHoje === 1 ? 'pedido' : 'pedidos'}
                </p>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-2">
                {loadingTooltip ? (
                  <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-sm">
                    Carregando...
                  </div>
                ) : pedidosHoje.length === 0 ? (
                  <p className="py-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                    Nenhum pedido com entrega hoje.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {pedidosHoje.map((p, i) => {
                      const pd = p.PD != null ? String(p.PD) : (p.Pd != null ? String(p.Pd) : '—');
                      const cod = p.Cod != null ? String(p.Cod) : (p.cod != null ? String(p.cod) : '—');
                      return (
                        <li
                          key={`${p.id_pedido}-${i}`}
                          className="flex flex-col gap-0.5 px-2 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 text-left"
                        >
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            <span className="text-slate-500 dark:text-slate-400 font-normal">Pedido:</span> {pd}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500 dark:text-slate-500">Código do Produto:</span> {cod}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400 truncate" title={String(p.cliente ?? '')}>
                            {p.cliente ?? '—'}
                          </span>
                          {p.produto && (
                            <span className="text-xs text-slate-500 dark:text-slate-500 truncate" title={String(p.produto)}>
                              {String(p.produto).slice(0, 50)}
                              {String(p.produto).length > 50 ? '…' : ''}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
