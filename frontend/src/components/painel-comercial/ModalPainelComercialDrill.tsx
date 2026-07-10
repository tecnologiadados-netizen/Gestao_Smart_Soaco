import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { obterPainelComercialVendasDrill, type DrillDim, type FiltrosPainelComercialVendas } from '../../api/painelComercialVendas';
import { formatMoeda, formatNumero } from './painelComercialUtils';

export type DrillItem = { key: string; label: string; valor: number; qtde: number; pedidos: number };

export default function ModalPainelComercialDrill({
  open,
  modalId,
  titulo,
  subtitulo,
  filtros,
  dim,
  where,
  onClose,
  onItemClick,
}: {
  open: boolean;
  modalId: string;
  titulo: string;
  subtitulo?: string;
  filtros: FiltrosPainelComercialVendas;
  dim: DrillDim;
  where?: {
    mes?: string;
    grupoProduto?: string;
    subgrupo1?: string;
    subgrupo2?: string;
    vendedor?: string;
    regiao?: string;
    uf?: string;
    municipio?: string;
    cliente?: string;
    codigoProduto?: string;
    pd?: string;
  };
  onClose: () => void;
  onItemClick: (item: DrillItem) => void;
}) {
  const [dados, setDados] = useState<DrillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setErro(null);
    try {
      const res = await obterPainelComercialVendasDrill(filtros, { dim, ...where });
      setDados(res.items ?? []);
    } catch (e) {
      setDados([]);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [dim, filtros, open, where]);

  useEffect(() => {
    if (!open) {
      setDados([]);
      setErro(null);
      return;
    }
    void carregar();
  }, [carregar, open]);

  useRegisterModalEscape({
    id: modalId,
    onClose,
    zIndex: 12900,
    enabled: open,
  });

  const { maxValor, totalValor } = useMemo(() => {
    const max = Math.max(...dados.map((d) => d.valor), 1);
    const total = dados.reduce((s, d) => s + d.valor, 0);
    return { maxValor: max, totalValor: total };
  }, [dados]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[12900] flex items-center justify-center bg-black/70 p-4" role="presentation" onClick={onClose}>
      <div
        className="flex max-h-[min(85vh,680px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-12 text-center text-slate-500">Carregando…</div>
          ) : erro ? (
            <div className="py-12 text-center text-red-600 dark:text-red-400">{erro}</div>
          ) : dados.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Sem dados.</div>
          ) : (
            <div className="space-y-3">
              {dados.map((d) => {
                const pct = totalValor > 0 ? Math.round((d.valor / totalValor) * 100) : 0;
                const barPct = (d.valor / maxValor) * 100;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => onItemClick(d)}
                    className="grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] items-center gap-3 rounded-lg px-1 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    title="Clique para ver a grade detalhada"
                  >
                    <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{d.label}</span>
                    <div className="relative h-7 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-primary-500 transition hover:brightness-110"
                        style={{ width: `${Math.max(barPct, d.valor > 0 ? 2 : 0)}%` }}
                      />
                      <span className="relative z-10 flex h-full items-center px-2 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                        {formatMoeda(d.valor, true)}
                      </span>
                    </div>
                    <span className="min-w-[108px] text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {pct}% · {formatNumero(d.pedidos)} PDs
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

