import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type {
  DemandaCalendarioMateriais,
  HorizonteDiaCalendario,
  HorizontePcLinhaCalendario,
  OrigemConsumoCalendario,
} from '../../api/sequenciamentoCarradas';
import {
  consultarDisponibilidadeMateriaisItem,
  obterPcPendCongelado,
} from '../../api/sequenciamentoCarradas';
import { obterRessupAlmoxPcPendDetalhes, type RessupAlmoxPcPendLinha } from '../../api/compras';
import {
  classificarPedidoCompraCascata,
  hojeIsoLocal,
} from '../ressupAlmox/empenhoModalUtils';
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
  hoje: string;
  pcLinhas: HorizontePcLinhaCalendario[];
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

/**
 * Tira da Entrada PC os pedidos excluídos pelos toggles e mantém o dia em que o motor
 * os colocou (atrasado ou sem data → hoje; antes do eixo → primeiro dia).
 * Com os dois toggles em Sim, a entrada do backend permanece igual.
 */
export function ajustarEntradaHorizonte<T extends { data: string; entrada: number }>(
  dias: T[],
  pcLinhas: HorizontePcLinhaCalendario[],
  opts: { considerarAtraso: boolean; considerarAReceber: boolean; hojeIso: string }
): T[] {
  if (opts.considerarAtraso && opts.considerarAReceber) return dias;
  if (dias.length === 0) return dias;
  const datas = new Set(dias.map((d) => d.data));
  const primeiro = dias[0]!.data;
  const desconto = new Map<string, number>();
  for (const l of pcLinhas) {
    const ref = l.dataEntregaExibicao === undefined ? l.dataEntrega : l.dataEntregaExibicao;
    const classe = classificarPedidoCompraCascata(ref, opts.hojeIso);
    const inclui = classe === 'atraso' ? opts.considerarAtraso : opts.considerarAReceber;
    if (inclui) continue;
    const qtde = Number(l.qtde) || 0;
    if (qtde <= 0) continue;
    let dia = l.dataEntrega;
    if (!datas.has(dia)) {
      if (dia < primeiro) dia = primeiro;
      else continue;
    }
    desconto.set(dia, Math.round(((desconto.get(dia) ?? 0) + qtde) * 100) / 100);
  }
  if (desconto.size === 0) return dias;
  return dias.map((d) => {
    const menos = desconto.get(d.data) ?? 0;
    if (!menos) return d;
    return { ...d, entrada: Math.max(0, Math.round((d.entrada - menos) * 100) / 100) };
  });
}

function pcPassaToggle(
  dataEntrega: string | null,
  hojeIso: string,
  considerarAtraso: boolean,
  considerarAReceber: boolean
): boolean {
  const classe = classificarPedidoCompraCascata(dataEntrega, hojeIso);
  return classe === 'atraso' ? considerarAtraso : considerarAReceber;
}

function ToggleSimNao({
  ligado,
  onChange,
  rotulo,
}: {
  ligado: boolean;
  onChange: (valor: boolean) => void;
  rotulo: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={rotulo}
        onClick={() => onChange(!ligado)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          ligado ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
            ligado ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-xs font-medium leading-snug text-slate-700 dark:text-slate-200">{rotulo}</span>
    </div>
  );
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
  metodosRessup?: string[];
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
  metodosRessup,
}: CalendarioMaterialHorizonteModalProps) {
  const [dados, setDados] = useState<HorizonteCache | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pcOpen, setPcOpen] = useState(false);
  const [origemData, setOrigemData] = useState<string | null>(null);
  const [considerarPcAtraso, setConsiderarPcAtraso] = useState(true);
  const [considerarPcAReceber, setConsiderarPcAReceber] = useState(true);

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
    if (!open) return;
    setConsiderarPcAtraso(true);
    setConsiderarPcAReceber(true);
  }, [open, codigo]);

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
    if (cached && Array.isArray(cached.pcLinhas) && cached.hoje) {
      setDados(cached);
      setErro(null);
      setCarregando(false);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    setErro(null);
    void consultarDisponibilidadeMateriaisItem(demanda, codigo, {
      snapshotId,
      metodosRessup,
    }).then((r) => {
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
        hoje: r.data.hoje,
        pcLinhas: r.data.pcLinhas,
      };
      cacheRef.current.set(codigo, payload);
      setDados(payload);
    });
    return () => {
      cancelled = true;
    };
  }, [open, codigo, demanda, cacheRef, snapshotId, metodosRessup]);

  const origensFiltradas = useMemo(() => {
    if (!dados || !origemData) return [];
    return dados.origens.filter((o) => o.dataIso === origemData);
  }, [dados, origemData]);

  const hojeReferencia = dados?.hoje || hojeIsoLocal();

  const linhasHorizonte = useMemo(() => {
    if (!dados) return [];
    const dias = ajustarEntradaHorizonte(dados.dias, dados.pcLinhas ?? [], {
      considerarAtraso: considerarPcAtraso,
      considerarAReceber: considerarPcAReceber,
      hojeIso: dados.hoje || hojeIsoLocal(),
    });
    return compactarLinhasHorizonte(montarLinhasHorizonteComCarry(dias, dados.saldoInicial));
  }, [dados, considerarPcAtraso, considerarPcAReceber]);

  const fetchPcFiltrado = useCallback(
    async (id: number): Promise<{ data: RessupAlmoxPcPendLinha[]; error?: string }> => {
      const r =
        snapshotId != null
          ? await obterPcPendCongelado(snapshotId, id)
          : await obterRessupAlmoxPcPendDetalhes(id);
      if (r.error) return r;
      const hoje = hojeReferencia;
      return {
        data: r.data.filter((l) =>
          pcPassaToggle(l.dataEntrega, hoje, considerarPcAtraso, considerarPcAReceber)
        ),
      };
    },
    [snapshotId, hojeReferencia, considerarPcAtraso, considerarPcAReceber]
  );

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
            <div className="min-w-0 flex-1">
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
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
                <ToggleSimNao
                  ligado={considerarPcAtraso}
                  onChange={setConsiderarPcAtraso}
                  rotulo="Considerar Pedidos de compra em atraso?"
                />
                <ToggleSimNao
                  ligado={considerarPcAReceber}
                  onChange={setConsiderarPcAReceber}
                  rotulo="Considerar Pedidos de compra a receber?"
                />
              </div>
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
          fetchDetalhes={fetchPcFiltrado}
          overlayFixed
          zIndexClass="z-[14250]"
        />
      )}
    </>,
    document.body
  );
}
