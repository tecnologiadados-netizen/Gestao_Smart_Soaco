import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchDfcAgendamentosDetalhe, fetchDreSaidasNomusDetalhe, fetchDreSaidasSoAcoDetalhe, type DfcAgendamentoDetalheLinha } from '../../../api/financeiro';
import { DFC_PRIORIDADE_LABEL_CURTO, type DfcPrioridade } from '../../../api/dfcPrioridade';
import { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import { linhaMatchesEmpresasDfc, labelEmpresaDfc } from './dfcEmpresas';
import { PrioridadeSomenteLeitura } from './dfcDetalheTabelaUtils';
import { rotuloPeriodoCabecalho } from './dfcPeriodos';
import {
  criarGetCellTextDfcDetalhe,
  criarValueForSortDfcDetalhe,
  montarColunasGradeDfcDetalhe,
  rotuloColunaGradeDfc,
} from './dfcDetalheGradeExcel';
import { DfcDetalheCabecalhoTh, DfcDetalheGradeFiltroPortal } from './DfcDetalheCabecalhoGrade';
import DreDetalheRateioSimplesCelula from '../dre/DreDetalheRateioSimplesCelula';
import {
  periodoLinhaDetalheSimples,
  rateioValoresLinhaSimples,
  valorSimplesGradePorEmpresas,
  type DreSimplesRateioPeriodo,
} from '../dre/dreSimplesNacionalRateio';
import {
  aplicarRecorteRateioDetalhe,
  montarDetalheRateioEmpresasFiltro,
  partesValorRateioEmpresas,
} from '../dre/dreRateioEmpresasDisplay';
import type { DreRateioProLaborePct, DreRateioRegra } from '../dre/dreRateioEmpresas';

const nf = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Referências estáveis — evitar `= []` em props padrão (novo array a cada render → loop no useEffect). */
const CONTAS_BANCARIAS_VAZIAS: string[] = [];
const PRIORIDADES_VAZIAS: DfcPrioridade[] = [];

function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const p = ymd.slice(0, 10);
  const [y, m, d] = p.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return ymd;
}

/** Evita linhas repetidas quando Nomus e Shop9 retornam o mesmo código (fc.Ordem / agendamento). */
function deduplicarDetalhePorCodigo(linhas: DfcAgendamentoDetalheLinha[]): DfcAgendamentoDetalheLinha[] {
  const byId = new Map<number, DfcAgendamentoDetalheLinha>();
  const semId: DfcAgendamentoDetalheLinha[] = [];
  for (const d of linhas) {
    if (d.id > 0) {
      if (!byId.has(d.id)) byId.set(d.id, d);
    } else {
      semId.push(d);
    }
  }
  return byId.size > 0 ? [...byId.values(), ...semId] : linhas;
}

function dataCompetenciaLinha(row: DfcAgendamentoDetalheLinha): string | null {
  return row.dataCompetencia ?? null;
}

function periodoCompetenciaLinha(
  row: DfcAgendamentoDetalheLinha,
  granularidade: 'dia' | 'mes',
): string | null {
  const ymd = dataCompetenciaLinha(row);
  if (!ymd) return null;
  return granularidade === 'mes' ? ymd.slice(0, 7) : ymd.slice(0, 10);
}

function linhaNoPeriodoCompetencia(
  row: DfcAgendamentoDetalheLinha,
  periodo: string | undefined,
  granularidade: 'dia' | 'mes',
): boolean {
  if (!periodo) return true;
  return periodoCompetenciaLinha(row, granularidade) === periodo;
}

export type DfcDetalheLancamentosModalProps = {
  onClose: () => void;
  /** ids Nomus (contafinanceiro) — endpoint DFC (data de baixa). */
  ids: number[];
  /** ids Shop9 (Ordem_Plano_Contas3) — endpoint DRE por competência. */
  idsShop9?: number[];
  /** `undefined` = todo o intervalo (data início → fim). */
  periodo: string | undefined;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas: number[];
  /** Empresas na busca Nomus/Shop9 (ex.: todas quando há rateio, para não perder lançamentos de origem). */
  idEmpresasBusca?: number[];
  contasBancariasSelecionadas?: string[];
  /** Prioridades ativas (passadas para o endpoint). */
  prioridadesSelecionadas?: DfcPrioridade[];
  /** Mapa "idEmpresa#idContaFinanceiro" → prioridade (para mostrar fallback do plano). */
  prioridadesContasMap?: Record<string, DfcPrioridade>;
  /** Mapa "idEmpresa#tipoRef#idRef" → prioridade override de lançamento. */
  prioridadesLancsMap?: Record<string, DfcPrioridade>;
  /**
   * Atualização cirúrgica do mapa de prioridade de lançamento (sem recarregar a DFC).
   * Passe `prioridade = null` para indicar remoção.
   */
  onPrioridadeLancAtualizada?: (
    idEmpresa: number,
    tipoRef: 'A' | 'L' | 'S',
    idRef: number,
    prioridade: DfcPrioridade | null,
  ) => void;
  /** Rateio Simples Nacional (4.14) — bases 1.5 / 1.6.2 por período. */
  rateioSimplesPorPeriodo?: Map<string, DreSimplesRateioPeriodo>;
  /** Empresas do filtro DRE — recorte do rateio na grade e no rodapé. */
  idEmpresasRateioSimples?: number[];
  /** Cabeçalho da coluna `dataBaixa` (DRE usa competência). */
  rotuloColunaDataBaixa?: string;
  /** DRE: filtra e totaliza por dataCompetencia (não usa endpoint DFC/data baixa). */
  filtroPorCompetencia?: boolean;
  /** Rateio entre empresas (fornecedores) — expande ou recorta lançamentos. */
  rateioEmpresasRegras?: DreRateioRegra[];
  rateioEmpresaRecorte?: number;
  /** Rateio plano de contas (ex.: pró-labore) — aplica % da filha selecionada. */
  rateioPercentuaisPlanoContas?: DreRateioProLaborePct;
  /** Valor da célula na grade DRE — conferência de integridade. */
  valorEsperadoGrade?: number;
};

/**
 * Modal centralizado (montado ao clicar na árvore DFC) — detalhe Nomus, filtros e total reativo aos filtros.
 */
export default function DfcDetalheLancamentosModal({
  onClose,
  ids,
  idsShop9 = [],
  periodo,
  titulo,
  dataInicio,
  dataFim,
  granularidade,
  idEmpresas,
  idEmpresasBusca,
  contasBancariasSelecionadas = CONTAS_BANCARIAS_VAZIAS,
  prioridadesSelecionadas = PRIORIDADES_VAZIAS,
  prioridadesContasMap = {},
  prioridadesLancsMap = {},
  rateioSimplesPorPeriodo,
  idEmpresasRateioSimples,
  rotuloColunaDataBaixa = 'Data Baixa',
  filtroPorCompetencia = false,
  rateioEmpresasRegras,
  rateioEmpresaRecorte,
  rateioPercentuaisPlanoContas,
  valorEsperadoGrade,
}: DfcDetalheLancamentosModalProps) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [linhas, setLinhas] = useState<DfcAgendamentoDetalheLinha[]>([]);
  const [truncado, setTruncado] = useState(false);
  const comRateioSimples = rateioSimplesPorPeriodo != null && rateioSimplesPorPeriodo.size > 0;
  const contaComRateioEmpresas =
    (rateioEmpresasRegras?.length ?? 0) > 0 || rateioPercentuaisPlanoContas != null;
  const abortRef = useRef<AbortController | null>(null);
  const loadId = useRef(0);

  const idList = useMemo(
    () => [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b),
    [ids]
  );
  const idShop9List = useMemo(
    () => [...new Set(idsShop9.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b),
    [idsShop9]
  );
  const idListKey = idList.join(',');
  const idShop9ListKey = idShop9List.join(',');
  const idEmpresasKey = idEmpresas.join(',');
  const idEmpresasBuscaEfetivas = idEmpresasBusca ?? idEmpresas;
  const idEmpresasBuscaKey = idEmpresasBuscaEfetivas.join(',');
  /** Detalhe buscou pool completo (ex.: rateio DRE) — aplicar fatias no modal. */
  const poolRateioDetalhe = Boolean(idEmpresasBusca?.length);
  const buscaAmpliadaEmpresas = useMemo(() => {
    if (!idEmpresasBusca?.length) return false;
    if (idEmpresas.length === 0) return true;
    return (
      idEmpresasBusca.length > idEmpresas.length ||
      idEmpresasBusca.some((id) => !idEmpresas.includes(id))
    );
  }, [idEmpresasBusca, idEmpresasBuscaKey, idEmpresas, idEmpresasKey]);
  const contasBancariasKey = contasBancariasSelecionadas.join(',');
  const prioridadesKey = prioridadesSelecionadas.join(',');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (idList.length === 0 && idShop9List.length === 0) {
      setLoading(false);
      setLinhas([]);
      setErro(undefined);
      setTruncado(false);
      return;
    }

    loadId.current += 1;
    const myId = loadId.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setErro(undefined);
    setLinhas([]);
    setTruncado(false);

    const baseParams = {
      dataInicio,
      dataFim,
      granularidade,
      periodo,
      idEmpresas: idEmpresasBuscaEfetivas,
      signal: ac.signal,
    };

    void Promise.all([
      idList.length > 0
        ? filtroPorCompetencia
          ? fetchDreSaidasNomusDetalhe({ ...baseParams, ids: idList })
          : fetchDfcAgendamentosDetalhe({
              ...baseParams,
              ids: idList,
              contasBancarias: contasBancariasSelecionadas,
              prioridades: prioridadesSelecionadas,
            })
        : Promise.resolve({ detalhes: [] as DfcAgendamentoDetalheLinha[], truncado: false, erro: undefined }),
      idShop9List.length > 0
        ? fetchDreSaidasSoAcoDetalhe({ ...baseParams, ids: idShop9List })
        : Promise.resolve({ detalhes: [] as DfcAgendamentoDetalheLinha[], truncado: false, erro: undefined }),
    ])
      .then(([rNomus, rShop9]) => {
        if (myId !== loadId.current) return;
        setLoading(false);
        const merged = deduplicarDetalhePorCodigo([...rNomus.detalhes, ...rShop9.detalhes]);
        const detalhesFiltrados = merged.filter((linha) => {
          if (
            !buscaAmpliadaEmpresas &&
            !linhaMatchesEmpresasDfc({ idEmpresa: linha.idEmpresa, empresa: linha.empresa }, idEmpresas)
          ) {
            return false;
          }
          if (filtroPorCompetencia && !linhaNoPeriodoCompetencia(linha, periodo, granularidade)) {
            return false;
          }
          return true;
        });
        setLinhas(detalhesFiltrados);
        setTruncado(Boolean(rNomus.truncado || rShop9.truncado));
        setErro(rNomus.erro ?? rShop9.erro);
      })
      .catch((e: unknown) => {
        if (myId !== loadId.current) return;
        if (e instanceof Error && e.name === 'AbortError') return;
        setLoading(false);
        setLinhas([]);
        setErro(e instanceof Error ? e.message : String(e));
      });

    return () => {
      ac.abort();
      loadId.current += 1;
    };
  }, [dataInicio, dataFim, granularidade, idEmpresasKey, idEmpresasBuscaKey, contasBancariasKey, periodo, idListKey, idShop9ListKey, prioridadesKey, filtroPorCompetencia, buscaAmpliadaEmpresas]);

  const linhasRateioEmpresas = useMemo(() => {
    let rows = linhas;
    const temRateioFornecedor = (rateioEmpresasRegras ?? []).some(
      (r) => r.origem.tipo === 'fornecedores' && r.origem.nomes.length > 0,
    );

    if (rateioPercentuaisPlanoContas && rateioEmpresaRecorte != null && rateioEmpresaRecorte > 0) {
      rows = linhas.map((row) => {
        const partes = partesValorRateioEmpresas(row.valorBaixado, rateioPercentuaisPlanoContas);
        const valor = partes[rateioEmpresaRecorte] ?? 0;
        return {
          ...row,
          idEmpresa: rateioEmpresaRecorte,
          empresa: labelEmpresaDfc(rateioEmpresaRecorte),
          valorBaixado: valor,
        };
      });
    } else if (rateioEmpresasRegras?.length) {
      if (temRateioFornecedor && poolRateioDetalhe && idEmpresas.length > 0) {
        rows = montarDetalheRateioEmpresasFiltro(linhas, rateioEmpresasRegras, idEmpresas);
      } else {
        rows = aplicarRecorteRateioDetalhe(linhas, rateioEmpresasRegras, rateioEmpresaRecorte);
        if (buscaAmpliadaEmpresas && idEmpresas.length > 0) {
          rows = rows.filter((row) =>
            linhaMatchesEmpresasDfc({ idEmpresa: row.idEmpresa, empresa: row.empresa }, idEmpresas),
          );
        }
      }
    } else if (buscaAmpliadaEmpresas && idEmpresas.length > 0) {
      rows = rows.filter((row) =>
        linhaMatchesEmpresasDfc({ idEmpresa: row.idEmpresa, empresa: row.empresa }, idEmpresas),
      );
    }
    return rows;
  }, [
    linhas,
    rateioEmpresasRegras,
    rateioEmpresaRecorte,
    rateioPercentuaisPlanoContas,
    buscaAmpliadaEmpresas,
    poolRateioDetalhe,
    idEmpresas,
  ]);

  const prioridadeEfetiva = useCallback(
    (row: DfcAgendamentoDetalheLinha): { efetiva: DfcPrioridade | null; origem: 'override' | 'conta' | null; override: DfcPrioridade | null } => {
      const chaveLanc = `${row.idEmpresa}#${row.tipoRef}#${row.id}`;
      const override = prioridadesLancsMap[chaveLanc] ?? null;
      if (override != null) return { efetiva: override, origem: 'override', override };
      if (row.idContaFinanceiro != null) {
        const pc = prioridadesContasMap[`${row.idEmpresa}#${row.idContaFinanceiro}`];
        if (pc != null) return { efetiva: pc, origem: 'conta', override: null };
      }
      return { efetiva: null, origem: null, override: null };
    },
    [prioridadesContasMap, prioridadesLancsMap]
  );

  const prioridadeEfetivaValor = useCallback(
    (row: DfcAgendamentoDetalheLinha) => prioridadeEfetiva(row).efetiva,
    [prioridadeEfetiva],
  );

  const colunasGrade = useMemo(
    () =>
      montarColunasGradeDfcDetalhe({
        incluirDescricao: true,
        incluirCompetencia: filtroPorCompetencia,
        incluirPrioridade: true,
      }),
    [filtroPorCompetencia],
  );

  const getCellText = useCallback(
    (row: DfcAgendamentoDetalheLinha, colId: string) =>
      criarGetCellTextDfcDetalhe(prioridadeEfetivaValor)(row, colId),
    [prioridadeEfetivaValor],
  );

  const valueForSort = useCallback(
    (row: DfcAgendamentoDetalheLinha, colId: string) =>
      criarValueForSortDfcDetalhe(prioridadeEfetivaValor)(row, colId),
    [prioridadeEfetivaValor],
  );

  const grade = useGradeFiltrosExcel({
    rows: linhasRateioEmpresas,
    columnIds: colunasGrade,
    getCellText,
    valueForSort,
    defaultSortLevels: [{ id: 'valor', dir: 'desc' }],
    dateColumnIds: filtroPorCompetencia
      ? ['dataVencimento', 'dataCompetencia', 'dataBaixa']
      : ['dataVencimento', 'dataBaixa'],
  });

  useEffect(() => {
    grade.limparFiltrosGrade();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetar grade ao trocar recorte carregado
  }, [idListKey, idShop9ListKey, periodo, idEmpresasKey]);

  const linhasExibidas = grade.rowsExibidas;
  const colCount = colunasGrade.length + (comRateioSimples ? 1 : 0);

  const somaFiltrada = useMemo(
    () => linhasExibidas.reduce((s, r) => s + r.valorBaixado, 0),
    [linhasExibidas],
  );

  const somaRateioFiltrada = useMemo(() => {
    if (!comRateioSimples) return null;
    const empresas = idEmpresasRateioSimples ?? idEmpresas;
    let refrigeracao = 0;
    let rnMarques = 0;
    let exibido = 0;
    for (const row of linhasExibidas) {
      const p = periodoLinhaDetalheSimples(
        filtroPorCompetencia ? dataCompetenciaLinha(row) : row.dataBaixa,
        granularidade,
      );
      const ctx = p ? rateioSimplesPorPeriodo?.get(p) : undefined;
      const parts = rateioValoresLinhaSimples(row.valorBaixado, ctx);
      if (parts) {
        refrigeracao += parts.refrigeracao;
        rnMarques += parts.rnMarques;
        exibido += valorSimplesGradePorEmpresas(
          row.valorBaixado,
          parts.refrigeracao,
          parts.rnMarques,
          empresas,
        );
      }
    }
    return { refrigeracao, rnMarques, exibido };
  }, [
    comRateioSimples,
    linhasExibidas,
    granularidade,
    rateioSimplesPorPeriodo,
    idEmpresasRateioSimples,
    idEmpresas,
    filtroPorCompetencia,
  ]);

  const temFiltroGrade = grade.temFiltrosOuOrdem;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`relative flex w-full ${
          comRateioSimples || filtroPorCompetencia ? 'max-w-6xl' : 'max-w-5xl'
        } max-h-[min(92vh,880px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800 font-sans`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dfc-detalhe-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0 pr-2">
            <h2 id="dfc-detalhe-titulo" className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
              Detalhe dos lançamentos
              {contaComRateioEmpresas ? (
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300"
                  title="Conta com rateio entre empresas"
                  aria-label="Conta com rateio entre empresas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="6" cy="6" r="2" />
                    <circle cx="18" cy="6" r="2" />
                    <circle cx="12" cy="18" r="2" />
                    <path d="M8 6h8M7.2 7.6 10.8 16.4M16.8 7.6 13.2 16.4" />
                  </svg>
                </span>
              ) : null}
            </h2>
            <p className="mt-0.5 break-words text-sm text-slate-600 dark:text-slate-400">{titulo}</p>
            {!loading && !erro && linhas.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {linhasExibidas.length.toLocaleString('pt-BR')} de {linhas.length.toLocaleString('pt-BR')} lançamento
                {linhas.length === 1 ? '' : 's'} · use ▾ no cabeçalho para filtrar e classificar
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {temFiltroGrade ? (
              <button
                type="button"
                onClick={() => grade.limparFiltrosGrade()}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                Limpar filtros da grade
              </button>
            ) : null}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-600 dark:hover:text-slate-100"
            aria-label="Fechar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          </div>
        </div>

        <div ref={grade.tableScrollRef} className="relative min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400 animate-pulse">Carregando…</div>
          ) : erro ? (
            <div className="px-4 py-6 text-sm text-amber-800 dark:text-amber-200">{erro}</div>
          ) : linhas.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Nenhum lançamento neste recorte.</div>
          ) : (
            <table className="w-full table-fixed border-collapse text-left text-sm min-w-0">
              <colgroup>
                <col style={{ width: comRateioSimples ? '5%' : '6%' }} />
                <col style={{ width: comRateioSimples ? '8%' : '10%' }} />
                <col style={{ width: comRateioSimples ? '14%' : '17%' }} />
                <col style={{ width: comRateioSimples ? '12%' : '14%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                {filtroPorCompetencia ? <col style={{ width: '7%' }} /> : null}
                <col style={{ width: comRateioSimples ? '8%' : '10%' }} />
                {comRateioSimples ? <col style={{ width: '14%' }} /> : null}
                <col style={{ width: comRateioSimples ? '13%' : '15%' }} />
              </colgroup>
              <thead className="sticky top-0 z-[1]">
                <tr className="bg-primary-600 text-left text-white shadow-sm">
                  {colunasGrade.map((colId) => (
                    <DfcDetalheCabecalhoTh
                      key={colId}
                      colId={colId}
                      label={rotuloColunaGradeDfc(colId, rotuloColunaDataBaixa)}
                      grade={grade}
                      align={colId === 'valor' ? 'right' : 'left'}
                      className="leading-tight"
                    />
                  ))}
                  {comRateioSimples ? (
                    <th className="px-2 py-2 text-left text-xs font-semibold leading-tight">
                      Rateio Simples
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {linhasExibidas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colCount}
                      className="border-t border-slate-100 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700/80 dark:text-slate-400"
                    >
                      Nenhum lançamento corresponde aos filtros.
                    </td>
                  </tr>
                ) : (
                  linhasExibidas.map((row, idx) => {
                    const { efetiva, origem, override } = prioridadeEfetiva(row);
                    const exibir = override ?? efetiva;
                    const hintPlano =
                      origem === 'conta' && efetiva != null && override == null
                        ? `Prioridade do plano de contas: ${DFC_PRIORIDADE_LABEL_CURTO[efetiva]}`
                        : origem === 'override' && efetiva != null
                          ? `Prioridade do lançamento: ${DFC_PRIORIDADE_LABEL_CURTO[efetiva]}`
                          : undefined;
                    const periodoLinha = periodoLinhaDetalheSimples(
                      filtroPorCompetencia ? dataCompetenciaLinha(row) : row.dataBaixa,
                      granularidade,
                    );
                    const ctxRateio = periodoLinha ? rateioSimplesPorPeriodo?.get(periodoLinha) : undefined;
                    const partsRateio = rateioValoresLinhaSimples(row.valorBaixado, ctxRateio);
                    return (
                      <tr
                        key={`${row.tipoRef}-${row.id}-${dataCompetenciaLinha(row) ?? ''}-${idx}`}
                        className="border-t border-slate-100 odd:bg-white even:bg-slate-50/90 dark:border-slate-700/80 dark:odd:bg-slate-800/30 dark:even:bg-slate-800/55"
                      >
                        <td className="px-2 py-1.5 align-top tabular-nums text-slate-700 dark:text-slate-300">{row.id}</td>
                        <td className="hyphens-auto min-w-0 break-words px-2 py-1.5 align-top text-slate-700 dark:text-slate-300">
                          {row.empresa?.trim() || '—'}
                        </td>
                        <td className="hyphens-auto min-w-0 break-words px-2 py-1.5 align-top text-slate-800 dark:text-slate-200">
                          {row.descricaoLancamento ?? '—'}
                        </td>
                        <td className="hyphens-auto min-w-0 break-words px-2 py-1.5 align-top text-slate-700 dark:text-slate-300">
                          {row.nome ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 align-top tabular-nums text-slate-600 dark:text-slate-400">
                          {fmtDataBr(row.dataVencimento)}
                        </td>
                        {filtroPorCompetencia ? (
                          <>
                            <td className="whitespace-nowrap px-2 py-1.5 align-top tabular-nums text-slate-600 dark:text-slate-400">
                              {fmtDataBr(dataCompetenciaLinha(row))}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 align-top tabular-nums text-slate-600 dark:text-slate-400">
                              {fmtDataBr(row.dataBaixa)}
                            </td>
                          </>
                        ) : (
                          <td className="whitespace-nowrap px-2 py-1.5 align-top tabular-nums text-slate-600 dark:text-slate-400">
                            {fmtDataBr(row.dataBaixa)}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-2 py-1.5 text-right align-top tabular-nums font-medium text-slate-900 dark:text-slate-100">
                          {nf.format(row.valorBaixado)}
                        </td>
                        {comRateioSimples ? (
                          <td className="px-1.5 py-1.5 align-top">
                            {partsRateio && ctxRateio ? (
                              <DreDetalheRateioSimplesCelula
                                ctx={ctxRateio}
                                valorOriginal={row.valorBaixado}
                                refrigeracao={partsRateio.refrigeracao}
                                rnMarques={partsRateio.rnMarques}
                                idEmpresas={idEmpresasRateioSimples ?? idEmpresas}
                                rotuloPeriodo={
                                  periodoLinha
                                    ? rotuloPeriodoCabecalho(periodoLinha, granularidade)
                                    : undefined
                                }
                              />
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-2 py-1.5 align-top">
                          <PrioridadeSomenteLeitura prioridade={exibir} hint={hintPlano} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
          <DfcDetalheGradeFiltroPortal grade={grade} zIndex={10100} />
        </div>

        {!loading && !erro && linhas.length > 0 ? (
          <div className="flex shrink-0 flex-col gap-1 border-t border-primary-700/30 bg-primary-600 px-4 py-2.5 text-sm text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Total{temFiltroGrade ? ' (filtrado)' : ''}</span>
              <span className="font-semibold tabular-nums">{nf.format(somaFiltrada)}</span>
            </div>
            {somaRateioFiltrada ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary-500/40 pt-1.5 text-xs text-primary-100">
                <span>
                  Rateio Simples
                  {periodo ? ` · ${rotuloPeriodoCabecalho(periodo, granularidade)}` : temFiltroGrade ? ' (filtrado)' : ''}
                </span>
                <span className="tabular-nums">
                  Exibido {nf.format(somaRateioFiltrada.exibido)}
                  <span className="opacity-80">
                    {' '}
                    (Ref {nf.format(somaRateioFiltrada.refrigeracao)} · RN {nf.format(somaRateioFiltrada.rnMarques)})
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {truncado && !loading && linhas.length > 0 ? (
          <div className="shrink-0 border-t border-amber-200/80 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
            Lista limitada a 2000 linhas — refine o período ou expanda a árvore.
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
