import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCircle2, MessageSquarePlus, X, XCircle } from 'lucide-react';
import {
  addDoubleCheckInComparativoObservacao,
  saveDoubleCheckInComparativoDecisao,
  type DoubleCheckInCampoComparativo,
  type DoubleCheckInComparativoDecisao,
  type DoubleCheckInComparativoLinha,
  type DoubleCheckInComparativoObsHist,
  type DoubleCheckInJustificativaOpcao,
} from '../../api/compras';

const nfBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const nfNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 w-full';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

type CampoCfg = {
  id: DoubleCheckInCampoComparativo;
  label: string;
  divergKey: keyof DoubleCheckInComparativoLinha;
  kind: 'money' | 'qty' | 'text';
};

const CAMPOS: CampoCfg[] = [
  {
    id: 'valor_unitario',
    label: 'Vl. unitário (líq.)',
    divergKey: 'divergValorUnitario',
    kind: 'money',
  },
  {
    id: 'qtde',
    label: 'Quantidade',
    divergKey: 'divergQtde',
    kind: 'qty',
  },
  {
    id: 'ipi',
    label: 'IPI',
    divergKey: 'divergIpi',
    kind: 'money',
  },
  {
    id: 'condicao_pagamento',
    label: 'Cond. pagamento',
    divergKey: 'divergCondicaoPagamento',
    kind: 'text',
  },
];

function chaveDecisao(
  idItemDocumentoEstoque: number,
  idItemPedidoCompra: number,
  campo: string
): string {
  return `${idItemDocumentoEstoque}:${idItemPedidoCompra}:${campo}`;
}

function fmtCondicao(nome: string | null, regra: string | null): string {
  const n = (nome ?? '').trim() || '—';
  const r = (regra ?? '').trim();
  return r ? `${n} · ${r}` : n;
}

function descontoUnitario(descontoTotal: number, qtde: number): number {
  if (!(descontoTotal > 0)) return 0;
  if (!(qtde > 0)) return descontoTotal;
  return Math.round((descontoTotal / qtde + Number.EPSILON) * 100) / 100;
}

function fmtUnitarioLinha(
  liquido: number,
  bruto: number,
  descontoTotal: number,
  qtde: number
): { principal: string; detalhe: string | null } {
  if (descontoTotal > 0) {
    const descUn = descontoUnitario(descontoTotal, qtde);
    return {
      principal: `${nfBrl.format(liquido)} líq.`,
      detalhe: `bruto ${nfBrl.format(bruto)} · −desc. un. ${nfBrl.format(descUn)}`,
    };
  }
  return { principal: nfBrl.format(liquido), detalhe: null };
}

function valoresExibicao(
  linha: DoubleCheckInComparativoLinha,
  c: CampoCfg
): { nf: string; pc: string; nfDetalhe?: string | null; pcDetalhe?: string | null } {
  switch (c.id) {
    case 'valor_unitario': {
      const nf = fmtUnitarioLinha(
        linha.valorUnitarioNF,
        linha.valorUnitarioBrutoNF,
        linha.descontoNF,
        linha.qtdeNF
      );
      const pc = fmtUnitarioLinha(
        linha.valorUnitarioPC,
        linha.valorUnitarioBrutoPC,
        linha.descontoPC,
        linha.qtdePC
      );
      return { nf: nf.principal, pc: pc.principal, nfDetalhe: nf.detalhe, pcDetalhe: pc.detalhe };
    }
    case 'qtde':
      return {
        nf: `${nfNum.format(linha.qtdeNF)} ${linha.umNF ?? ''}`.trim(),
        pc: `${nfNum.format(linha.qtdePC)} ${linha.umPC ?? ''}`.trim(),
      };
    case 'ipi':
      return { nf: nfBrl.format(linha.valorIpiNF), pc: nfBrl.format(linha.valorIpiPC) };
    case 'condicao_pagamento':
      return {
        nf: fmtCondicao(linha.condicaoPagamentoNF, linha.regraPagamentoNF),
        pc: fmtCondicao(linha.condicaoPagamentoPC, linha.regraPagamentoPC),
      };
  }
}

function historicoDaDecisao(dec: DoubleCheckInComparativoDecisao | undefined): DoubleCheckInComparativoObsHist[] {
  if (!dec) return [];
  if (Array.isArray(dec.historicoObservacoes) && dec.historicoObservacoes.length > 0) {
    return dec.historicoObservacoes;
  }
  const legada = (dec.observacao ?? '').trim();
  if (!legada) return [];
  return [
    {
      id: 0,
      idDocumentoEstoque: dec.idDocumentoEstoque,
      idItemDocumentoEstoque: dec.idItemDocumentoEstoque,
      idItemPedidoCompra: dec.idItemPedidoCompra,
      campo: dec.campo,
      texto: legada,
      usuarioId: dec.usuarioId,
      usuarioLogin: dec.usuarioLogin,
      criadoEm: dec.atualizadoEm,
    },
  ];
}

function fmtDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

type DraftJustif = {
  linha: DoubleCheckInComparativoLinha;
  campo: DoubleCheckInCampoComparativo;
  decisao: 'aceita' | 'recusa';
};

type DraftObs = {
  linha: DoubleCheckInComparativoLinha;
  campo: DoubleCheckInCampoComparativo;
};

type Props = {
  idDocumento: number;
  conferido: boolean;
  linhas: DoubleCheckInComparativoLinha[];
  decisoes: DoubleCheckInComparativoDecisao[];
  justificativas: DoubleCheckInJustificativaOpcao[];
  loading: boolean;
  erro: string | null;
  onDecisoesChange: (next: DoubleCheckInComparativoDecisao[]) => void;
};

export function contarPendentesComparativo(
  linhas: DoubleCheckInComparativoLinha[],
  decisoes: DoubleCheckInComparativoDecisao[]
): number {
  const map = new Set(
    decisoes.map((d) => chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo))
  );
  let n = 0;
  for (const linha of linhas) {
    for (const c of CAMPOS) {
      if (linha[c.divergKey] && !map.has(chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, c.id))) {
        n += 1;
      }
    }
  }
  return n;
}

export default function DoubleCheckInComparativoPcTab({
  idDocumento,
  conferido,
  linhas,
  decisoes,
  justificativas,
  loading,
  erro,
  onDecisoesChange,
}: Props) {
  const [draft, setDraft] = useState<DraftJustif | null>(null);
  const [opcaoId, setOpcaoId] = useState<number | ''>('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [justErro, setJustErro] = useState<string | null>(null);

  const [draftObs, setDraftObs] = useState<DraftObs | null>(null);
  const [novaObs, setNovaObs] = useState('');
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [obsErro, setObsErro] = useState<string | null>(null);

  const decisaoMap = useMemo(() => {
    const m = new Map<string, DoubleCheckInComparativoDecisao>();
    for (const d of decisoes) {
      m.set(chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo), d);
    }
    return m;
  }, [decisoes]);

  const qtdeDiverg = useMemo(
    () => linhas.reduce((s, l) => s + (l.temDivergencia ? 1 : 0), 0),
    [linhas]
  );
  const pendentes = useMemo(
    () => contarPendentesComparativo(linhas, decisoes),
    [linhas, decisoes]
  );

  const abrirJustificativa = (
    linha: DoubleCheckInComparativoLinha,
    campo: DoubleCheckInCampoComparativo,
    decisao: 'aceita' | 'recusa'
  ) => {
    if (conferido) return;
    const existente = decisaoMap.get(
      chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, campo)
    );
    setDraft({ linha, campo, decisao });
    setOpcaoId(existente?.justificativaOpcaoId ?? '');
    setObs(existente?.observacao ?? '');
    setJustErro(null);
  };

  const abrirNovaObservacao = (
    linha: DoubleCheckInComparativoLinha,
    campo: DoubleCheckInCampoComparativo
  ) => {
    if (!conferido) return;
    setDraftObs({ linha, campo });
    setNovaObs('');
    setObsErro(null);
  };

  const salvarJustificativa = async () => {
    if (!draft) return;
    if (!opcaoId) {
      setJustErro('Selecione a justificativa.');
      return;
    }
    const opcao = justificativas.find((j) => j.id === opcaoId);
    if (opcao?.codigo === 'outros' && !obs.trim()) {
      setJustErro('Informe a observação quando a justificativa for "Outros".');
      return;
    }
    setSalvando(true);
    setJustErro(null);
    try {
      const r = await saveDoubleCheckInComparativoDecisao({
        idDocumento,
        idItemDocumentoEstoque: draft.linha.idItemDocumentoEstoque,
        idItemPedidoCompra: draft.linha.idItemPedidoCompra,
        campo: draft.campo,
        decisao: draft.decisao,
        justificativaOpcaoId: Number(opcaoId),
        observacao: obs.trim() || null,
      });
      if (r.erro || !r.decisao) {
        setJustErro(r.erro ?? 'Falha ao salvar.');
        return;
      }
      const key = chaveDecisao(
        r.decisao.idItemDocumentoEstoque,
        r.decisao.idItemPedidoCompra,
        r.decisao.campo
      );
      const next = [
        ...decisoes.filter(
          (d) => chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo) !== key
        ),
        r.decisao,
      ];
      onDecisoesChange(next);
      setDraft(null);
    } finally {
      setSalvando(false);
    }
  };

  const salvarNovaObservacao = async () => {
    if (!draftObs) return;
    if (!novaObs.trim()) {
      setObsErro('Informe a observação.');
      return;
    }
    setSalvandoObs(true);
    setObsErro(null);
    try {
      const r = await addDoubleCheckInComparativoObservacao({
        idDocumento,
        idItemDocumentoEstoque: draftObs.linha.idItemDocumentoEstoque,
        idItemPedidoCompra: draftObs.linha.idItemPedidoCompra,
        campo: draftObs.campo,
        texto: novaObs.trim(),
      });
      if (r.erro || !r.decisao) {
        setObsErro(r.erro ?? 'Falha ao salvar.');
        return;
      }
      const key = chaveDecisao(
        r.decisao.idItemDocumentoEstoque,
        r.decisao.idItemPedidoCompra,
        r.decisao.campo
      );
      const next = [
        ...decisoes.filter(
          (d) => chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo) !== key
        ),
        r.decisao,
      ];
      onDecisoesChange(next);
      setDraftObs(null);
    } finally {
      setSalvandoObs(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500 animate-pulse">Carregando comparativo NF × PC…</p>;
  }
  if (erro) {
    return (
      <p className="text-sm text-rose-600" role="alert">
        {erro}
      </p>
    );
  }
  if (linhas.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Nenhum vínculo item da NF × item de pedido de compra encontrado para este documento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {linhas.length} vínculo(s)
        </span>
        {qtdeDiverg > 0 ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {qtdeDiverg} com divergência
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            Sem divergências
          </span>
        )}
        {pendentes > 0 && (
          <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
            {pendentes} decisão(ões) pendente(s)
          </span>
        )}
      </div>

      <div className="space-y-3">
        {linhas.map((linha) => (
          <div
            key={`${linha.idItemDocumentoEstoque}-${linha.idItemPedidoCompra}`}
            className={`rounded-xl border px-3 py-3 ${
              linha.temDivergencia
                ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30'
                : 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800/40'
            }`}
          >
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-800 dark:text-slate-100">
                  {linha.codigoProduto ?? linha.idProduto ?? '—'}
                </div>
                <div className="text-xs text-slate-500 line-clamp-2">
                  {linha.descricaoProduto ?? '—'}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                <div className="font-medium text-slate-700 dark:text-slate-200">
                  {linha.nomePedidoCompra ?? (linha.idPedidoCompra != null ? `PC ${linha.idPedidoCompra}` : 'PC —')}
                </div>
                <div>Item NF #{linha.idItemDocumentoEstoque} · Item PC #{linha.idItemPedidoCompra}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {CAMPOS.map((c) => {
                const diverg = Boolean(linha[c.divergKey]);
                const vals = valoresExibicao(linha, c);
                const dec = decisaoMap.get(
                  chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, c.id)
                );
                const hist = historicoDaDecisao(dec);
                return (
                  <div
                    key={c.id}
                    className={`rounded-lg border px-2.5 py-2 ${
                      diverg
                        ? 'border-amber-400/80 bg-white dark:border-amber-600 dark:bg-slate-900/50'
                        : 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {c.label}
                      </span>
                      {!diverg ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="Igual" />
                      ) : dec?.decisao === 'aceita' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="Aceita" />
                      ) : dec?.decisao === 'recusa' ? (
                        <XCircle className="h-3.5 w-3.5 text-rose-600" aria-label="Recusada" />
                      ) : (
                        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          Pendente
                        </span>
                      )}
                    </div>
                    <div className={`space-y-0.5 text-xs ${c.kind === 'text' ? '' : 'tabular-nums'}`}>
                      <div className="flex justify-between gap-2">
                        <span className="shrink-0 text-slate-400">NF</span>
                        <span className="min-w-0 text-right">
                          <span
                            className="block font-medium text-slate-800 dark:text-slate-100 break-words"
                            title={vals.nf}
                          >
                            {vals.nf}
                          </span>
                          {vals.nfDetalhe ? (
                            <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                              {vals.nfDetalhe}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="shrink-0 text-slate-400">PC</span>
                        <span className="min-w-0 text-right">
                          <span
                            className="block font-medium text-slate-800 dark:text-slate-100 break-words"
                            title={vals.pc}
                          >
                            {vals.pc}
                          </span>
                          {vals.pcDetalhe ? (
                            <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                              {vals.pcDetalhe}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </div>
                    {diverg && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="truncate text-[10px] text-slate-500"
                            title={dec?.justificativaLabel ?? ''}
                          >
                            {dec
                              ? `${dec.decisao === 'aceita' ? 'Aceita' : 'Recusada'}: ${dec.justificativaLabel}`
                              : 'Divergente'}
                          </span>
                          {!conferido && (
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                title="Aceitar divergência"
                                className="rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                                onClick={() => abrirJustificativa(linha, c.id, 'aceita')}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Recusar divergência"
                                className="rounded p-1 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40"
                                onClick={() => abrirJustificativa(linha, c.id, 'recusa')}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        {(hist.length > 0 || (conferido && dec)) && (
                          <div className="space-y-1 rounded-md bg-slate-100/80 px-1.5 py-1 dark:bg-slate-800/80">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Histórico de observações
                              {hist.length > 0 ? ` (${hist.length})` : ''}
                            </div>
                            {hist.length === 0 ? (
                              <p className="text-[10px] text-slate-400">Nenhuma observação registrada ainda.</p>
                            ) : (
                              <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
                                {hist.map((h, idx) => (
                                  <li
                                    key={h.id > 0 ? h.id : `${h.criadoEm}-${idx}-${h.texto.slice(0, 12)}`}
                                    className="border-t border-slate-200/70 pt-1 first:border-0 first:pt-0 dark:border-slate-700/70"
                                  >
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[9px] text-slate-500 dark:text-slate-400">
                                      <span className="font-medium">{h.usuarioLogin || '—'}</span>
                                      <span>{h.criadoEm ? fmtDataHora(h.criadoEm) : ''}</span>
                                    </div>
                                    <p className="mt-0.5 text-[10px] leading-snug text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                                      {h.texto}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {conferido && dec && (
                          <button
                            type="button"
                            className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => abrirNovaObservacao(linha, c.id)}
                          >
                            <MessageSquarePlus className="h-3 w-3" aria-hidden />
                            Nova observação
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {draft &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10070] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => !salvando && setDraft(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Justificativa da divergência
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {draft.decisao === 'aceita' ? 'Aceitar' : 'Recusar'} ·{' '}
                {CAMPOS.find((c) => c.id === draft.campo)?.label} ·{' '}
                {draft.linha.codigoProduto ?? draft.linha.idProduto}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelClass}>Justificativa</label>
                  <select
                    className={inputClass}
                    value={opcaoId === '' ? '' : String(opcaoId)}
                    onChange={(e) => setOpcaoId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Selecione…</option>
                    {justificativas.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Observações</label>
                  <textarea
                    className={`${inputClass} min-h-[5rem]`}
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Obrigatório se a justificativa for Outros"
                  />
                </div>
                {justErro && <p className="text-sm text-rose-600">{justErro}</p>}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={salvando}
                  onClick={() => setDraft(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={salvando || !opcaoId}
                  onClick={() => void salvarJustificativa()}
                >
                  {salvando ? 'Salvando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {draftObs &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10070] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => !salvandoObs && setDraftObs(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Nova observação
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {CAMPOS.find((c) => c.id === draftObs.campo)?.label} ·{' '}
                {draftObs.linha.codigoProduto ?? draftObs.linha.idProduto}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                A observação será acrescentada ao histórico desta divergência (a decisão não muda).
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelClass}>Observação</label>
                  <textarea
                    className={`${inputClass} min-h-[6rem]`}
                    value={novaObs}
                    onChange={(e) => setNovaObs(e.target.value)}
                    placeholder="Descreva o acompanhamento…"
                    autoFocus
                  />
                </div>
                {obsErro && <p className="text-sm text-rose-600">{obsErro}</p>}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={salvandoObs}
                  onClick={() => setDraftObs(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={salvandoObs || !novaObs.trim()}
                  onClick={() => void salvarNovaObservacao()}
                >
                  {salvandoObs ? 'Salvando…' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
