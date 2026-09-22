import { useEffect, useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import type {
  ProgramacaoProducaoRecurso,
  RecursoEscalaExcecao,
  RecursoEscalaExcecaoTipo,
  RecursoEscalaFaixa,
} from './types';
import { formatPeriodoEscalaExcecao, formatEscalaResumo } from '../../utils/recursoEscalaLabel';
import { excecaoVigenteNoDia } from '../../utils/recursoEscalaHoras';
import { isFeriadoEscalaTeresina, nomeFeriadoEscalaPiaui } from '../../utils/feriadosEscalaPiaui';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition disabled:opacity-50';
const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm';

function hojeYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateFromYmd(ymd: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function novoId(): string {
  return `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function faixasPadrao(recurso: ProgramacaoProducaoRecurso): RecursoEscalaFaixa[] {
  const origem = recurso.escala?.faixas?.length
    ? recurso.escala.faixas
    : [
        { inicio: '07:00', fim: '11:30' },
        { inicio: '13:00', fim: '17:15' },
      ];
  return origem.map((f) => ({ inicio: f.inicio, fim: f.fim }));
}

/** Nome amigável do feriado (nacional + PI/Teresina). */
function tituloFeriado(ymd: string): string | null {
  if (!isFeriadoEscalaTeresina(ymd)) return null;
  const local = nomeFeriadoEscalaPiaui(ymd);
  if (local) return local;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return 'Feriado';
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const nacionaisFixos: Record<string, string> = {
    '01-01': 'Confraternização Universal',
    '04-21': 'Tiradentes',
    '05-01': 'Dia do Trabalho',
    '09-07': 'Independência do Brasil',
    '10-12': 'Nossa Senhora Aparecida',
    '11-02': 'Finados',
    '11-15': 'Proclamação da República',
    '11-20': 'Consciência Negra',
    '12-25': 'Natal',
  };
  const key = `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return nacionaisFixos[key] ?? 'Feriado (nacional / móvel)';
}

export default function ModalEscalaPontualRecurso({
  recurso,
  canEdit,
  salvando,
  erro,
  onClose,
  onSalvar,
}: {
  recurso: ProgramacaoProducaoRecurso;
  canEdit: boolean;
  salvando: boolean;
  erro: string | null;
  onClose: () => void;
  onSalvar: (excecoes: RecursoEscalaExcecao[]) => void;
}) {
  const [lista, setLista] = useState<RecursoEscalaExcecao[]>(() => [...(recurso.escalaExcecoes ?? [])]);
  const [dataIni, setDataIni] = useState(hojeYmd);
  const [dataFim, setDataFim] = useState(hojeYmd);
  const [tipo, setTipo] = useState<RecursoEscalaExcecaoTipo>('substituir');
  const [faixas, setFaixas] = useState<RecursoEscalaFaixa[]>(() => faixasPadrao(recurso));
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [mesCalendario, setMesCalendario] = useState<Date>(() => dateFromYmd(hojeYmd()) ?? new Date());

  // Recarrega a lista se o recurso vier atualizado da API (evita modal “vazio” após reabrir).
  useEffect(() => {
    setLista([...(recurso.escalaExcecoes ?? [])]);
  }, [recurso.cod, recurso.updatedAt]);

  /** Campos De/Até e edição de pontualidade devem navegar o calendário para o mês do período. */
  useEffect(() => {
    const d = dateFromYmd(dataIni);
    if (!d) return;
    setMesCalendario((prev) =>
      prev.getFullYear() === d.getFullYear() && prev.getMonth() === d.getMonth() ? prev : d
    );
  }, [dataIni]);

  const listaOrdenada = useMemo(
    () => [...lista].sort((a, b) => b.dataIni.localeCompare(a.dataIni) || b.dataFim.localeCompare(a.dataFim)),
    [lista]
  );

  const limparForm = () => {
    setEditandoId(null);
    const hoje = hojeYmd();
    setDataIni(hoje);
    setDataFim(hoje);
    setTipo('substituir');
    setFaixas(faixasPadrao(recurso));
    setErroLocal(null);
  };

  const carregar = (ex: RecursoEscalaExcecao) => {
    setEditandoId(ex.id);
    setDataIni(ex.dataIni);
    setDataFim(ex.dataFim);
    setTipo(ex.tipo);
    setFaixas(
      ex.tipo === 'substituir' && ex.faixas?.length ? ex.faixas.map((f) => ({ ...f })) : faixasPadrao(recurso)
    );
    setErroLocal(null);
  };

  const montarExcecao = (): RecursoEscalaExcecao | null => {
    if (!dataIni || !dataFim) {
      setErroLocal('Informe o dia ou o período.');
      return null;
    }
    if (dataFim < dataIni) {
      setErroLocal('A data final deve ser igual ou depois da inicial.');
      return null;
    }
    if (tipo === 'folga') {
      return { id: editandoId ?? novoId(), dataIni, dataFim, tipo: 'folga' };
    }
    const ok = faixas.filter((f) => f.inicio.trim() && f.fim.trim());
    if (!ok.length) {
      setErroLocal('Informe pelo menos uma faixa de horário.');
      return null;
    }
    return { id: editandoId ?? novoId(), dataIni, dataFim, tipo: 'substituir', faixas: ok };
  };

  const incluirOuAtualizar = () => {
    const item = montarExcecao();
    if (!item) return;
    setLista((prev) => {
      const sem = prev.filter((x) => x.id !== item.id);
      return [...sem, item];
    });
    limparForm();
  };

  const remover = (id: string) => {
    setLista((prev) => prev.filter((x) => x.id !== id));
    if (editandoId === id) limparForm();
  };

  return (
    <div
      className="fixed inset-0 z-[13000] overflow-y-auto bg-black/70"
      onClick={() => !salvando && onClose()}
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="flex max-h-[min(90vh,780px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="escala-pontual-titulo"
        >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 id="escala-pontual-titulo" className="text-sm font-semibold text-slate-800 dark:text-slate-100 sm:text-base">
            Escala pontual · {recurso.cod} {recurso.nome}
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Padrão: {formatEscalaResumo(recurso.escala)}. Feriados nacionais e do Piauí/Teresina sem jornada — use horário especial se operar.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/40">
            <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Calendário
              </p>
              <div className="flex flex-wrap justify-end gap-x-2.5 gap-y-0.5 text-[9px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-slate-300 dark:bg-slate-600" /> Jornada
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-rose-500" /> Feriado
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-indigo-500" /> Especial
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-amber-500" /> Folga
                </span>
              </div>
            </div>
            <DayPicker
              mode="single"
              locale={ptBR}
              month={mesCalendario}
              onMonthChange={setMesCalendario}
              selected={dateFromYmd(dataIni)}
              onSelect={(d) => {
                if (!d || !canEdit || salvando) return;
                const iso = ymdFromDate(d);
                const estende = !editandoId && dataIni && dataFim && dataIni === dataFim && iso > dataIni;
                if (estende) {
                  setDataFim(iso);
                  return;
                }
                const vigente = excecaoVigenteNoDia(iso, lista);
                if (vigente) {
                  carregar(vigente);
                  return;
                }
                setDataIni(iso);
                setDataFim(iso);
                if (isFeriadoEscalaTeresina(iso)) {
                  setTipo('substituir');
                  setFaixas(faixasPadrao(recurso));
                }
              }}
              modifiers={{
                folga: (d) => excecaoVigenteNoDia(ymdFromDate(d), lista)?.tipo === 'folga',
                extra: (d) => excecaoVigenteNoDia(ymdFromDate(d), lista)?.tipo === 'substituir',
                feriado: (d) => {
                  const ymd = ymdFromDate(d);
                  if (excecaoVigenteNoDia(ymd, lista)) return false;
                  return isFeriadoEscalaTeresina(ymd);
                },
                jornada: (d) => {
                  const ymd = ymdFromDate(d);
                  if (excecaoVigenteNoDia(ymd, lista)) return false;
                  if (isFeriadoEscalaTeresina(ymd)) return false;
                  return Boolean(recurso.escala?.diasSemana?.includes(d.getDay()));
                },
              }}
              modifiersClassNames={{
                folga: 'rdp-day-folga',
                extra: 'rdp-day-extra',
                feriado: 'rdp-day-feriado',
                jornada: 'rdp-day-jornada',
              }}
              classNames={{
                root: 'rdp-escala-compact mx-auto w-fit text-xs',
                months: 'flex flex-col',
                month: 'space-y-1',
                month_caption: 'relative flex h-7 items-center justify-center text-xs font-semibold text-slate-800 dark:text-slate-100',
                nav: 'absolute inset-x-0 top-0 flex items-center justify-between px-0.5',
                button_previous:
                  'inline-flex size-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700',
                button_next:
                  'inline-flex size-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700',
                weekdays: 'flex',
                weekday: 'w-7 text-[0.65rem] font-medium text-slate-500 dark:text-slate-400',
                week: 'flex mt-px',
                day: 'w-7 h-7 p-0 text-center text-xs',
                day_button:
                  'h-7 w-7 rounded text-[11px] hover:bg-primary-50 dark:hover:bg-primary-900/40 focus:outline-none focus:ring-1 focus:ring-primary-500',
                selected: '[&_button]:bg-primary-600 [&_button]:text-white',
                today: 'font-bold',
                outside: 'opacity-35',
              }}
              components={{
                DayButton: (props) => {
                  const { day, modifiers, ...buttonProps } = props;
                  const ymd = ymdFromDate(day.date);
                  const nome = modifiers.feriado ? tituloFeriado(ymd) : null;
                  return (
                    <button
                      {...buttonProps}
                      type="button"
                      title={
                        nome
                          ? `${nome} — sem jornada padrão; clique para atribuir horário especial se necessário`
                          : buttonProps.title
                      }
                    />
                  );
                },
              }}
            />
            <p className="mt-1 px-0.5 text-[9px] leading-snug text-slate-400">
              Clique no dia · segundo clique estende o período · feriado (rose) = sem escala
            </p>
            <style>{`
              .rdp-escala-compact .rdp-day-jornada:not(.rdp-selected) button { background: rgb(226 232 240); }
              .dark .rdp-escala-compact .rdp-day-jornada:not(.rdp-selected) button { background: rgb(71 85 105); }
              .rdp-escala-compact .rdp-day-feriado:not(.rdp-selected) button { background: rgb(244 63 94); color: white; }
              .rdp-escala-compact .rdp-day-extra:not(.rdp-selected) button { background: rgb(99 102 241); color: white; }
              .rdp-escala-compact .rdp-day-folga:not(.rdp-selected) button { background: rgb(245 158 11); color: white; }
              .rdp-escala-compact .rdp-chevron { width: 12px; height: 12px; }
            `}</style>
          </div>
          {canEdit ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {editandoId ? 'Alterar pontualidade' : 'Nova pontualidade'}
              </p>
              {dataIni && isFeriadoEscalaTeresina(dataIni) && !editandoId ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                  {tituloFeriado(dataIni)} — sem jornada padrão. Inclua um horário especial abaixo se for
                  trabalhar neste dia.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600 dark:text-slate-400">
                  De
                  <input
                    type="date"
                    className={`${INPUT} mt-1 py-1.5`}
                    value={dataIni}
                    disabled={salvando}
                    onChange={(e) => {
                      setDataIni(e.target.value);
                      if (dataFim && e.target.value > dataFim) setDataFim(e.target.value);
                    }}
                  />
                </label>
                <label className="text-xs text-slate-600 dark:text-slate-400">
                  Até
                  <input
                    type="date"
                    className={`${INPUT} mt-1 py-1.5`}
                    value={dataFim}
                    min={dataIni}
                    disabled={salvando}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => setTipo('substituir')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    tipo === 'substituir'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
                  }`}
                >
                  Horário especial
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => setTipo('folga')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    tipo === 'folga'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
                  }`}
                >
                  Folga
                </button>
              </div>
              {tipo === 'substituir' ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Substitui a escala nesses dias (hora extra, sábado, feriado com operação, jornada diferente).
                  </p>
                  {faixas.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="time"
                        className={`${INPUT} py-1.5`}
                        value={f.inicio}
                        disabled={salvando}
                        onChange={(e) =>
                          setFaixas((prev) => prev.map((x, i) => (i === idx ? { ...x, inicio: e.target.value } : x)))
                        }
                      />
                      <span className="text-xs text-slate-500">até</span>
                      <input
                        type="time"
                        className={`${INPUT} py-1.5`}
                        value={f.fim}
                        disabled={salvando}
                        onChange={(e) =>
                          setFaixas((prev) => prev.map((x, i) => (i === idx ? { ...x, fim: e.target.value } : x)))
                        }
                      />
                      {faixas.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline dark:text-red-400"
                          disabled={salvando}
                          onClick={() => setFaixas((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                    disabled={salvando}
                    onClick={() => setFaixas((prev) => [...prev, { inicio: '17:15', fim: '20:00' }])}
                  >
                    + Faixa
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Nesses dias a máquina não tem jornada prevista (previsto = 0).
                </p>
              )}
              {erroLocal ? (
                <p className="text-sm text-red-600 dark:text-red-300" role="alert">
                  {erroLocal}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                {editandoId ? (
                  <button type="button" className={BTN_SECONDARY} disabled={salvando} onClick={limparForm}>
                    Cancelar edição
                  </button>
                ) : null}
                <button type="button" className={BTN_PRIMARY} disabled={salvando} onClick={incluirOuAtualizar}>
                  {editandoId ? 'Atualizar na lista' : 'Incluir na lista'}
                </button>
              </div>
            </div>
          ) : null}

          <div className={canEdit ? 'mt-4' : ''}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Pontualidades cadastradas
              {listaOrdenada.length > 0 ? (
                <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                  ({listaOrdenada.length})
                </span>
              ) : null}
            </p>
            {listaOrdenada.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nenhuma folga ou horário especial.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {listaOrdenada.map((ex) => {
                  const periodo = formatPeriodoEscalaExcecao(ex.dataIni, ex.dataFim);
                  const diaUnico = ex.dataIni === ex.dataFim;
                  const isFolga = ex.tipo === 'folga';
                  const faixasEx = isFolga ? [] : (ex.faixas ?? []).filter((f) => f.inicio && f.fim);
                  return (
                    <li
                      key={ex.id}
                      className={`rounded-lg border px-3 py-2.5 ${
                        isFolga
                          ? 'border-amber-200/80 bg-amber-50/70 dark:border-amber-800/40 dark:bg-amber-950/25'
                          : 'border-indigo-200/80 bg-indigo-50/60 dark:border-indigo-800/40 dark:bg-indigo-950/25'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                                isFolga
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-indigo-600 text-white'
                              }`}
                              title={diaUnico ? `Dia ${periodo}` : `Período ${periodo}`}
                            >
                              {periodo}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                isFolga
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200'
                              }`}
                            >
                              {isFolga ? 'Folga' : 'Horário especial'}
                            </span>
                          </div>
                          {isFolga ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Sem jornada prevista (previsto = 0)
                            </p>
                          ) : faixasEx.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {faixasEx.map((f, i) => (
                                <span
                                  key={`${ex.id}-f-${i}`}
                                  className="inline-flex items-center rounded-md border border-indigo-200/80 bg-white px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-slate-700 dark:border-indigo-700/50 dark:bg-slate-900/60 dark:text-slate-200"
                                >
                                  {f.inicio}–{f.fim}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Sem faixas definidas</p>
                          )}
                        </div>
                        {canEdit ? (
                          <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5 sm:flex-row sm:items-center sm:gap-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                              disabled={salvando}
                              onClick={() => carregar(ex)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                              disabled={salvando}
                              onClick={() => remover(ex.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {erro ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">
              {erro}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-2.5 dark:border-slate-700">
          <button type="button" className={BTN_SECONDARY} disabled={salvando} onClick={onClose}>
            {canEdit ? 'Cancelar' : 'Fechar'}
          </button>
          {canEdit ? (
            <button type="button" className={BTN_PRIMARY} disabled={salvando} onClick={() => onSalvar(lista)}>
              {salvando ? 'Salvando…' : 'Salvar pontualidades'}
            </button>
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}
