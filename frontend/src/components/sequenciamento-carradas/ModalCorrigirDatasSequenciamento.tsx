import { formatDataCurta, hojeISO, type CarradaDataInvalida } from './simulacaoCarradas';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';

const DATE_INPUT_CLASS =
  'w-[8rem] rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

type Props = {
  invalidas: CarradaDataInvalida[];
  onEditar: (key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => void;
  minEntrega: (key: string) => string;
  onContinuar: () => void;
  onClose: () => void;
};

export default function ModalCorrigirDatasSequenciamento({
  invalidas,
  onEditar,
  minEntrega,
  onContinuar,
  onClose,
}: Props) {
  const hoje = hojeISO();
  const aindaInvalidas = invalidas.length > 0;

  useRegisterModalEscape({ id: 'seq-corrigir-datas', onClose, zIndex: 140 });

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
                      value={c.dataProducao}
                      min={hoje}
                      onChange={(e) => onEditar(c.key, 'dataProducao', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      className={`${DATE_INPUT_CLASS} ${c.entregaPassada ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                      value={c.dataEntrega}
                      min={minEntrega(c.key)}
                      onChange={(e) => onEditar(c.key, 'dataEntrega', e.target.value)}
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
