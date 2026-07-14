import { useRef } from 'react';
import { formatDataCurta, hojeISO, toISODate, type CarradaDataInvalida } from './simulacaoCarradas';
import { isCarradaOrdemFinal } from './sequenciamentoCarradasUtils';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import {
  clearDatePickerAberto,
  DATE_COL_KEYS,
  focusSeqDateInput,
  onDateInputToggleBlur,
  onDateInputToggleClick,
  type DateColKey,
} from './sequenciamentoGradeUi';

const DATE_INPUT_CLASS =
  'w-[8rem] rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

type Props = {
  invalidas: CarradaDataInvalida[];
  onEditar: (key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => void;
  onContinuar: () => void;
  onClose: () => void;
};

export default function ModalCorrigirDatasSequenciamento({
  invalidas,
  onEditar,
  onContinuar,
  onClose,
}: Props) {
  const hoje = hojeISO();
  const aindaInvalidas = invalidas.length > 0;
  const datePickerAbertoRef = useRef<string | null>(null);

  const replicarProducaoNaEntrega = (key: string, dataProducao: string) => {
    if (!dataProducao) return;
    onEditar(key, 'dataEntrega', dataProducao);
  };

  const replicarProducaoNaEntregaTodas = () => {
    for (const c of invalidas) {
      if (isCarradaOrdemFinal(c.carrada)) continue;
      if (c.dataProducao) onEditar(c.key, 'dataEntrega', c.dataProducao);
    }
  };

  useRegisterModalEscape({ id: 'seq-corrigir-datas', onClose, zIndex: 140 });

  const handleDateKey = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowKey: string,
    colKey: DateColKey
  ) => {
    if (e.key !== 'Tab' && e.key !== 'Enter') return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const colIdx = DATE_COL_KEYS.indexOf(colKey);
      const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (nextColIdx >= 0 && nextColIdx < DATE_COL_KEYS.length) {
        focusSeqDateInput(rowKey, DATE_COL_KEYS[nextColIdx]!);
      }
      return;
    }
    e.preventDefault();
    const keys = invalidas.map((c) => c.key);
    const rowIdx = keys.indexOf(rowKey);
    const targetIdx = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
    if (targetIdx < 0 || targetIdx >= keys.length) return;
    focusSeqDateInput(keys[targetIdx]!, colKey);
  };

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="corrigir-datas-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2 id="corrigir-datas-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Corrigir datas antes de concluir
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Há carradas com data de produção ou entrega anterior a hoje ({formatDataCurta(hoje)}). Ajuste as
            datas abaixo para continuar.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-primary-600 text-white">
                <th className="border border-primary-500/40 px-2 py-2 text-left font-semibold">Cód</th>
                <th className="border border-primary-500/40 px-2 py-2 text-left font-semibold">Carrada</th>
                <th className="border border-primary-500/40 px-2 py-2 text-left font-semibold">Data de produção</th>
                <th className="w-8 border border-primary-500/40 px-1 py-2 text-center font-semibold">
                  <button
                    type="button"
                    onClick={replicarProducaoNaEntregaTodas}
                    className="mx-auto block rounded px-1.5 py-0.5 text-xs font-medium text-white hover:bg-primary-500/50"
                    title="Replicar data de produção para entrega em todas as carradas"
                    aria-label="Replicar data de produção para entrega em todas as carradas"
                  >
                    →
                  </button>
                </th>
                <th className="border border-primary-500/40 px-2 py-2 text-left font-semibold">Data de entrega</th>
              </tr>
            </thead>
            <tbody>
              {invalidas.map((c) => (
                <tr key={c.key} className="border-b border-slate-100 dark:border-slate-700">
                  <td className="px-2 py-2 font-mono text-slate-800 dark:text-slate-200">{c.cod}</td>
                  <td className="max-w-[200px] truncate px-2 py-2 text-slate-800 dark:text-slate-200" title={c.carrada}>
                    {c.carrada}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      className={`${DATE_INPUT_CLASS} ${c.producaoPassada ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                      value={toISODate(c.dataProducao)}
                      data-editinput
                      data-rowkey={c.key}
                      data-colkey="dataProducao"
                      onChange={(e) => {
                        clearDatePickerAberto(datePickerAbertoRef);
                        onEditar(c.key, 'dataProducao', e.target.value);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') clearDatePickerAberto(datePickerAbertoRef);
                        handleDateKey(e, c.key, 'dataProducao');
                      }}
                      onClick={(e) => onDateInputToggleClick(e, `${c.key}:dataProducao`, datePickerAbertoRef)}
                      onBlur={() => onDateInputToggleBlur(`${c.key}:dataProducao`, datePickerAbertoRef)}
                    />
                  </td>
                  <td className="w-8 px-1 py-2 text-center align-middle">
                    {!isCarradaOrdemFinal(c.carrada) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          replicarProducaoNaEntrega(c.key, c.dataProducao);
                        }}
                        disabled={!c.dataProducao}
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
                        title="Replicar produção na entrega"
                        aria-label="Replicar produção na entrega"
                      >
                        →
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      className={`${DATE_INPUT_CLASS} ${c.entregaPassada ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                      value={toISODate(c.dataEntrega)}
                      data-editinput
                      data-rowkey={c.key}
                      data-colkey="dataEntrega"
                      onChange={(e) => {
                        clearDatePickerAberto(datePickerAbertoRef);
                        onEditar(c.key, 'dataEntrega', e.target.value);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') clearDatePickerAberto(datePickerAbertoRef);
                        handleDateKey(e, c.key, 'dataEntrega');
                      }}
                      onClick={(e) => onDateInputToggleClick(e, `${c.key}:dataEntrega`, datePickerAbertoRef)}
                      onBlur={() => onDateInputToggleBlur(`${c.key}:dataEntrega`, datePickerAbertoRef)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onContinuar}
            disabled={aindaInvalidas.length > 0}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aindaInvalidas.length > 0 ? 'Corrija todas as datas' : 'Continuar para motivos'}
          </button>
        </div>
      </div>
    </div>
  );
}
