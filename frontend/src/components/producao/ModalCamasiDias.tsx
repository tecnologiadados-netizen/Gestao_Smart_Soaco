import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import {
  fetchCamasiDashboardDias,
  type CamasiDiasResponse,
} from '../../api/producaoCamasi';
import { formatHoras, formatYmdBr } from './camasiFormat';

export type CamasiDiasModalParams = {
  dataIni: string;
  dataFim: string;
  mes: string;
  tipo: 'producao' | 'parado';
};

function cacheKey(p: CamasiDiasModalParams): string {
  return `${p.mes}|${p.tipo}|${p.dataIni}|${p.dataFim}`;
}

export default function ModalCamasiDias({
  open,
  params,
  cacheRef,
  onClose,
}: {
  open: boolean;
  params: CamasiDiasModalParams | null;
  cacheRef: MutableRefObject<Map<string, CamasiDiasResponse>>;
  onClose: () => void;
}) {
  const [dados, setDados] = useState<CamasiDiasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const carregar = useCallback(async () => {
    if (!open || !params) return;
    const key = cacheKey(params);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setDados(cached);
      setErro(null);
      setLoading(false);
      return;
    }

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchCamasiDashboardDias(params);
      if (reqId !== reqIdRef.current) return;
      cacheRef.current.set(key, res);
      setDados(res);
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setDados(null);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dias.');
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [cacheRef, open, params]);

  useEffect(() => {
    if (!open) {
      setDados(null);
      setErro(null);
      setLoading(false);
      return;
    }
    void carregar();
  }, [carregar, open]);

  useRegisterModalEscape({
    id: 'camasi-dias-modal',
    onClose,
    zIndex: 12900,
    enabled: open,
  });

  if (!open || !params) return null;

  const titulo =
    params.tipo === 'producao'
      ? `Produção — ${dados?.label ?? params.mes}`
      : `Parado — ${dados?.label ?? params.mes}`;
  const maxHoras = Math.max(...(dados?.dias.map((d) => d.horas) ?? [0]), 1);

  return createPortal(
    <div
      className="fixed inset-0 z-[12900] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(85vh,680px)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{titulo}</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Detalhe por dia · total {formatHoras(dados?.totalHoras ?? 0)}
            </p>
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
          ) : !dados?.dias.length ? (
            <div className="py-12 text-center text-slate-500">Sem dados neste mês.</div>
          ) : (
            <div className="space-y-2">
              {dados.dias.map((d) => {
                const barPct = (d.horas / maxHoras) * 100;
                return (
                  <div
                    key={d.data}
                    className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3"
                  >
                    <span className="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
                      {formatYmdBr(d.data)}
                    </span>
                    <div className="relative h-8 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-lg ${
                          params.tipo === 'producao'
                            ? 'bg-emerald-500/80 dark:bg-emerald-400/70'
                            : 'bg-amber-500/80 dark:bg-amber-400/70'
                        }`}
                        style={{ width: `${Math.max(barPct, d.horas > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                    <span className="min-w-[4.5rem] text-right text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {formatHoras(d.horas)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {dados && dados.dias.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">{dados.dias.length} dia(s)</span>
            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              Total {formatHoras(dados.totalHoras)}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
