import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ComparacaoBase, FiltrosHistoricoVendas } from '../../api/historicoVendas';
import {
  mesesAtrasYmd,
  mesesEntreYmd,
  PAINEL_COMERCIAL_MAX_MESES,
  periodoDisponivelPadraoYmd,
} from './painelComercialUtils';

const MAX_MESES = PAINEL_COMERCIAL_MAX_MESES;

type PresetId = '12m' | '24m' | '48m' | 'ano' | 'custom';

function presetPeriodo(id: Exclude<PresetId, 'custom'>): { dataIni: string; dataFim: string } {
  if (id === 'ano') {
    const fim = new Date();
    const y = fim.getFullYear();
    return {
      dataIni: `${y}-01-01`,
      dataFim: `${y}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`,
    };
  }
  if (id === '12m') return { dataIni: mesesAtrasYmd(12), dataFim: periodoDisponivelPadraoYmd().dataFim };
  if (id === '24m') return { dataIni: mesesAtrasYmd(24), dataFim: periodoDisponivelPadraoYmd().dataFim };
  return periodoDisponivelPadraoYmd();
}

export default function ModalHistoricoVendasPeriodo({
  open,
  initial,
  onConfirm,
}: {
  open: boolean;
  initial: FiltrosHistoricoVendas;
  onConfirm: (filtros: FiltrosHistoricoVendas) => void;
}) {
  const [dataIni, setDataIni] = useState(initial.dataIni);
  const [dataFim, setDataFim] = useState(initial.dataFim);
  const [comparacaoBase, setComparacaoBase] = useState<ComparacaoBase>(initial.comparacaoBase ?? 'ano_anterior');
  const [preset, setPreset] = useState<PresetId>('48m');

  const periodoErro = useMemo(() => {
    const meses = mesesEntreYmd(dataIni, dataFim);
    if (meses == null) return 'Datas inválidas.';
    if (meses > MAX_MESES) return `Período máximo permitido: ${MAX_MESES} meses.`;
    return null;
  }, [dataIni, dataFim]);

  const aplicarPreset = (id: Exclude<PresetId, 'custom'>) => {
    const p = presetPeriodo(id);
    setPreset(id);
    setDataIni(p.dataIni);
    setDataFim(p.dataFim);
  };

  if (!open) return null;

  return createPortal(
    // z abaixo do sidebar (z-40) e header (z-50) para permitir navegar sem fechar o gate.
    <div className="fixed inset-0 z-[30] flex items-center justify-center overflow-y-auto bg-black/55 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="historico-vendas-periodo-titulo"
        className="my-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h2
          id="historico-vendas-periodo-titulo"
          className="text-base font-semibold text-slate-800 dark:text-slate-100"
        >
          Qual período deseja visualizar?
        </h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Escolha o intervalo de vendas Só Aço antes de carregar o painel. Máximo de {MAX_MESES} meses.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { id: '12m' as const, label: 'Últimos 12 meses' },
              { id: '24m' as const, label: 'Últimos 24 meses' },
              { id: '48m' as const, label: 'Últimos 48 meses' },
              { id: 'ano' as const, label: 'Ano corrente' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => aplicarPreset(p.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                preset === p.id
                  ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950/50 dark:text-primary-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            Início
            <input
              type="date"
              value={dataIni}
              onChange={(e) => {
                setPreset('custom');
                setDataIni(e.target.value);
              }}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            Fim
            <input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setPreset('custom');
                setDataFim(e.target.value);
              }}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>

        <label className="mt-3 block text-xs text-slate-600 dark:text-slate-300">
          Comparação
          <select
            value={comparacaoBase}
            onChange={(e) => setComparacaoBase(e.target.value as ComparacaoBase)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="ano_anterior">Mesmo período ano anterior</option>
            <option value="periodo_anterior">Período anterior</option>
          </select>
        </label>

        {periodoErro && (
          <p className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-300">{periodoErro}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={!!periodoErro}
            onClick={() => onConfirm({ dataIni, dataFim, comparacaoBase })}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
          >
            Carregar painel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
