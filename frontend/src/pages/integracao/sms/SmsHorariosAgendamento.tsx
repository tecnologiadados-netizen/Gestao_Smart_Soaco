import {
  cronExpressaoEditavelPorHorarios,
  cronExpressaoParaHorarios,
  descreverHorariosAgendamento,
  horariosParaCronExpressao,
} from '../../../utils/smsCronHorarios';

const inputClass =
  'rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm';

type Props = {
  cronExpressao: string | null | undefined;
  disabled?: boolean;
  onChange: (cronExpressao: string) => void;
};

export default function SmsHorariosAgendamento({ cronExpressao, disabled, onChange }: Props) {
  const editavel = cronExpressaoEditavelPorHorarios(cronExpressao);
  const horarios = cronExpressaoParaHorarios(cronExpressao);

  const atualizarHorarios = (lista: string[]) => {
    onChange(horariosParaCronExpressao(lista));
  };

  const alterarHorario = (idx: number, valor: string) => {
    const next = [...horarios];
    next[idx] = valor;
    atualizarHorarios(next);
  };

  const adicionarHorario = () => {
    atualizarHorarios([...horarios, '09:00']);
  };

  const removerHorario = (idx: number) => {
    if (horarios.length <= 1) return;
    atualizarHorarios(horarios.filter((_, i) => i !== idx));
  };

  if (!editavel) {
    return (
      <div className="col-span-full space-y-1">
        <label className="block text-xs font-medium text-slate-500 mb-1">Expressão cron (avançado)</label>
        <input
          className={`${inputClass} w-full font-mono`}
          value={cronExpressao ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0 18 * * *"
        />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Agendamento em formato avançado. Edite a expressão cron ou salve horários padrão abaixo.
        </p>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(horariosParaCronExpressao(['18:00']))}
            className="text-xs text-primary-600 hover:underline"
          >
            Usar editor de horários (18:00)
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="col-span-full space-y-2">
      <label className="block text-xs font-medium text-slate-500">Horários de envio (todos os dias)</label>
      <div className="space-y-2">
        {horarios.map((horario, idx) => (
          <div key={`${idx}-${horario}`} className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              className={inputClass}
              value={horario}
              disabled={disabled}
              onChange={(e) => alterarHorario(idx, e.target.value)}
            />
            {!disabled && horarios.length > 1 && (
              <button
                type="button"
                onClick={() => removerHorario(idx)}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Remover
              </button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={adicionarHorario}
          className="text-xs text-primary-600 hover:underline"
        >
          + Adicionar horário
        </button>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Envio diário às {descreverHorariosAgendamento(horarios)}.
      </p>
    </div>
  );
}
