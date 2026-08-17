import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type {
  DemandaCalendarioMateriais,
  HorizonteDiaCalendario,
  OrigemConsumoCalendario,
} from '../../api/sequenciamentoCarradas';
import {
  consultarDisponibilidadeMateriaisItem,
  obterPcPendCongelado,
} from '../../api/sequenciamentoCarradas';
import type { RessupAlmoxPcPendLinha } from '../../api/compras';
import { formatDataCurta } from './simulacaoCarradas';
import CalendarioOrigemConsumoModal from './CalendarioOrigemConsumoModal';
import GradeCelulaModalBtn from '../pcp/GradeCelulaModalBtn';
import ModalPcPendDetalhes from '../ressupAlmox/ModalPcPendDetalhes';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const TH =
  'px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap bg-slate-50 dark:bg-slate-900';
const TD = 'px-2 py-1.5 border-b border-slate-100 dark:border-slate-700';

/** Igual ao calendário: gap ≥5 dias sem movimento vira linha "...". */
const GAP_OCIOSO_MIN_DIAS = 5;

type HorizonteCache = {
  idProduto: number;
  codigo: string;
  descricao: string;
  saldoInicial: number;
  dias: HorizonteDiaCalendario[];
  origens: OrigemConsumoCalendario[];
};

/** Linha do horizonte com saldo início/projetado em carry livre (pode ser negativo). */
export type HorizonteLinhaDia = {
  tipo: 'dia';
  data: string;
  consumo: number;
  entrada: number;
  saldoInicio: number;
  saldoProjetado: number;
};

export type HorizonteLinhaOciosa = {
  tipo: 'ocioso';
  /** Data do último dia com movimento antes do gap. */
  de: string;
  /** Data do próximo dia com movimento após o gap. */
  ate: string;
  saldoInicio: number;
  saldoProjetado: number;
};

export type HorizonteLinhaExibicao = HorizonteLinhaDia | HorizonteLinhaOciosa;

function temMovimento(consumo: number, entrada: number): boolean {
  return consumo > 0 || entrada > 0;
}

/**
 * Carry de exibição: saldo projetado do dia vira saldo início do seguinte (sem floor em 0).
 * Não altera o motor de falta/semáforo do backend.
 */
export function montarLinhasHorizonteComCarry(
  dias: HorizonteDiaCalendario[],
  saldoInicial: number
): HorizonteLinhaDia[] {
  const out: HorizonteLinhaDia[] = [];
  let saldo = Number.isFinite(saldoInicial) ? saldoInicial : 0;
  for (const d of dias) {
    const saldoInicio = Math.round(saldo * 100) / 100;
    const saldoProjetado =
      Math.round((saldoInicio - d.consumo + d.entrada) * 100) / 100;
    out.push({
      tipo: 'dia',
      data: d.data,
      consumo: d.consumo,
      entrada: d.entrada,
      saldoInicio,
      saldoProjetado,
    });
    saldo = saldoProjetado;
  }
  return out;
}

/**
 * Trunca na última data com consumo/entrada, remove dias antes da 1ª com movimento
 * e colapsa gaps longos (≥5 dias) em uma linha ociosa — espelha `montarEixoDatasCalendario`.
 */
export function compactarLinhasHorizonte(linhas: HorizonteLinhaDia[]): HorizonteLinhaExibicao[] {
  const idxsMovimento: number[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]!;
    if (temMovimento(l.consumo, l.entrada)) idxsMovimento.push(i);
  }
  if (idxsMovimento.length === 0) return [];

  const out: HorizonteLinhaExibicao[] = [];
  for (let a = 0; a < idxsMovimento.length; a++) {
    const idx = idxsMovimento[a]!;
    const atual = linhas[idx]!;
    if (a === 0) {
      out.push(atual);
      continue;
    }
    const prevIdx = idxsMovimento[a - 1]!;
    const gapDias = idx - prevIdx - 1;
    if (gapDias >= GAP_OCIOSO_MIN_DIAS) {
      const primeiroVazio = linhas[prevIdx + 1]!;
      const ultimoVazio = linhas[idx - 1]!;
      out.push({
        tipo: 'ocioso',
        de: linhas[prevIdx]!.data,
        ate: atual.data,
        saldoInicio: primeiroVazio.saldoInicio,
        saldoProjetado: ultimoVazio.saldoProjetado,
      });
    } else if (gapDias > 0) {
      for (let j = prevIdx + 1; j < idx; j++) {
        out.push(linhas[j]!);
      }
    }
    out.push(atual);
  }
  return out;
}

function classSaldoProjetado(saldoProj: number): string {
  if (saldoProj <= 0) return 'bg-red-50 dark:bg-red-950/30';
  return '';
}

export type CalendarioMaterialHorizonteModalProps = {
  open: boolean;
  codigo: string;
  idProdutoHint?: number | null;
  descricaoHint?: string;
  demanda: DemandaCalendarioMateriais[];
  onClose: () => void;
  cacheRef: MutableRefObject<Map<string, HorizonteCache>>;
  /** Snapshot da sequência: calcula e detalha PCs a partir da base congelada. */
  snapshotId?: number | null;
};

export default function CalendarioMaterialHorizonteModal({
  open,
  codigo,
  idProdutoHint,
  descricaoHint,
  demanda,
  onClose,
  cacheRef,
  snapshotId,
}: CalendarioMaterialHorizonteModalProps) {
  const [dados, setDados] = useState<HorizonteCache | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pcOpen, setPcOpen] = useState(false);
  const [origemData, setOrigemData] = useState<string | null>(null);

  useRegisterModalEscape({
    id: 'calendario-material-horizonte',
    onClose: () => {
      if (pcOpen) {
        setPcOpen(false);
        return;
      }
      if (origemData) {
        setOrigemData(null);
        return;
      }
      onClose();
    },
    zIndex: 14200,
    enabled: open,
  });

  useEffect(() => {
    if (!open || !codigo) {
      setDados(null);
      setErro(null);
      setCarregando(false);
      setPcOpen(false);
      setOrigemData(null);
      return;
    }
    const cached = cacheRef.current.get(codigo);
    if (cached) {
      setDados(cached);
      setErro(null);
      setCarregando(false);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    setErro(null);
    void consultarDisponibilidadeMateriaisItem(demanda, codigo, { snapshotId }).then((r) => {
      if (cancelled) return;
      setCarregando(false);
      if (r.error || !r.data) {
        setErro(r.error ?? 'Falha ao carregar horizonte.');
        setDados(null);
        return;
      }
      const payload: HorizonteCache = {
        idProduto: r.data.idProduto,
        codigo: r.data.codigo,
        descricao: r.data.descricao,
        saldoInicial: r.data.saldoInicial,
        dias: r.data.dias,
        origens: r.data.origens,
      };
      cacheRef.current.set(codigo, payload);
      setDados(payload);
    });
    return () => {
      cancelled = true;
    };
  }, [open, codigo, demanda, cacheRef, snapshotId]);

  const origensFiltradas = useMemo(() => {
    if (!dados || !origemData) return [];
    return dados.origens.filter((o) => o.dataIso === origemData);
  }, [dados, origemData]);

  /** Em snapshot os PCs saem da base congelada; sem snapshot mantém o endpoint ao vivo. */
  const fetchPcPendCongelado = useCallback(
    (id: number): Promise<{ data: RessupAlmoxPcPendLinha[]; error?: string }> =>
      obterPcPendCongelado(snapshotId!, id),
    [snapshotId]
  );

  const linhasHorizonte = useMemo(() => {
    if (!dados) return [];
    return compactarLinhasHorizonte(montarLinhasHorizonteComCarry(dados.dias, dados.saldoInicial));
  }, [dados]);

  if (!open) return null;

  const idProduto = dados?.idProduto ?? idProdutoHint ?? null;
  const descricao = dados?.descricao || descricaoHint || '';

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[14200] flex items-center justify-center bg-black/60 p-4"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="flex max-h-[min(90vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
          role="dialog"
          aria-modal
          aria-labelledby="calendario-material-horizonte-titulo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
            <div>
              <h2
                id="calendario-material-horizonte-titulo"
                className="text-lg font-semibold text-slate-800 dark:text-slate-100"
              >
                Horizonte · {codigo}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {descricao || '—'}
                {dados ? ` · Saldo almox secundário: ${fmtNum(dados.saldoInicial)}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Saldo projetado = Saldo início − Consumo + Entrada PC (o projetado vira início do
                dia seguinte). Clique em <strong>Consumo</strong> para PAs/pedidos; em{' '}
                <strong>Entrada</strong> para PCs.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {carregando && (
              <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Carregando horizonte…</p>
            )}
            {erro && <p className="p-4 text-sm text-red-600 dark:text-red-400">{erro}</p>}
            {!carregando && !erro && dados && linhasHorizonte.length === 0 && (
              <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
                Sem consumo nem entrada PC no horizonte deste material.
              </p>
            )}
            {!carregando && !erro && dados && linhasHorizonte.length > 0 && (
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)]">
                  <tr className="border-b border-slate-200 dark:border-slate-600">
                    <th className={`${TH} text-left`}>Data</th>
                    <th className={`${TH} text-right`}>Saldo início</th>
                    <th className={`${TH} text-right`}>Consumo</th>
                    <th className={`${TH} text-right`}>Entrada PC</th>
                    <th className={`${TH} text-right`}>Saldo Projetado</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasHorizonte.map((row) => {
                    if (row.tipo === 'ocioso') {
                      const titulo = `Período sem movimento (${formatDataCurta(row.de)} – ${formatDataCurta(row.ate)})`;
                      return (
                        <tr
                          key={`ocioso:${row.de}:${row.ate}`}
                          className="bg-slate-50/80 dark:bg-slate-900/40"
                          title={titulo}
                        >
                          <td className={`${TD} text-center text-slate-400 dark:text-slate-500`}>
                            …
                          </td>
                          <td className={`${TD} text-right tabular-nums text-slate-400`}>
                            {fmtNum(row.saldoInicio)}
                          </td>
                          <td className={`${TD} text-center text-slate-300 dark:text-slate-600`}>—</td>
                          <td className={`${TD} text-center text-slate-300 dark:text-slate-600`}>—</td>
                          <td className={`${TD} text-right tabular-nums text-slate-400`}>
                            {fmtNum(row.saldoProjetado)}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={row.data} className={classSaldoProjetado(row.saldoProjetado)}>
                        <td className={TD}>{formatDataCurta(row.data)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{fmtNum(row.saldoInicio)}</td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {row.consumo > 0 ? (
                            <GradeCelulaModalBtn
                              onClick={() => setOrigemData(row.data)}
                              title="Ver origem do consumo"
                              align="right"
                            >
                              {fmtNum(row.consumo)}
                            </GradeCelulaModalBtn>
                          ) : (
                            fmtNum(row.consumo)
                          )}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {row.entrada > 0 && idProduto != null ? (
                            <GradeCelulaModalBtn
                              onClick={() => setPcOpen(true)}
                              title="Ver pedidos de compra"
                              align="right"
                            >
                              {fmtNum(row.entrada)}
                            </GradeCelulaModalBtn>
                          ) : (
                            fmtNum(row.entrada)
                          )}
                        </td>
                        <td className={`${TD} text-right tabular-nums font-medium`}>
                          {fmtNum(row.saldoProjetado)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {origemData && (
        <CalendarioOrigemConsumoModal
          dataIso={origemData}
          origens={origensFiltradas}
          codigo={codigo}
          onClose={() => setOrigemData(null)}
          zIndex={14250}
        />
      )}

      {pcOpen && idProduto != null && (
        <ModalPcPendDetalhes
          open
          idProduto={idProduto}
          codigo={codigo}
          descricao={descricao}
          onClose={() => setPcOpen(false)}
          fetchDetalhes={snapshotId != null ? fetchPcPendCongelado : undefined}
        />
      )}
    </>,
    document.body
  );
}
