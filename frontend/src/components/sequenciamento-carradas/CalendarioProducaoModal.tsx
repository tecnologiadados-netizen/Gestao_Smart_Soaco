import { useCallback, useMemo, useState } from 'react';
import {
  colunaCalendarioId,
  computarCalendarioProducao,
  dataProducaoInserirRomaneioApartirDe,
  encontrarLinhaSnapshotNoDrill,
  encontrarLinhaSnapshotParaTooltipItem,
  formatDataCurta,
  formatQtdeInt,
  isFimDeSemana,
  linhaCarradaKey,
  maxDataProducaoCarradasNormais,
  montarEixoDatasCalendario,
  tooltipDetalheComDatasEfetivas,
  valorEfetivo,
  type CarradaBaseline,
  type ColunaCalendario,
  type SimEntry,
} from './simulacaoCarradas';
import IndicadorDataPorPrevisao from './IndicadorDataPorPrevisao';
import CalendarioSetorProdutosModal from './CalendarioSetorProdutosModal';
import {
  comparePedidoAsc,
  linhaSnapshotParaPedido,
  listarLinhasSnapshotPorPd,
  listarTooltipDetalhePorPd,
  mergeLinhasSnapshotAposAjuste,
  mergeLinhasSnapshotVarios,
  SUBTOTAL_ROW_CLASS,
} from './sequenciamentoCarradasUtils';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import HeatmapPedidoItensModal from '../HeatmapPedidoItensModal';
import ModalAjustePrevisao, {
  type AjustePrevisaoContextoCalendario,
  type AjustePrevisaoSuccessMeta,
} from '../ModalAjustePrevisao';
import GradeCelulaModalBtn from '../pcp/GradeCelulaModalBtn';
import { labelPedidoMapa } from '../../utils/mapaMunicipioPedido';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import type { Pedido, TooltipDetalheRow } from '../../api/pedidos';

type Props = {
  linhas: Record<string, unknown>[];
  sim: Map<string, SimEntry>;
  baseline: Map<string, CarradaBaseline>;
  onClose: () => void;
  onLinhasAtualizadas?: (linhas: Record<string, unknown>[]) => void;
  onEditarDataProducao?: (carradaKey: string, novaData: string) => void;
  /** False quando o snapshot já está concluído (somente leitura). */
  editavel?: boolean;
};

type EscopoAjustePd = 'item' | 'todos_itens_pd';

type PedidoAjusteState = {
  pedido: Pedido;
  pd: string;
  carradaKey: string;
  carradaKeysTodosItens: string[];
  calendario: AjustePrevisaoContextoCalendario;
  escopo: EscopoAjustePd;
  exibirVoltarEscopo: boolean;
};

type Drill =
  | { nivel: 'pivot' }
  | { nivel: 'tipof'; setor: string; data: string }
  | { nivel: 'pedidos'; setor: string; data: string; tipoF: string };

type SetorRow = { setor: string };

const COL_SETOR = 'setor';
const COL_TOTAL = '__total';

const TH = 'px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'px-2 py-1.5 text-slate-700 dark:text-slate-200';
const WEEKEND_TD = 'bg-slate-100/80 dark:bg-slate-900/40';
const OCIOso_TD = 'bg-slate-50/60 dark:bg-slate-900/20';

function IconAjustarPrevisao() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function diaSemanaIso(iso: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
}

function labelColunaData(iso: string): string {
  const dow = diaSemanaIso(iso);
  if (dow === 6) return 'S';
  if (dow === 0) return 'D';
  return formatDataCurta(iso);
}

function labelColuna(col: ColunaCalendario): string {
  if (col.tipo === 'data') return labelColunaData(col.iso);
  return '…';
}

function tituloColuna(col: ColunaCalendario): string {
  if (col.tipo === 'data') {
    const label = formatDataCurta(col.iso);
    const dow = diaSemanaIso(col.iso);
    if (dow === 6) return `${label} (Sábado)`;
    if (dow === 0) return `${label} (Domingo)`;
    return label;
  }
  return `Período ocioso (${formatDataCurta(col.de)} – ${formatDataCurta(col.ate)})`;
}

export default function CalendarioProducaoModal({
  linhas,
  sim,
  baseline,
  onClose,
  onLinhasAtualizadas,
  onEditarDataProducao,
  editavel = true,
}: Props) {
  const { hasPermission } = useAuth();
  const podeAjustarPrevisao =
    editavel &&
    (hasPermission(PERMISSOES.PCP_AJUSTAR_PREVISAO) ||
      hasPermission(PERMISSOES.PCP_TOTAL) ||
      hasPermission(PERMISSOES.PEDIDOS_EDITAR));

  const dados = useMemo(() => computarCalendarioProducao(linhas, sim, baseline), [linhas, sim, baseline]);

  const dataInserirRomaneio = useMemo(
    () => dataProducaoInserirRomaneioApartirDe(maxDataProducaoCarradasNormais(linhas, sim, baseline)),
    [linhas, sim, baseline]
  );
  const [drill, setDrill] = useState<Drill>({ nivel: 'pivot' });
  const [pedidoModal, setPedidoModal] = useState<{
    linha: TooltipDetalheRow;
    itens: TooltipDetalheRow[];
  } | null>(null);
  const [pedidoAjustePrevisao, setPedidoAjustePrevisao] = useState<PedidoAjusteState | null>(null);
  const [escolhaEscopoPd, setEscolhaEscopoPd] = useState<string | null>(null);
  const [setorDetalhe, setSetorDetalhe] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const colunas = useMemo(() => montarEixoDatasCalendario(dados.totalPorData), [dados.totalPorData]);

  const setorRows = useMemo<SetorRow[]>(() => dados.setores.map((setor) => ({ setor })), [dados.setores]);

  const colIds = useMemo(
    () => [COL_SETOR, ...colunas.map(colunaCalendarioId), COL_TOTAL],
    [colunas]
  );

  const valorCelula = useCallback(
    (setor: string, data: string): number => dados.valores.get(setor)?.get(data) ?? 0,
    [dados.valores]
  );

  const getCellText = useCallback(
    (row: SetorRow, colId: string): string => {
      if (colId === COL_SETOR) return row.setor;
      if (colId === COL_TOTAL) return formatQtdeInt(dados.totalPorSetor.get(row.setor) ?? 0);
      const col = colunas.find((c) => colunaCalendarioId(c) === colId);
      if (!col || col.tipo === 'ocioso') return '—';
      return formatQtdeInt(valorCelula(row.setor, col.iso));
    },
    [colunas, dados.totalPorSetor, valorCelula]
  );

  const valueForSort = useCallback(
    (row: SetorRow, colId: string): string | number => {
      if (colId === COL_SETOR) return row.setor;
      if (colId === COL_TOTAL) return dados.totalPorSetor.get(row.setor) ?? 0;
      const col = colunas.find((c) => colunaCalendarioId(c) === colId);
      if (!col || col.tipo === 'ocioso') return -1;
      return valorCelula(row.setor, col.iso);
    },
    [colunas, dados.totalPorSetor, valorCelula]
  );

  const grade = useGradeFiltrosExcel<SetorRow>({
    rows: setorRows,
    columnIds: colIds,
    getCellText,
    valueForSort,
    defaultSortLevels: [],
  });

  const totais = useMemo(() => {
    const porColId = new Map<string, number>();
    let geral = 0;
    for (const row of grade.rowsExibidas) {
      for (const col of colunas) {
        if (col.tipo === 'ocioso') continue;
        const colId = colunaCalendarioId(col);
        const v = valorCelula(row.setor, col.iso);
        if (v !== 0) porColId.set(colId, (porColId.get(colId) ?? 0) + v);
        geral += v;
      }
    }
    return { porColId, geral };
  }, [grade.rowsExibidas, colunas, valorCelula]);

  const tipoFRows = useMemo(() => {
    if (drill.nivel !== 'tipof') return [];
    const map = new Map<string, number>();
    for (const d of dados.detalhes) {
      if (d.setor === drill.setor && d.data === drill.data) {
        map.set(d.tipoF, (map.get(d.tipoF) ?? 0) + d.qtde);
      }
    }
    return [...map.entries()]
      .map(([tipoF, qtde]) => ({ tipoF, qtde }))
      .sort((a, b) => b.qtde - a.qtde);
  }, [drill, dados.detalhes]);

  const pedidoRows = useMemo(() => {
    if (drill.nivel !== 'pedidos') return [];
    const map = new Map<string, { qtde: number; producaoPorPrevisao: boolean }>();
    for (const d of dados.detalhes) {
      if (d.setor === drill.setor && d.data === drill.data && d.tipoF === drill.tipoF) {
        const cur = map.get(d.pd) ?? { qtde: 0, producaoPorPrevisao: false };
        cur.qtde += d.qtde;
        if (d.producaoPorPrevisao) cur.producaoPorPrevisao = true;
        map.set(d.pd, cur);
      }
    }
    return [...map.entries()]
      .map(([pd, { qtde, producaoPorPrevisao }]) => ({ pd, qtde, producaoPorPrevisao }))
      .sort((a, b) => comparePedidoAsc(a.pd, b.pd));
  }, [drill, dados.detalhes]);

  const celulasComPrevisao = useMemo(() => {
    const set = new Set<string>();
    for (const d of dados.detalhes) {
      if (d.producaoPorPrevisao) set.add(`${d.setor}\0${d.data}`);
    }
    return set;
  }, [dados.detalhes]);

  const tipoFTotal = tipoFRows.reduce((s, r) => s + r.qtde, 0);
  const pedidoTotal = pedidoRows.reduce((s, r) => s + r.qtde, 0);

  const voltarNivel = useCallback(() => {
    setDrill((cur) => {
      if (cur.nivel === 'pedidos') return { nivel: 'tipof', setor: cur.setor, data: cur.data };
      if (cur.nivel === 'tipof') return { nivel: 'pivot' };
      return cur;
    });
  }, []);

  const emDrill = drill.nivel !== 'pivot';

  const handleEscape = useCallback(() => {
    if (pedidoAjustePrevisao) {
      setPedidoAjustePrevisao(null);
      return;
    }
    if (escolhaEscopoPd) {
      setEscolhaEscopoPd(null);
      return;
    }
    if (pedidoModal) {
      setPedidoModal(null);
      return;
    }
    if (setorDetalhe) {
      setSetorDetalhe(null);
      return;
    }
    if (grade.colunaFiltroAberta) {
      grade.fecharFiltroExcel();
      return;
    }
    if (drill.nivel !== 'pivot') {
      voltarNivel();
      return;
    }
    onClose();
  }, [pedidoAjustePrevisao, escolhaEscopoPd, pedidoModal, setorDetalhe, grade, drill.nivel, voltarNivel, onClose]);

  const abrirModalPedido = useCallback(
    (pd: string) => {
      const linhasPd = listarLinhasSnapshotPorPd(linhas, pd);
      const itens = listarTooltipDetalhePorPd(linhas, pd)
        .map((item) => {
          const linha = encontrarLinhaSnapshotParaTooltipItem(linhasPd, item);
          return linha ? tooltipDetalheComDatasEfetivas(item, linha, sim, baseline, dataInserirRomaneio) : item;
        });
      if (itens.length === 0) return;
      setPedidoModal({ linha: itens[0]!, itens });
    },
    [linhas, sim, baseline, dataInserirRomaneio]
  );

  const abrirAjustePrevisao = useCallback(
    (pd: string, escopo: EscopoAjustePd) => {
      if (drill.nivel !== 'pedidos') return;
      const linhasPd = listarLinhasSnapshotPorPd(linhas, pd);
      const linhaDrill = encontrarLinhaSnapshotNoDrill(
        linhas,
        pd,
        { setor: drill.setor, data: drill.data, tipoF: drill.tipoF },
        sim,
        baseline,
        dataInserirRomaneio
      );
      const linha = escopo === 'item' ? linhaDrill : linhaDrill ?? linhasPd[0] ?? null;
      if (!linha) return;
      const pedido = linhaSnapshotParaPedido(linha);
      if (!pedido) return;

      const carradaKeysTodosItens = [...new Set(linhasPd.map((row) => linhaCarradaKey(row)))];
      const pedidosPd = linhasPd
        .map((row) => linhaSnapshotParaPedido(row))
        .filter((p): p is Pedido => p != null);
      const demaisItensPd =
        escopo === 'todos_itens_pd'
          ? pedidosPd.filter((p) => p.id_pedido !== pedido.id_pedido)
          : undefined;

      const key = linhaCarradaKey(linha);
      const dataProducaoAtual = valorEfetivo(sim, baseline, key, 'dataProducao');
      setPedidoAjustePrevisao({
        pedido,
        pd,
        carradaKey: key,
        carradaKeysTodosItens,
        escopo,
        exibirVoltarEscopo: linhasPd.length > 1,
        calendario: {
          dataProducaoAtual,
          producaoDerivadaPrevisao: false,
          escopoTodosItensPd: escopo === 'todos_itens_pd',
          demaisItensPd,
        },
      });
    },
    [linhas, sim, baseline, dataInserirRomaneio, drill]
  );

  const solicitarAjustePrevisao = useCallback(
    (pd: string) => {
      const qtdItens = listarLinhasSnapshotPorPd(linhas, pd).length;
      if (qtdItens <= 1) {
        abrirAjustePrevisao(pd, 'item');
        return;
      }
      setEscolhaEscopoPd(pd);
    },
    [linhas, abrirAjustePrevisao]
  );

  const handleAjusteSuccess = useCallback(
    (atualizado: Pedido, meta?: AjustePrevisaoSuccessMeta) => {
      let proximas = mergeLinhasSnapshotAposAjuste(linhas, atualizado, meta);
      if (meta?.todosItensPdAtualizados?.length) {
        proximas = mergeLinhasSnapshotVarios(proximas, meta.todosItensPdAtualizados);
      }
      onLinhasAtualizadas?.(proximas);
      const qtdTodos = meta?.todosItensPdAtualizados?.length ?? 0;
      setToast(
        meta?.atualizadosMesmaCarrada?.length
          ? 'Datas atualizadas (previsão replicada na carrada).'
          : qtdTodos > 1
            ? `Datas atualizadas em ${qtdTodos} itens do pedido.`
            : 'Datas atualizadas com sucesso.'
      );
      setTimeout(() => setToast(null), 3000);
    },
    [linhas, onLinhasAtualizadas]
  );

  const handleSalvarDataProducao = useCallback(
    (novaData: string) => {
      if (!pedidoAjustePrevisao) return;
      const keys =
        pedidoAjustePrevisao.escopo === 'todos_itens_pd'
          ? pedidoAjustePrevisao.carradaKeysTodosItens
          : [pedidoAjustePrevisao.carradaKey];
      for (const key of keys) onEditarDataProducao?.(key, novaData);
    },
    [pedidoAjustePrevisao, onEditarDataProducao]
  );

  useRegisterModalEscape({ id: 'seq-carradas-calendario', onClose: handleEscape, zIndex: 130 });

  const renderTh = (colId: string) => {
    const isSetor = colId === COL_SETOR;
    const isTotal = colId === COL_TOTAL;
    const col = colunas.find((c) => colunaCalendarioId(c) === colId);
    const weekend = col?.tipo === 'data' && isFimDeSemana(col.iso);
    const ocioso = col?.tipo === 'ocioso';
    const label = isSetor ? 'Setor de produção' : isTotal ? 'Total Geral' : col ? labelColuna(col) : colId;
    const title = isSetor || isTotal ? label : col ? tituloColuna(col) : label;
    return (
      <th
        key={colId}
        className={`sticky top-0 z-20 border border-primary-500/40 py-2 align-middle font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] ${
          weekend ? 'px-1' : 'px-2'
        } ${
          weekend ? 'bg-primary-800' : ocioso ? 'bg-primary-700' : 'bg-primary-600'
        } ${isSetor ? 'left-0 z-30 text-left' : 'text-right'}`}
        title={title}
      >
        <div className={`flex items-center gap-0.5 ${isSetor ? 'justify-between' : weekend ? 'justify-center' : 'justify-end'}`}>
          <span
            className={
              weekend
                ? 'text-xs font-bold leading-none'
                : 'whitespace-nowrap text-[11px] leading-tight sm:text-xs'
            }
          >
            {label}
          </span>
          {!ocioso && (
            <GradeFiltroCabecalhoBtn
              ativo={grade.colunaComFiltroAtivo(colId)}
              onClick={(e) => grade.abrirFiltroExcel(colId, e)}
            />
          )}
        </div>
      </th>
    );
  };

  const renderCelulaData = (setor: string, col: ColunaCalendario) => {
    const colId = colunaCalendarioId(col);
    if (col.tipo === 'ocioso') {
      return (
        <td key={colId} className={`${TD} text-center ${OCIOso_TD}`} title={tituloColuna(col)}>
          <span className="text-slate-300 dark:text-slate-600">—</span>
        </td>
      );
    }
    const v = valorCelula(setor, col.iso);
    const weekend = isFimDeSemana(col.iso);
    const temPrevisaoFallback = celulasComPrevisao.has(`${setor}\0${col.iso}`);
    const tituloBase = 'Ver detalhamento por TipoF';
    const titulo = temPrevisaoFallback
      ? `${tituloBase} (contém itens posicionados pela previsão atual — Prev.)`
      : tituloBase;
    return (
      <td key={colId} className={`${TD} text-right ${weekend ? 'px-1' : ''} ${weekend ? WEEKEND_TD : ''}`}>
        {v > 0 ? (
          <GradeCelulaModalBtn
            onClick={() => setDrill({ nivel: 'tipof', setor, data: col.iso })}
            title={titulo}
            align="right"
          >
            <span className="inline-flex items-center gap-0.5">
              {formatQtdeInt(v)}
              {temPrevisaoFallback ? <span className="text-amber-200">*</span> : null}
            </span>
          </GradeCelulaModalBtn>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[95vw] flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendario-producao-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2 id="calendario-producao-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Calendário de produção
          </h2>
          <div className="flex items-center gap-2">
            {emDrill && (
              <button
                type="button"
                onClick={voltarNivel}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                ← Voltar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-400">
          <span>Datas do calendário baseadas na data de produção.</span>
          <span className="inline-flex items-center gap-1">
            <IndicadorDataPorPrevisao />
            <span>= sem data de produção, usando previsão atual</span>
          </span>
        </div>

        {emDrill && (
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 px-4 py-2 text-xs dark:border-slate-600">
            <button
              type="button"
              onClick={() => setDrill({ nivel: 'pivot' })}
              className="rounded px-2 py-1 font-medium text-primary-700 hover:bg-slate-100 dark:text-primary-300 dark:hover:bg-slate-700"
            >
              Calendário
            </button>
            <span className="text-slate-400">/</span>
            <button
              type="button"
              onClick={() => setDrill({ nivel: 'tipof', setor: drill.setor, data: drill.data })}
              className={`rounded px-2 py-1 font-medium ${drill.nivel === 'tipof' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'text-primary-700 hover:bg-slate-100 dark:text-primary-300 dark:hover:bg-slate-700'}`}
            >
              {drill.setor} · {formatDataCurta(drill.data)}
            </button>
            {drill.nivel === 'pedidos' && (
              <>
                <span className="text-slate-400">/</span>
                <span className="rounded bg-primary-100 px-2 py-1 font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">
                  TipoF: {drill.tipoF}
                </span>
              </>
            )}
          </div>
        )}

        {drill.nivel === 'pivot' && grade.temFiltrosOuOrdem && (
          <div className="flex shrink-0 items-center justify-end border-b border-slate-200 px-4 py-1.5 dark:border-slate-600">
            <button
              type="button"
              onClick={grade.limparFiltrosGrade}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Limpar filtros/ordem
            </button>
          </div>
        )}

        <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto p-4">
          {drill.nivel === 'pivot' &&
            (colunas.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum item com data de produção ou previsão atual para montar o calendário.
              </p>
            ) : (
              <table className="border-collapse text-sm">
                <thead>
                  <tr>{colIds.map((colId) => renderTh(colId))}</tr>
                </thead>
                <tbody>
                  {grade.rowsExibidas.map(({ setor }) => (
                    <tr key={setor} className="border-b border-slate-100 dark:border-slate-700">
                      <td className={`${TD} sticky left-0 z-10 bg-white dark:bg-slate-800`}>
                        <GradeCelulaModalBtn
                          onClick={() => setSetorDetalhe(setor)}
                          title="Ver códigos e descrições do setor"
                          align="left"
                        >
                          {setor}
                        </GradeCelulaModalBtn>
                      </td>
                      {colunas.map((col) => renderCelulaData(setor, col))}
                      <td className={`${TD} text-right font-semibold tabular-nums`}>
                        {formatQtdeInt(dados.totalPorSetor.get(setor) ?? 0)}
                      </td>
                    </tr>
                  ))}
                  <tr className={SUBTOTAL_ROW_CLASS}>
                    <td className={`${TD} sticky left-0 z-10 bg-slate-100 dark:bg-slate-700/60`}>Total Geral</td>
                    {colunas.map((col) => {
                      const colId = colunaCalendarioId(col);
                      if (col.tipo === 'ocioso') {
                        return (
                          <td key={colId} className={`${TD} text-center ${OCIOso_TD}`}>
                            —
                          </td>
                        );
                      }
                      return (
                        <td
                          key={colId}
                          className={`${TD} text-right tabular-nums ${isFimDeSemana(col.iso) ? `px-1 ${WEEKEND_TD}` : ''}`}
                        >
                          {formatQtdeInt(totais.porColId.get(colId) ?? 0)}
                        </td>
                      );
                    })}
                    <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(totais.geral)}</td>
                  </tr>
                </tbody>
              </table>
            ))}

          {drill.nivel === 'tipof' && (
            <table className="w-full max-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={`${TH} text-left`}>TipoF</th>
                  <th className={`${TH} text-right`}>Qtde Pendente Real</th>
                </tr>
              </thead>
              <tbody>
                {tipoFRows.map((r) => (
                  <tr key={r.tipoF} className="border-b border-slate-100 dark:border-slate-700">
                    <td className={TD}>
                      <GradeCelulaModalBtn
                        onClick={() =>
                          setDrill({ nivel: 'pedidos', setor: drill.setor, data: drill.data, tipoF: r.tipoF })
                        }
                        title="Ver pedidos"
                        align="left"
                      >
                        {r.tipoF}
                      </GradeCelulaModalBtn>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(r.qtde)}</td>
                  </tr>
                ))}
                <tr className={SUBTOTAL_ROW_CLASS}>
                  <td className={TD}>Total</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(tipoFTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {drill.nivel === 'pedidos' && (
            <table className="w-full max-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={`${TH} text-left`}>Pedido</th>
                  <th className={`${TH} text-right`}>Qtde Pendente Real</th>
                </tr>
              </thead>
              <tbody>
                {pedidoRows.map((r) => (
                  <tr key={r.pd} className="border-b border-slate-100 dark:border-slate-700">
                    <td className={TD}>
                      <div className="flex items-center gap-1.5">
                        <GradeCelulaModalBtn
                          onClick={() => abrirModalPedido(r.pd)}
                          title="Ver itens do pedido"
                          align="left"
                        >
                          {labelPedidoMapa(r.pd)}
                        </GradeCelulaModalBtn>
                        {r.producaoPorPrevisao && <IndicadorDataPorPrevisao />}
                        {podeAjustarPrevisao && (
                          <button
                            type="button"
                            onClick={() => solicitarAjustePrevisao(r.pd)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-primary-700 dark:text-slate-400 dark:hover:bg-slate-600/50 dark:hover:text-primary-300 transition"
                            title="Reprogramar datas de produção e entrega"
                            aria-label={`Ajustar previsão do pedido ${labelPedidoMapa(r.pd)}`}
                          >
                            <IconAjustarPrevisao />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(r.qtde)}</td>
                  </tr>
                ))}
                <tr className={SUBTOTAL_ROW_CLASS}>
                  <td className={TD}>Total</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(pedidoTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
          <GradeFiltroExcelPortal
            colunaAberta={grade.colunaFiltroAberta}
            rect={grade.filtroAbertoRect}
            dropdownRef={grade.filtroDropdownRef}
            excelFilterDrafts={grade.excelFilterDrafts}
            setExcelFilterDrafts={grade.setExcelFilterDrafts}
            valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
            onSortAsc={(colId) => {
              grade.setSortState({ key: colId, direction: 'asc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onSortDesc={(colId) => {
              grade.setSortState({ key: colId, direction: 'desc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onAplicar={grade.aplicarFiltroExcel}
            onCancelar={grade.fecharFiltroExcel}
            sortAscLabel={grade.colunaFiltroAberta !== COL_SETOR ? 'Menor para Maior' : undefined}
            sortDescLabel={grade.colunaFiltroAberta !== COL_SETOR ? 'Maior para Menor' : undefined}
            showNumericFilters={grade.colunaFiltroAberta !== COL_SETOR}
          />
        )}
      </div>

      {pedidoModal && (
        <HeatmapPedidoItensModal
          open
          linha={pedidoModal.linha}
          municipioLabel={pedidoModal.linha.municipio || '—'}
          itens={pedidoModal.itens}
          onClose={() => setPedidoModal(null)}
        />
      )}

      {setorDetalhe && (
        <CalendarioSetorProdutosModal
          setor={setorDetalhe}
          linhas={linhas}
          sim={sim}
          baseline={baseline}
          dataInserirRomaneio={dataInserirRomaneio}
          onClose={() => setSetorDetalhe(null)}
        />
      )}

      {escolhaEscopoPd && (
        <div
          className="fixed inset-0 z-[135] flex items-center justify-center bg-black/75 p-4"
          role="presentation"
          onClick={() => setEscolhaEscopoPd(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="escolha-escopo-pd-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="escolha-escopo-pd-titulo"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Alterar datas do pedido
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Pedido <strong>{labelPedidoMapa(escolhaEscopoPd)}</strong> — deseja alterar a data somente do
              item deste pedido ou de <strong>todos os itens</strong> do pedido?
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEscolhaEscopoPd(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const pd = escolhaEscopoPd;
                  setEscolhaEscopoPd(null);
                  abrirAjustePrevisao(pd, 'item');
                }}
                className="rounded-lg border border-primary-500 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30"
              >
                Somente este item
              </button>
              <button
                type="button"
                onClick={() => {
                  const pd = escolhaEscopoPd;
                  setEscolhaEscopoPd(null);
                  abrirAjustePrevisao(pd, 'todos_itens_pd');
                }}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Todos os itens do pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {pedidoAjustePrevisao && (
        <ModalAjustePrevisao
          pedido={pedidoAjustePrevisao.pedido}
          calendario={pedidoAjustePrevisao.calendario}
          onSalvarDataProducao={(novaData) => {
            handleSalvarDataProducao(novaData);
          }}
          onVoltar={
            pedidoAjustePrevisao.exibirVoltarEscopo
              ? () => {
                  const pd = pedidoAjustePrevisao.pd;
                  setPedidoAjustePrevisao(null);
                  setEscolhaEscopoPd(pd);
                }
              : undefined
          }
          onClose={() => setPedidoAjustePrevisao(null)}
          onSuccess={(atualizado, meta) => {
            const previsaoAnterior = String(
              pedidoAjustePrevisao.pedido.previsao_entrega_atualizada ?? ''
            ).slice(0, 10);
            const previsaoNova = String(atualizado.previsao_entrega_atualizada ?? '').slice(0, 10);
            const previsaoAlterada = previsaoNova !== previsaoAnterior;
            if (previsaoAlterada || meta?.atualizadosMesmaCarrada?.length) {
              handleAjusteSuccess(atualizado, meta);
            } else {
              const msg =
                pedidoAjustePrevisao.escopo === 'todos_itens_pd'
                  ? `Data de produção atualizada em ${pedidoAjustePrevisao.carradaKeysTodosItens.length} carrada(s).`
                  : 'Data de produção atualizada na simulação.';
              setToast(msg);
              setTimeout(() => setToast(null), 3000);
            }
          }}
          onError={(msg) => {
            setToast(msg);
            setTimeout(() => setToast(null), 5000);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-[140] rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-800 shadow-lg dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
          {toast}
        </div>
      )}
    </div>
  );
}
