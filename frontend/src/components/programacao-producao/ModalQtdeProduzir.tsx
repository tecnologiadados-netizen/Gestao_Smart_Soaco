import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  LinhaProgramacaoProducao,
  ProgramacaoProducaoRecurso,
  QtdeProduzir,
  RoteiroProducao,
} from './types';
import { QTDE_PRODUZIR_VAZIO, formatNum, numInputDisplayBranco, parseNumInputBranco } from './programacaoProducaoCalculos';
import {
  aplicarCatalogoProgramacaoProducao,
  getCatalogoRecursosRuntime,
  patchCatalogoMedidasPecaRuntime,
  patchCatalogoRecursosRuntime,
} from '../../utils/programacaoProducaoCatalogoRuntime';
import {
  migrarQtdeProduzirLegado,
  roteiroTemRecursoManual,
  textoRoteiroComQtde,
  validarQtdeProduzirModal,
} from '../../utils/programacaoProducaoRoteiros';
import { medidasPecaDoCatalogo } from '../../utils/programacaoProducaoMedidasPeca';
import {
  createProgramacaoProducaoRecurso,
  fetchProgramacaoProducaoCatalogo,
  listProgramacaoProducaoRecursos,
  saveCatalogoMedidasPecaProgramacao,
} from '../../api/programacaoProducao';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-1.5 text-sm';
const BTN_ICON =
  'p-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 text-xs shrink-0';

const INPUT_UNIT_WRAP =
  'flex mt-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 overflow-hidden';
const INPUT_UNIT_FIELD =
  'flex-1 min-w-0 border-0 bg-transparent text-slate-800 dark:text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-0';
const INPUT_UNIT_SUFFIX =
  'px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 shrink-0';

function cloneRoteiros(q: QtdeProduzir): RoteiroProducao[] {
  return q.roteiros.map((r) => ({
    sequencia: [...r.sequencia],
    qtde: r.qtde,
    chapa: r.chapa ?? null,
  }));
}

function roteiroVazio(): RoteiroProducao {
  return { sequencia: [], qtde: 0 };
}

function parseMedidaInput(v: string): number | '' {
  const t = v.trim().replace(',', '.');
  if (!t) return '';
  const n = Number(t);
  return Number.isFinite(n) ? n : '';
}

function medidaParaSalvar(v: number | ''): number | null {
  if (v === '' || v === 0) return null;
  return v;
}

function medidaCatalogoParaInput(v: number | null | undefined): number | '' {
  if (v == null || !Number.isFinite(v) || v === 0) return '';
  return v;
}

type ModalBaseProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
};

function ModalBase({ title, subtitle, onClose, footer, children }: ModalBaseProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">{children}</div>
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          {footer}
        </div>
      </div>
    </div>
  );
}

export default function ModalQtdeProduzir({
  linha,
  readOnly,
  onClose,
  onSave,
}: {
  linha: LinhaProgramacaoProducao;
  readOnly: boolean;
  onClose: () => void;
  onSave: (v: QtdeProduzir) => void;
}) {
  const inicial = useMemo(
    () => migrarQtdeProduzirLegado(linha.qtde_produzir ?? QTDE_PRODUZIR_VAZIO),
    [linha.qtde_produzir]
  );
  const [roteiros, setRoteiros] = useState<RoteiroProducao[]>(() => {
    const r = cloneRoteiros(inicial);
    return r.length ? r : [roteiroVazio()];
  });
  const [erro, setErro] = useState<string | null>(null);
  const [listaRecursos, setListaRecursos] = useState<ProgramacaoProducaoRecurso[]>(
    () => getCatalogoRecursosRuntime() ?? []
  );
  const [novoRecursoParaRoteiro, setNovoRecursoParaRoteiro] = useState<number | null>(null);
  const [nomeNovoRecurso, setNomeNovoRecurso] = useState('');
  const [salvandoRecurso, setSalvandoRecurso] = useState(false);
  const [erroNovoRecurso, setErroNovoRecurso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [med1, setMed1] = useState<number | ''>('');
  const [med2, setMed2] = useState<number | ''>('');
  const medidasEditadasRef = useRef(false);

  const aplicarMedidasDoCatalogo = useCallback((cod: string) => {
    const cat = medidasPecaDoCatalogo(cod);
    setMed1(medidaCatalogoParaInput(cat?.med1));
    setMed2(medidaCatalogoParaInput(cat?.med2));
  }, []);

  useEffect(() => {
    const r = cloneRoteiros(migrarQtdeProduzirLegado(linha.qtde_produzir ?? QTDE_PRODUZIR_VAZIO));
    setRoteiros(r.length ? r : [roteiroVazio()]);
    setErro(null);
  }, [linha.cod_componente, linha.qtde_produzir]);

  useEffect(() => {
    medidasEditadasRef.current = false;
    aplicarMedidasDoCatalogo(linha.cod_componente);
    let cancelled = false;
    void fetchProgramacaoProducaoCatalogo()
      .then((data) => {
        if (cancelled) return;
        aplicarCatalogoProgramacaoProducao(data);
        if (!medidasEditadasRef.current) {
          aplicarMedidasDoCatalogo(linha.cod_componente);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [linha.cod_componente, aplicarMedidasDoCatalogo]);

  const recarregarRecursos = useCallback(async () => {
    const lista = await listProgramacaoProducaoRecursos();
    patchCatalogoRecursosRuntime(lista);
    setListaRecursos(lista);
    return lista;
  }, []);

  useEffect(() => {
    if (listaRecursos.length) return;
    void recarregarRecursos().catch(() => {});
  }, [listaRecursos.length, recarregarRecursos]);

  const soma = useMemo(() => roteiros.reduce((s, r) => s + (r.qtde > 0 ? r.qtde : 0), 0), [roteiros]);

  const algumRoteiroManual = useMemo(
    () => roteiros.some((r) => roteiroTemRecursoManual(r, listaRecursos)),
    [roteiros, listaRecursos]
  );

  const primeiroRoteiroManualIdx = useMemo(
    () => roteiros.findIndex((r) => roteiroTemRecursoManual(r, listaRecursos)),
    [roteiros, listaRecursos]
  );

  const atualizarRoteiro = useCallback((idx: number, patch: Partial<RoteiroProducao>) => {
    setRoteiros((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setErro(null);
  }, []);

  const adicionarPasso = (idx: number, cod: string) => {
    if (!cod.trim()) return;
    setRoteiros((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, sequencia: [...r.sequencia, cod.trim()] } : r
      )
    );
    setErro(null);
  };

  const removerPasso = (idx: number, passoIdx: number) => {
    setRoteiros((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, sequencia: r.sequencia.filter((_, j) => j !== passoIdx) } : r
      )
    );
  };

  const moverPasso = (idx: number, passoIdx: number, dir: -1 | 1) => {
    setRoteiros((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = [...r.sequencia];
        const j = passoIdx + dir;
        if (j < 0 || j >= next.length) return r;
        [next[passoIdx], next[j]] = [next[j]!, next[passoIdx]!];
        return { ...r, sequencia: next };
      })
    );
  };

  const adicionarRoteiro = () => {
    setRoteiros((prev) => [...prev, roteiroVazio()]);
  };

  const removerRoteiro = (idx: number) => {
    setRoteiros((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [roteiroVazio()];
    });
  };

  const aplicar = async () => {
    const limpos = roteiros
      .map((r) => ({
        sequencia: r.sequencia.filter(Boolean),
        qtde: r.qtde,
        chapa: r.chapa?.trim() ? r.chapa.trim() : null,
      }))
      .filter((r) => r.sequencia.length > 0 || r.qtde > 0);
    const payload: QtdeProduzir = { roteiros: limpos };
    const err = validarQtdeProduzirModal(payload);
    if (err) {
      setErro(err);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      if (!readOnly && algumRoteiroManual) {
        const medidas = {
          med1: medidaParaSalvar(med1),
          med2: medidaParaSalvar(med2),
        };
        const medidasPeca = await saveCatalogoMedidasPecaProgramacao(linha.cod_componente, medidas);
        patchCatalogoMedidasPecaRuntime(linha.cod_componente, medidas);
        aplicarCatalogoProgramacaoProducao({ medidasPeca });
      }
      onSave(payload);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const subtitleQtde = [linha.cod_componente, linha.descricao_simplificada?.trim()]
    .filter(Boolean)
    .join(' — ');

  const abrirNovoRecurso = (roteiroIdx: number) => {
    setNovoRecursoParaRoteiro(roteiroIdx);
    setNomeNovoRecurso('');
    setErroNovoRecurso(null);
  };

  const salvarNovoRecurso = async () => {
    const roteiroIdx = novoRecursoParaRoteiro;
    if (roteiroIdx == null) return;
    setSalvandoRecurso(true);
    setErroNovoRecurso(null);
    try {
      const criado = await createProgramacaoProducaoRecurso(nomeNovoRecurso);
      await recarregarRecursos();
      adicionarPasso(roteiroIdx, criado.cod);
      setNovoRecursoParaRoteiro(null);
      setNomeNovoRecurso('');
    } catch (e) {
      setErroNovoRecurso(e instanceof Error ? e.message : 'Erro ao criar recurso.');
    } finally {
      setSalvandoRecurso(false);
    }
  };

  return (
    <ModalBase
      title="Qtde produzir"
      subtitle={subtitleQtde || linha.cod_componente}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            Cancelar
          </button>
          {!readOnly && (
            <button type="button" className={BTN_PRIMARY} disabled={salvando} onClick={() => void aplicar()}>
              {salvando ? 'Salvando…' : 'Aplicar'}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {listaRecursos.length === 0 && !readOnly && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Cadastre recursos em PCP → Programação → Configuração → Recursos ou use &quot;Novo recurso&quot; abaixo.
          </p>
        )}
        {roteiros.map((rot, idx) => {
          const exibirCamposManual = roteiroTemRecursoManual(rot, listaRecursos);
          return (
          <div
            key={idx}
            className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Roteiro {idx + 1}
              </span>
              {!readOnly && roteiros.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                  onClick={() => removerRoteiro(idx)}
                >
                  Remover roteiro
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1 min-h-[2rem]">
              {rot.sequencia.length === 0 && (
                <span className="text-xs text-slate-400 italic">Adicione recursos na sequência</span>
              )}
              {rot.sequencia.map((cod, pi) => {
                const nome = listaRecursos.find((r) => r.cod === cod)?.nome ?? cod;
                return (
                  <span key={`${idx}-${pi}-${cod}`} className="inline-flex items-center gap-0.5">
                    {pi > 0 && (
                      <span className="text-slate-400 text-xs px-0.5" aria-hidden>
                        →
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-800 dark:text-slate-100">
                      {nome}
                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            className={BTN_ICON}
                            title="Mover para esquerda"
                            disabled={pi === 0}
                            onClick={() => moverPasso(idx, pi, -1)}
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            className={BTN_ICON}
                            title="Remover passo"
                            onClick={() => removerPasso(idx, pi)}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </span>
                  </span>
                );
              })}
            </div>
            {!readOnly && (
              <div className="flex flex-wrap items-end gap-2">
                {listaRecursos.length > 0 && (
                  <label className="flex-1 min-w-[8rem]">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Adicionar recurso
                    </span>
                    <select
                      className={`${INPUT} mt-1`}
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) {
                          adicionarPasso(idx, v);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">Selecione…</option>
                      {listaRecursos.map((r) => (
                        <option key={r.cod} value={r.cod}>
                          {r.cod} — {r.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className={`${BTN_SECONDARY} mt-5 shrink-0`}
                  onClick={() => abrirNovoRecurso(idx)}
                >
                  + Novo recurso
                </button>
              </div>
            )}
            <label className="block max-w-[12rem]">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Qtde</span>
              <input
                type="number"
                min={0}
                step="any"
                disabled={readOnly}
                className={`${INPUT} mt-1`}
                value={rot.qtde === 0 ? '' : rot.qtde}
                onChange={(e) =>
                  atualizarRoteiro(idx, { qtde: parseNumInputBranco(e.target.value) })
                }
              />
            </label>
            {exibirCamposManual && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Peça
                </p>
                {idx === primeiroRoteiroManualIdx && (
                  <div className="flex flex-wrap gap-3">
                    <p className="w-full text-[11px] text-slate-500 dark:text-slate-400">
                      Medidas cadastradas para este produto são preenchidas automaticamente e podem ser alteradas.
                    </p>
                    <label className="block min-w-[8rem] flex-1 max-w-[10rem]">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Med. 1</span>
                      <div className={INPUT_UNIT_WRAP}>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          disabled={readOnly}
                          className={INPUT_UNIT_FIELD}
                          value={med1 === '' ? '' : numInputDisplayBranco(med1)}
                          onChange={(e) => {
                            medidasEditadasRef.current = true;
                            setMed1(parseMedidaInput(e.target.value));
                          }}
                        />
                        <span className={INPUT_UNIT_SUFFIX}>mm</span>
                      </div>
                    </label>
                    <label className="block min-w-[8rem] flex-1 max-w-[10rem]">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Med. 2</span>
                      <div className={INPUT_UNIT_WRAP}>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          disabled={readOnly}
                          className={INPUT_UNIT_FIELD}
                          value={med2 === '' ? '' : numInputDisplayBranco(med2)}
                          onChange={(e) => {
                            medidasEditadasRef.current = true;
                            setMed2(parseMedidaInput(e.target.value));
                          }}
                        />
                        <span className={INPUT_UNIT_SUFFIX}>mm</span>
                      </div>
                    </label>
                  </div>
                )}
                <label className="block max-w-md">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chapa</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    className={`${INPUT} mt-1`}
                    value={rot.chapa ?? ''}
                    onChange={(e) => atualizarRoteiro(idx, { chapa: e.target.value })}
                    placeholder="Informe a chapa"
                  />
                </label>
              </div>
            )}
            {readOnly && rot.sequencia.length > 0 && (
              <p className="text-xs text-slate-500">
                {textoRoteiroComQtde(rot, listaRecursos, formatNum)}
                {idx === primeiroRoteiroManualIdx && (med1 !== '' || med2 !== '') && (
                  <span>
                    {' '}
                    · Med. 1: {med1 === '' ? '—' : formatNum(med1)} mm · Med. 2:{' '}
                    {med2 === '' ? '—' : formatNum(med2)} mm
                  </span>
                )}
                {rot.chapa?.trim() ? ` · Chapa: ${rot.chapa.trim()}` : ''}
              </p>
            )}
          </div>
        );
        })}
        {!readOnly && (
          <button
            type="button"
            className="text-sm text-primary-600 hover:underline dark:text-primary-400 self-start"
            onClick={adicionarRoteiro}
          >
            + Novo roteiro
          </button>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-2">
          Total na grade: <strong className="tabular-nums">{formatNum(soma)}</strong>
          {roteiros.length > 1 && (
            <span className="ml-2">(soma dos roteiros)</span>
          )}
        </p>
        {erro && (
          <p className="text-sm text-red-600 dark:text-red-300" role="alert">
            {erro}
          </p>
        )}
        {readOnly && roteiros.every((r) => !r.sequencia.length) && (
          <p className="text-sm text-slate-500">Nenhum roteiro definido.</p>
        )}
      </div>

      {novoRecursoParaRoteiro != null && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4"
          role="presentation"
          onClick={() => !salvandoRecurso && setNovoRecursoParaRoteiro(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pp-novo-recurso-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="pp-novo-recurso-title"
              className="text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              Novo recurso (atalho)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              O recurso será adicionado ao roteiro {novoRecursoParaRoteiro + 1} após salvar.
            </p>
            <label className="block mt-3">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Nome</span>
              <input
                className={`${INPUT} mt-1`}
                value={nomeNovoRecurso}
                disabled={salvandoRecurso}
                autoFocus
                onChange={(e) => setNomeNovoRecurso(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nomeNovoRecurso.trim()) void salvarNovoRecurso();
                }}
              />
            </label>
            {erroNovoRecurso && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300" role="alert">
                {erroNovoRecurso}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={salvandoRecurso}
                onClick={() => setNovoRecursoParaRoteiro(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={salvandoRecurso || !nomeNovoRecurso.trim()}
                onClick={() => void salvarNovoRecurso()}
              >
                {salvandoRecurso ? 'Salvando…' : 'Criar e adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalBase>
  );
}
