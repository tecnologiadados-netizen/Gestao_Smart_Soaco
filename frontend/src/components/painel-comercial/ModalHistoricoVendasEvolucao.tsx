import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import {
  obterHistoricoVendasSerieFatia,
  type FiltrosHistoricoVendas,
  type SerieFatiaContexto,
  type SerieMes,
} from '../../api/historicoVendas';
import PainelComercialEvolucaoChart from './PainelComercialEvolucaoChart';
import { formatMoeda, formatNumero } from './painelComercialUtils';

export default function ModalHistoricoVendasEvolucao({
  open,
  modalId,
  titulo,
  subtitulo,
  filtros,
  contexto,
  onClose,
  cacheRef,
}: {
  open: boolean;
  modalId: string;
  titulo: string;
  subtitulo?: string;
  filtros: FiltrosHistoricoVendas;
  contexto?: SerieFatiaContexto;
  onClose: () => void;
  cacheRef?: React.MutableRefObject<Map<string, SerieMes[]>>;
}) {
  const [series, setSeries] = useState<SerieMes[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cacheKey = useMemo(() => JSON.stringify({ filtros, contexto }), [contexto, filtros]);

  const carregar = useCallback(async () => {
    if (!open) return;
    const cached = cacheRef?.current.get(cacheKey);
    if (cached) {
      setSeries(cached);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data = await obterHistoricoVendasSerieFatia(filtros, contexto);
      const s = data.serieMensal ?? [];
      setSeries(s);
      cacheRef?.current.set(cacheKey, s);
    } catch (e) {
      setSeries([]);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar evolução.');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, cacheRef, contexto, filtros, open]);

  useEffect(() => {
    if (!open) {
      setSeries([]);
      setErro(null);
      return;
    }
    void carregar();
  }, [carregar, open]);

  useRegisterModalEscape({ id: modalId, onClose, zIndex: 12950, enabled: open });

  const resumo = useMemo(() => {
    const valor = series.reduce((s, x) => s + x.valor, 0);
    const qtde = series.reduce((s, x) => s + x.qtde, 0);
    return { valor, qtde };
  }, [series]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[12950] flex items-center justify-center bg-black/70 p-4" role="presentation" onClick={onClose}>
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitulo}</p>}
            {!loading && !erro && series.length > 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatMoeda(resumo.valor)} · {formatNumero(resumo.qtde)} un. no período filtrado
              </p>
            )}
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
          {erro ? (
            <div className="py-12 text-center text-red-600 dark:text-red-400">{erro}</div>
          ) : (
            <PainelComercialEvolucaoChart
              series={series}
              loading={loading}
              compact
              title="Evolução mensal da fatia"
              subtitle="Valor e unidades vendidas por mês no período filtrado."
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
