import { useEffect, useRef, useState } from 'react';
import {
  agendamentoParaCronExpressao,
  cronExpressaoEditavelPorHorarios,
  cronExpressaoParaAgendamento,
  descreverHorariosAgendamento,
  descreverPeriodicidade,
  DIAS_SEMANA_CRON,
  diasSemanaDoPreset,
  inferirPeriodicidadePreset,
  proximoHorarioSugerido,
  type PeriodicidadePreset,
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

  const inicial = cronExpressaoParaAgendamento(cronExpressao);
  const [horarios, setHorarios] = useState(inicial.horarios);
  const [diasSemana, setDiasSemana] = useState(inicial.diasSemana);
  const [preset, setPreset] = useState<PeriodicidadePreset>(() =>
    inferirPeriodicidadePreset(inicial.diasSemana)
  );
  const cronExternoRef = useRef((cronExpressao ?? '').trim());

  useEffect(() => {
    const cronNorm = (cronExpressao ?? '').trim();
    if (cronExternoRef.current === cronNorm) return;
    cronExternoRef.current = cronNorm;

    const parsed = cronExpressaoParaAgendamento(cronExpressao);
    if (parsed.horarios.length === 0 && cronNorm !== '') return;

    setHorarios(parsed.horarios.length > 0 ? parsed.horarios : ['18:00']);
    setDiasSemana(parsed.diasSemana);
    setPreset(inferirPeriodicidadePreset(parsed.diasSemana));
  }, [cronExpressao]);

  const sincronizarComPai = (lista: string[], dias: number[]) => {
    const cron = agendamentoParaCronExpressao(lista, dias);
    cronExternoRef.current = cron;
    onChange(cron);
  };

  const alterarHorario = (idx: number, valor: string) => {
    setHorarios((prev) => {
      const next = [...prev];
      next[idx] = valor;
      return next;
    });
  };

  const confirmarHorario = (idx: number, valor: string) => {
    setHorarios((prev) => {
      const next = [...prev];
      next[idx] = valor;
      sincronizarComPai(next, diasSemana);
      return next;
    });
  };

  const adicionarHorario = () => {
    setHorarios((prev) => {
      const next = [...prev, proximoHorarioSugerido(prev)];
      sincronizarComPai(next, diasSemana);
      return next;
    });
  };

  const removerHorario = (idx: number) => {
    setHorarios((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      sincronizarComPai(next, diasSemana);
      return next;
    });
  };

  const aplicarPreset = (novoPreset: PeriodicidadePreset) => {
    setPreset(novoPreset);
    const dias =
      novoPreset === 'personalizado' ? diasSemana : diasSemanaDoPreset(novoPreset);
    if (novoPreset !== 'personalizado') {
      setDiasSemana(dias);
    }
    sincronizarComPai(horarios, novoPreset === 'personalizado' ? diasSemana : dias);
  };

  const toggleDia = (dia: number) => {
    setPreset('personalizado');
    setDiasSemana((prev) => {
      const has = prev.includes(dia);
      const next = has ? prev.filter((d) => d !== dia) : [...prev, dia].sort((a, b) => a - b);
      const diasFinais = next.length === 0 ? [dia] : next;
      sincronizarComPai(horarios, diasFinais);
      return diasFinais;
    });
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
            onClick={() => onChange(agendamentoParaCronExpressao(['18:00']))}
            className="text-xs text-primary-600 hover:underline"
          >
            Usar editor de horários (18:00)
          </button>
        )}
      </div>
    );
  }

  const horariosValidos = horarios.filter((h) => /^\d{1,2}:\d{2}$/.test(h.trim()));

  return (
    <div className="col-span-full space-y-4">
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-500">Periodicidade</label>
        <select
          className={inputClass}
          value={preset}
          disabled={disabled}
          onChange={(e) => aplicarPreset(e.target.value as PeriodicidadePreset)}
        >
          <option value="todos">Todos os dias</option>
          <option value="uteis">Segunda a sexta</option>
          <option value="personalizado">Personalizado</option>
        </select>

        {preset === 'personalizado' ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {DIAS_SEMANA_CRON.map((dia) => {
              const marcado = diasSemana.includes(dia.valor);
              return (
                <label
                  key={dia.valor}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    marcado
                      ? 'border-primary-400 bg-primary-50 text-primary-800 dark:border-primary-600 dark:bg-primary-900/30 dark:text-primary-200'
                      : 'border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="size-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={marcado}
                    disabled={disabled}
                    onChange={() => toggleDia(dia.valor)}
                  />
                  {dia.label}
                </label>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-500">Horários de envio</label>
        <div className="space-y-2">
          {horarios.map((horario, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                className={inputClass}
                value={horario}
                disabled={disabled}
                onChange={(e) => alterarHorario(idx, e.target.value)}
                onBlur={(e) => confirmarHorario(idx, e.target.value)}
              />
              {!disabled && horarios.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removerHorario(idx)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Remover
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {!disabled ? (
          <button
            type="button"
            onClick={adicionarHorario}
            className="text-xs text-primary-600 hover:underline"
          >
            + Adicionar horário
          </button>
        ) : null}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Envio às {descreverHorariosAgendamento(horariosValidos.length > 0 ? horariosValidos : horarios)}{' '}
        — {descreverPeriodicidade(diasSemana)}.
      </p>
    </div>
  );
}
