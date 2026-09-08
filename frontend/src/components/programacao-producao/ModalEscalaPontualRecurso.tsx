import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import type {
  ProgramacaoProducaoRecurso,
  RecursoEscalaExcecao,
  RecursoEscalaExcecaoTipo,
  RecursoEscalaFaixa,
} from './types';
import { formatEscalaExcecaoResumo, formatEscalaResumo } from '../../utils/recursoEscalaLabel';
import { excecaoVigenteNoDia } from '../../utils/recursoEscalaHoras';

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

  const listaOrdenada = useMemo(
    () => [...lista].sort((a, b) => b.dataIni.localeCompare(a.dataIni) || b.dataFim.localeCompare(a.dataFim)),
    [lista]
  );

  const limparForm = () => {
    setEditandoId(null);
    setDataIni(hojeYmd());
    setDataFim(hojeYmd());
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
      className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/70 p-4"
      onClick={() => !salvando && onClose()}
    >
      <div
        className="flex max-h-[min(92vh,860px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="escala-pontual-titulo"
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="escala-pontual-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Escala pontual · {recurso.cod} {recurso.nome}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Padrão semanal: {formatEscalaResumo(recurso.escala)}. Defina folga ou outro horário em um dia
            ou período — o painel Camasi segue essa pontualidade.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/30">
            <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Calendário
            </p>
            <DayPicker
              mode="single"
              locale={ptBR}
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
              }}
              modifiers={{
                folga: (d) => excecaoVigenteNoDia(ymdFromDate(d), lista)?.tipo === 'folga',
                extra: (d) => excecaoVigenteNoDia(ymdFromDate(d), lista)?.tipo === 'substituir',
                jornada: (d) => {
                  const ymd = ymdFromDate(d);
                  if (excecaoVigenteNoDia(ymd, lista)) return false;
                  return Boolean(recurso.escala?.diasSemana?.includes(d.getDay()));
                },
              }}
              modifiersClassNames={{
                folga: 'rdp-day-folga',
                extra: 'rdp-day-extra',
                jornada: 'rdp-day-jornada',
              }}
              classNames={{
                root: 'text-sm px-1',
                months: 'flex flex-col',
                month: 'space-y-2',
                month_caption: 'flex justify-center py-1 text-sm font-semibold text-slate-800 dark:text-slate-100',
                weekdays: 'flex',
                weekday: 'w-9 text-[0.7rem] font-medium text-slate-500 dark:text-slate-400',
                week: 'flex mt-0.5',
                day: 'w-9 h-9 p-0 text-center text-sm',
                day_button:
                  'h-9 w-9 rounded hover:bg-primary-50 dark:hover:bg-primary-900/40 focus:outline-none focus:ring-2 focus:ring-primary-500',
                selected: '[&_button]:bg-primary-600 [&_button]:text-white',
                today: 'font-bold',
              }}
            />
            <div className="mt-1 flex flex-wrap gap-3 px-1 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" /> Jornada padrão
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-indigo-500" /> Horário especial
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-amber-500" /> Folga
              </span>
            </div>
            <p className="mt-1 px-1 text-[10px] text-slate-400">
              Clique num dia para preencher De/Até; segundo clique depois desse dia estende o período.
            </p>
            <style>{`
              .rdp-day-jornada:not(.rdp-selected) button { background: rgb(226 232 240); }
              .dark .rdp-day-jornada:not(.rdp-selected) button { background: rgb(71 85 105); }
              .rdp-day-extra:not(.rdp-selected) button { background: rgb(99 102 241); color: white; }
              .rdp-day-folga:not(.rdp-selected) button { background: rgb(245 158 11); color: white; }
            `}</style>
          </div>
          {canEdit ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {editandoId ? 'Alterar pontualidade' : 'Nova pontualidade'}
              </p>
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
                    Substitui a escala nesses dias (hora extra, sábado, jornada diferente).
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
            </p>
            {listaOrdenada.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nenhuma folga ou horário especial.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
                {listaOrdenada.map((ex) => (
                  <li key={ex.id} className="flex items-start justify-between gap-2 py-2">
                    <div>
                      <p className="text-sm text-slate-800 dark:text-slate-100">{formatEscalaExcecaoResumo(ex)}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ex.tipo === 'folga' ? 'Sem jornada prevista' : 'Substitui a escala semanal'}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="shrink-0 text-right">
                        <button
                          type="button"
                          className="text-xs text-primary-600 hover:underline dark:text-primary-400"
                          disabled={salvando}
                          onClick={() => carregar(ex)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="ml-2 text-xs text-red-600 hover:underline dark:text-red-400"
                          disabled={salvando}
                          onClick={() => remover(ex.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {erro ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">
              {erro}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
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
  );
}
