import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchDfcAgendamentosDetalhe, fetchDreSaidasNomusDetalhe, fetchDreSaidasSoAcoDetalhe, type DfcAgendamentoDetalheLinha } from '../../../api/financeiro';
import { DFC_PRIORIDADE_LABEL_CURTO, type DfcPrioridade } from '../../../api/dfcPrioridade';
import { linhaMatchesEmpresasDfc, labelEmpresaDfc } from './dfcEmpresas';
import {
  SortableTh,
  PrioridadeSomenteLeitura,
  compareStr,
  compareYmd,
  nextSortDir,
  type SortDir,
} from './dfcDetalheTabelaUtils';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, textoPassaBuscaLivre } from '../../../utils/textoLivreBusca';
import { rotuloPeriodoCabecalho } from './dfcPeriodos';
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

const inputFiltroClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 text-sm min-w-0';

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

function linhaPassaFiltros(
  row: DfcAgendamentoDetalheLinha,
  codigo: string,
  descricao: string,
  fornecedor: string,
  datas: string,
  filtroPorCompetencia: boolean,
): boolean {
  if (codigo.trim() && !textoPassaBuscaLivre(codigo, String(row.id))) return false;
  if (descricao.trim() && !textoPassaBuscaLivre(descricao, row.descricaoLancamento ?? '')) return false;
  if (fornecedor.trim() && !textoPassaBuscaLivre(fornecedor, row.nome ?? '')) return false;
  if (datas.trim()) {
    const hay = [
      fmtDataBr(row.dataVencimento),
      fmtDataBr(filtroPorCompetencia ? dataCompetenciaLinha(row) : row.dataBaixa),
      fmtDataBr(dataCompetenciaLinha(row)),
      row.dataVencimento ?? '',
      dataCompetenciaLinha(row) ?? '',
      row.dataBaixa ?? '',
    ].join(' ');
    if (!textoPassaBuscaLivre(datas, hay)) return false;
  }
  return true;
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
    tipoRef: 'A' | 'L',
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
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroDescricao, setFiltroDescricao] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [filtroDatas, setFiltroDatas] = useState('');
  type ColSort = 'id' | 'empresa' | 'descricao' | 'nome' | 'dataVencimento' | 'dataBaixa' | 'dataCompetencia' | 'valor' | 'rateio' | 'prioridade';
  const [sortKey, setSortKey] = useState<ColSort>('valor');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const comRateioSimples = rateioSimplesPorPeriodo != null && rateioSimplesPorPeriodo.size > 0;
  const contaComRateioEmpresas =
    (rateioEmpresasRegras?.length ?? 0) > 0 || rateioPercentuaisPlanoContas != null;
  const colCount = (comRateioSimples ? 9 : 8) + (filtroPorCompetencia ? 1 : 0);
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

  const limparFiltros = useCallback(() => {
    setFiltroCodigo('');
    setFiltroDescricao('');
    setFiltroFornecedor('');
    setFiltroDatas('');
  }, []);

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

    setFiltroCodigo('');
    setFiltroDescricao('');
    setFiltroFornecedor('');
    setFiltroDatas('');

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

  const prioridadeOrdenacao = useCallback(
    (row: DfcAgendamentoDetalheLinha): number => {
      const { efetiva, override } = prioridadeEfetiva(row);
      const p = override ?? efetiva;
      return p ?? 99;
    },
    [prioridadeEfetiva]
  );

  const onSortCol = useCallback((key: string) => {
    const k = key as ColSort;
    setSortKey((prevKey) => {
      setSortDir((prevDir) => nextSortDir(prevKey, k, prevDir));
      return k;
    });
  }, []);

  const linhasFiltradas = useMemo(
    () =>
      linhasRateioEmpresas.filter((row) =>
        linhaPassaFiltros(row, filtroCodigo, filtroDescricao, filtroFornecedor, filtroDatas, filtroPorCompetencia)
      ),
    [linhasRateioEmpresas, filtroCodigo, filtroDescricao, filtroFornecedor, filtroDatas, filtroPorCompetencia]
  );

  const linhasOrdenadas = useMemo(() => {
    if (!linhasFiltradas.length) return [];
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...linhasFiltradas].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'id':
          cmp = a.id - b.id;
          break;
        case 'empresa':
          cmp = compareStr(a.empresa, b.empresa);
          break;
        case 'descricao':
          cmp = compareStr(a.descricaoLancamento, b.descricaoLancamento);
          break;
        case 'nome':
          cmp = compareStr(a.nome, b.nome);
          break;
        case 'dataVencimento':
          cmp = compareYmd(a.dataVencimento, b.dataVencimento);
          break;
        case 'dataBaixa':
          cmp = compareYmd(a.dataBaixa, b.dataBaixa);
          break;
        case 'dataCompetencia':
          cmp = compareYmd(dataCompetenciaLinha(a), dataCompetenciaLinha(b));
          break;
        case 'valor':
          cmp = a.valorBaixado - b.valorBaixado;
          break;
        case 'rateio': {
          const pa = periodoLinhaDetalheSimples(
            filtroPorCompetencia ? dataCompetenciaLinha(a) : a.dataBaixa,
            granularidade,
          );
          const pb = periodoLinhaDetalheSimples(
            filtroPorCompetencia ? dataCompetenciaLinha(b) : b.dataBaixa,
            granularidade,
          );
          const ra = rateioValoresLinhaSimples(
            a.valorBaixado,
            pa ? rateioSimplesPorPeriodo?.get(pa) : undefined,
          );
          const rb = rateioValoresLinhaSimples(
            b.valorBaixado,
            pb ? rateioSimplesPorPeriodo?.get(pb) : undefined,
          );
          cmp = (ra?.refrigeracao ?? 0) + (ra?.rnMarques ?? 0) - ((rb?.refrigeracao ?? 0) + (rb?.rnMarques ?? 0));
          break;
        }
        case 'prioridade':
          cmp = prioridadeOrdenacao(a) - prioridadeOrdenacao(b);
          break;
        default:
          cmp = 0;
      }
      return cmp * mul;
    });
  }, [linhasFiltradas, sortKey, sortDir, prioridadeOrdenacao, granularidade, rateioSimplesPorPeriodo, filtroPorCompetencia]);

  const somaFiltrada = useMemo(
    () => linhasFiltradas.reduce((s, r) => s + r.valorBaixado, 0),
    [linhasFiltradas]
  );

  const somaRateioFiltrada = useMemo(() => {
    if (!comRateioSimples) return null;
    const empresas = idEmpresasRateioSimples ?? idEmpresas;
    let refrigeracao = 0;
    let rnMarques = 0;
    let exibido = 0;
    for (const row of linhasFiltradas) {
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
    linhasFiltradas,
    granularidade,
    rateioSimplesPorPeriodo,
    idEmpresasRateioSimples,
    idEmpresas,
    filtroPorCompetencia,
  ]);

  const temFiltro =
    filtroCodigo.trim() ||
    filtroDescricao.trim() ||
    filtroFornecedor.trim() ||
    filtroDatas.trim();

  if (typeof document === 'undefined') return null;

  const mostrarFiltros = !loading && !erro && linhasRateioEmpresas.length > 0;

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
          </div>
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

        {mostrarFiltros ? (
          <div className="shrink-0 space-y-2 border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/35 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Filtrar neste recorte</span>
              <div className="flex items-center gap-2">
                {temFiltro ? (
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {linhasOrdenadas.length} de {linhas.length}
                  </span>
                ) : null}
                {temFiltro ? (
                  <button
                    type="button"
                    onClick={limparFiltros}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Limpar filtros
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex min-w-0 flex-nowrap items-end gap-2 overflow-x-auto pb-0.5 [scrollbar-gutter:stable]">
              <label className="flex w-[6.5rem] shrink-0 flex-col gap-0.5">
                <span className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">Código</span>
                <input
                  type="search"
                  value={filtroCodigo}
                  onChange={(e) => setFiltroCodigo(e.target.value)}
                  placeholder="Ex.: 301124 ou 301%"
                  className={inputFiltroClass}
                  autoComplete="off"
                />
              </label>
              <label className="flex w-[9.5rem] shrink-0 flex-col gap-0.5" title={filtroPorCompetencia ? 'Vencimento ou competência (ex.: 15/01 ou 2026-01)' : 'Vencimento ou data de baixa (ex.: 15/01 ou 2026-01)'}>
                <span className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">Datas</span>
                <input
                  type="search"
                  value={filtroDatas}
                  onChange={(e) => setFiltroDatas(e.target.value)}
                  placeholder="Ex.: 15/01 ou %/2026"
                  className={inputFiltroClass}
                  autoComplete="off"
                />
              </label>
              <label className="flex min-w-0 flex-1 basis-0 flex-col gap-0.5">
                <span className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">Descrição</span>
                <input
                  type="search"
                  value={filtroDescricao}
                  onChange={(e) => setFiltroDescricao(e.target.value)}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                  className={inputFiltroClass}
                  autoComplete="off"
                />
              </label>
              <label className="flex min-w-0 flex-1 basis-0 flex-col gap-0.5">
                <span className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">Fornecedor</span>
                <input
                  type="search"
                  value={filtroFornecedor}
                  onChange={(e) => setFiltroFornecedor(e.target.value)}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                  className={inputFiltroClass}
                  autoComplete="off"
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
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
                  <SortableTh label="Código" sortKey="id" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="Empresa" sortKey="empresa" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="Descrição" sortKey="descricao" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="Fornecedor" sortKey="nome" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh
                    label="Data Vencimento"
                    sortKey="dataVencimento"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSortCol}
                    className="leading-tight"
                  />
                  {filtroPorCompetencia ? (
                    <>
                      <SortableTh
                        label="Data Competência"
                        sortKey="dataCompetencia"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={onSortCol}
                        className="leading-tight"
                      />
                      <SortableTh
                        label="Data Baixa"
                        sortKey="dataBaixa"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={onSortCol}
                        className="leading-tight"
                      />
                    </>
                  ) : (
                    <SortableTh
                      label={rotuloColunaDataBaixa}
                      sortKey="dataBaixa"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={onSortCol}
                      className="leading-tight"
                    />
                  )}
                  <SortableTh
                    label="Valor"
                    sortKey="valor"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSortCol}
                    align="right"
                  />
                  {comRateioSimples ? (
                    <th className="px-2 py-2 text-left text-xs font-semibold leading-tight">
                      Rateio Simples
                    </th>
                  ) : null}
                  <SortableTh
                    label="Prioridade"
                    sortKey="prioridade"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSortCol}
                    className="leading-tight"
                  />
                </tr>
              </thead>
              <tbody>
                {linhasFiltradas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colCount}
                      className="border-t border-slate-100 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700/80 dark:text-slate-400"
                    >
                      Nenhum lançamento corresponde aos filtros.
                    </td>
                  </tr>
                ) : (
                  linhasOrdenadas.map((row, idx) => {
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
        </div>

        {!loading && !erro && linhas.length > 0 ? (
          <div className="flex shrink-0 flex-col gap-1 border-t border-primary-700/30 bg-primary-600 px-4 py-2.5 text-sm text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Total{temFiltro ? ' (filtrado)' : ''}</span>
              <span className="font-semibold tabular-nums">{nf.format(somaFiltrada)}</span>
            </div>
            {somaRateioFiltrada ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary-500/40 pt-1.5 text-xs text-primary-100">
                <span>
                  Rateio Simples
                  {periodo ? ` · ${rotuloPeriodoCabecalho(periodo, granularidade)}` : temFiltro ? ' (filtrado)' : ''}
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
