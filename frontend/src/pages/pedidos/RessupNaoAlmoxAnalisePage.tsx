import { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue, startTransition } from 'react';
import * as XLSX from 'xlsx';
import { useOnSincronizado } from '../../hooks/useOnSincronizado';
import { useAuth } from '../../contexts/AuthContext';
import {
  listarRessupNaoAlmoxRegistroPreview,
  obterOpcoesFiltroRessupNaoAlmox,
  obterOpcoesFiltroCascataRessupNaoAlmox,
  buscarOpcoesFiltroRessupNaoAlmox,
  gravarRessupNaoAlmoxAnalise,
  atualizarRessupNaoAlmoxAnalise,
  processarRessupNaoAlmoxAnalise,
  concluirRessupNaoAlmoxAnalise,
  listarRessupNaoAlmoxAnalises,
  obterRessupNaoAlmoxAnalise,
  fetchRessupNaoAlmoxCatalogo,
  saveCatalogoFundivelNaoAlmox,
  fetchRessupNaoAlmoxEstoque,
  obterRessupNaoAlmoxPcPendDetalhes,
  type RessupNaoAlmoxAnalisePayloadV1,
  type RessupNaoAlmoxAnaliseListItem,
  type RessupNaoAlmoxRowUserInputs,
  type RessupNaoAlmoxPcPendLinha,
} from '../../api/ressupNaoAlmox';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import ModalClassificarGrade, { type ColunaClassificavel } from '../../components/grade/ModalClassificarGrade';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import { rowMatchesColumnFilters } from '../../hooks/useGradeFiltrosExcel';
import {
  encodeNumericColumnFilter,
  isNumericColumnFilter,
  parseNumeroFiltroInput,
  parseNumericColumnFilter,
  type NumericFilterOp,
} from '../../utils/gradeFiltroNumerico';
import ModalPcPendDetalhes from '../../components/ressupAlmox/ModalPcPendDetalhes';
import ModalEmpenhoRessup from '../../components/ressupAlmox/ModalEmpenhoRessup';
import {
  RUPTURA_CELL_CLASS,
  RUPTURA_ROW_CLASS,
} from '../../components/ressupAlmox/empenhoModalUtils';
import ModalConsultaEstoqueDetalhe from '../../components/pcp/ModalConsultaEstoqueDetalhe';
import TabelaDetalheSolicitacao from '../../components/pcp/TabelaDetalheSolicitacao';
import TabelaDetalheCotacao from '../../components/pcp/TabelaDetalheCotacao';
import {
  obterScDetalhe,
  obterCotacaoDetalhe,
  type ScDetalhe,
  type CotacaoDetalhe,
} from '../../api/consultaEstoque';
import type { RessupEmpenhoPedidoResultado } from '../../api/compras';
import BotaoObservacaoCelula from '../../components/ressupAlmox/BotaoObservacaoCelula';
import ModalObservacaoCelula from '../../components/ressupAlmox/ModalObservacaoCelula';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import ModalEstoqueNaoAlmox, {
  type EstoqueNaoAlmoxResultado,
} from '../../components/ressupNaoAlmox/ModalEstoqueNaoAlmox';
import ModalRelacaoFundivel from '../../components/ressupNaoAlmox/ModalRelacaoFundivel';
import {
  hasRessupObservacao,
  isRessupObsColKey,
  RESSUP_TD_COM_OBS_CLASS,
  type RessupObsColKey,
} from '../../utils/ressupNaoAlmoxObservacoes';
import { compareRowsBySortLevels, type SortLevel } from '../../hooks/useGradeFiltrosExcel';
import {
  SORT_DEFAULT_RESSUP_NAO_ALMOX,
  getOrderLabelsForRessupNaoAlmoxCol,
  isRessupNaoAlmoxColData,
  isRessupNaoAlmoxColNumeric,
  parseDateSortValue,
  sortLevelsEqual,
} from '../../utils/ressupNaoAlmoxGradeSort';
import {
  RESSUP_NAO_ALMOX_DEFAULT_COL_WIDTHS,
  clampColWidth,
  persistRessupNaoAlmoxColWidths,
  readRessupNaoAlmoxColWidths,
} from '../../utils/ressupNaoAlmoxGradeUi';
import { downloadRessupNaoAlmoxPdf } from '../../utils/exportRessupNaoAlmoxPdf';
import { imageUrlToDataUrl } from '../../utils/imageDataUrl';
import { normalizarCodProduto } from '../../utils/ressupNaoAlmoxDescricaoSimplificada';
import {
  aplicarCatalogoRessupNaoAlmox,
  codigoPintadoDoCatalogo,
  patchCatalogoFundivelRuntime,
} from '../../utils/ressupNaoAlmoxCatalogoRuntime';
import {
  estoqueExibicaoGrade,
  somaSetoresErp,
  temEstoqueProducaoManual,
} from '../../utils/ressupNaoAlmoxCalculos';
import {
  RESSUP_NAO_ALMOX_COLETAS,
  coletaExcluiMarcenaria,
  isColetaFundiveis,
} from '../../utils/ressupNaoAlmoxColetas';

const FILTROS_DROPDOWN_Z = 10050;

function splitPipeFiltro(s: string): string[] {
  return s.split('|').map((x) => x.trim()).filter(Boolean);
}

function filtrosNovaAnalisePayload(codigo: string, descricao: string, coleta: string) {
  return {
    codigos: splitPipeFiltro(codigo),
    descricoes: splitPipeFiltro(descricao),
    coletas: splitPipeFiltro(coleta),
  };
}

const COL_DEFS = [
  { key: 'codigo', label: 'Código' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'undMedida', label: 'Und Medida' },
  { key: 'coleta', label: 'Coleta' },
  { key: 'compraRecorrente', label: 'Compra recorrente' },
  { key: 'itemCritico', label: 'Item crítico' },
  { key: 'qtdeEmp', label: 'Qtde Emp' },
  { key: 'cm', label: 'CM' },
  { key: 'vm', label: 'VM' },
  { key: 'cobertura', label: 'Cobertura' },
  { key: 'dataSolicit', label: 'Data Solicit.' },
  { key: 'dataNecess', label: 'Data Necess.' },
  { key: 'qtdSolicit', label: 'Qtd Solicit.' },
  { key: 'qtdeSug', label: 'Qtde Sug' },
  { key: 'dataNecessSug', label: 'Data Necess Sug' },
  { key: 'coberturaSug', label: 'Cobertura Sug' },
  { key: 'qtdAprov', label: 'Qtd Aprov' },
  { key: 'dataNecessAprov', label: 'Data Necess Aprov' },
  { key: 'novaCobertura', label: 'Nova Cobertura' },
  { key: 'estoqAtual', label: 'Estoq Atual' },
  { key: 'dataUltEntrada', label: 'Data Ult Entrada' },
  { key: 'precoAnt', label: 'Preço Ant' },
  { key: 'pcPend', label: 'PC Pend' },
  { key: 'agPag', label: 'Ag Pag' },
  { key: 'saldoProjetado', label: 'Saldo projetado' },
] as const;

type ColKey = (typeof COL_DEFS)[number]['key'];

/** Colunas preenchidas pelo usuário na grade (gravadas no snapshot). */
const NUMERIC_INPUT_KEYS = new Set<ColKey>(['qtdeSug', 'qtdAprov']);
const DATE_INPUT_KEYS = new Set<ColKey>(['dataNecessSug', 'dataNecessAprov']);
const EDITABLE_KEYS = new Set<ColKey>([...NUMERIC_INPUT_KEYS, ...DATE_INPUT_KEYS]);

/**
 * Colunas que ficam ocultas SOMENTE na grade (visíveis via tooltip em outra célula),
 * mas continuam aparecendo no XLSX e no snapshot gravado.
 */
const GRADE_OCULTAS_COL_KEYS = new Set<ColKey>([
  'undMedida',
  'dataSolicit',
  'dataNecess',
  'dataUltEntrada',
  'precoAnt',
]);

const COL_DEFS_GRADE = COL_DEFS.filter((c) => !GRADE_OCULTAS_COL_KEYS.has(c.key));

/** Visíveis na grade somente após a análise ser marcada como processada (ou concluída, leitura). */
const COLUNAS_APROVACAO_GRADE = new Set<ColKey>(['qtdAprov', 'dataNecessAprov', 'novaCobertura']);

/** Grade enxuta antes de gravar a análise no histórico (após gravar, exibe todas as colunas). */
const COLUNAS_PREVIEW_ANALISE_NOVA = new Set<ColKey>(['codigo', 'descricao', 'coleta', 'estoqAtual']);

type RowUserInputs = RessupNaoAlmoxRowUserInputs;

type ExcelFilterDraft = {
  search: string;
  selected: string[];
  numericOp?: NumericFilterOp | null;
  numericV1?: string;
  numericV2?: string;
};

type SortState = { key: ColKey; direction: 'asc' | 'desc' } | null;

const STORAGE_COL_OCULTAS = 'ressupNaoAlmox.colunasOcultas.v1';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition shrink-0';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

function loadColunasOcultasStorage(): string[] {
  try {
    const s = sessionStorage.getItem(STORAGE_COL_OCULTAS);
    if (!s) return [];
    const p = JSON.parse(s) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function getRowValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k)) return row[k];
  }
  const lower = keys[0].toLowerCase();
  const found = Object.keys(row).find((key) => key.toLowerCase() === lower);
  return found != null ? row[found] : undefined;
}

function getIdProdutoFromRow(row: Record<string, unknown>): number | null {
  const v = getRowValue(row, ['Id Produto', 'id produto', 'idProduto']);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getVmRawFromRow(row: Record<string, unknown>): number {
  const vm = Number(getRowValue(row, ['VM', 'vm']) ?? 0);
  return Number.isFinite(vm) ? vm : NaN;
}

function atributoOpcaoEhSim(valor: unknown): boolean {
  return String(valor ?? '').trim().toLowerCase() === 'sim';
}

function linhaPassaFiltroCompraRecorrente(
  row: Record<string, unknown>,
  filtro: '' | 'Sim' | 'Não'
): boolean {
  if (filtro === '') return true;
  const opcao = getRowValue(row, ['Compra Recorrente', 'compra recorrente']);
  const ehSim = atributoOpcaoEhSim(opcao);
  if (filtro === 'Sim') return ehSim;
  return !ehSim;
}

/** Converte filtros gravados no snapshot para parâmetros da API de preview. */
function aplicadoParaFiltrosPreview(aplicado: {
  codigo: string;
  descricao: string;
  coleta: string;
  considerarRequisicoes: boolean;
}) {
  const splitCsv = (s: string) => s.split(/,\s*/).map((x) => x.trim()).filter(Boolean);
  return {
    codigo: splitCsv(aplicado.codigo).join('|') || undefined,
    descricao: splitCsv(aplicado.descricao).join('|') || undefined,
    coleta: splitCsv(aplicado.coleta).join('|') || undefined,
    considerarRequisicoes: aplicado.considerarRequisicoes,
  };
}

/** Mescla linhas da API (conjunto completo) com snapshot gravado, preservando edições por idProduto. */
function mesclarLinhasHistoricoComApi(
  snapshotRows: Record<string, unknown>[],
  apiRows: Record<string, unknown>[],
  userInputsSnapshot: Record<string, RowUserInputs>
): { linhas: Record<string, unknown>[]; userInputs: Record<string, RowUserInputs> } {
  const snapshotById = new Map<number, Record<string, unknown>>();
  const inputsById = new Map<number, RowUserInputs>();
  snapshotRows.forEach((r, idx) => {
    const id = getIdProdutoFromRow(r);
    if (!id) return;
    snapshotById.set(id, r);
    const key = typeof r.__rowKey === 'string' && r.__rowKey ? r.__rowKey : `row-${idx}`;
    const inputs = userInputsSnapshot[key];
    if (inputs && Object.keys(inputs).length > 0) inputsById.set(id, inputs);
  });

  const linhas: Record<string, unknown>[] = [];
  const userInputs: Record<string, RowUserInputs> = {};
  const usedIds = new Set<number>();

  apiRows.forEach((apiRow, idx) => {
    const id = getIdProdutoFromRow(apiRow);
    const snap = id != null ? snapshotById.get(id) : undefined;
    const rowKey = `row-${idx}`;
    const row =
      snap != null
        ? { ...apiRow, ...snap, __rowKey: rowKey }
        : { ...apiRow, __rowKey: rowKey };
    linhas.push(row);
    if (id != null) {
      usedIds.add(id);
      const inputs = inputsById.get(id);
      if (inputs) userInputs[rowKey] = { ...inputs };
    }
  });

  snapshotRows.forEach((snap, idx) => {
    const id = getIdProdutoFromRow(snap);
    if (id != null && usedIds.has(id)) return;
    const rowKey = `row-${linhas.length}`;
    linhas.push({ ...snap, __rowKey: rowKey });
    const oldKey = typeof snap.__rowKey === 'string' && snap.__rowKey ? snap.__rowKey : `row-${idx}`;
    const inputs = userInputsSnapshot[oldKey];
    if (inputs && Object.keys(inputs).length > 0) userInputs[rowKey] = { ...inputs };
  });

  return { linhas, userInputs };
}

function getPcPendNumerico(row: Record<string, unknown>): number {
  const n = Number(getRowValue(row, ['PC', 'pc']) ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getQtdeEmpNumerico(row: Record<string, unknown>): number {
  const n = Number(getRowValue(row, ['Qtde Empenhada', 'qtde empenhada']) ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getAgPagNumerico(row: Record<string, unknown>): number {
  const n = Number(getRowValue(row, ['Ag Pag', 'ag pag']) ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getEstoqAtualNumerico(row: Record<string, unknown>, userInput?: RowUserInputs): number {
  const exib = estoqueExibicaoGrade(userInput);
  if (exib != null) return exib;
  const n = Number(getRowValue(row, ['Saldo Estoque', 'Saldo de Estoque', 'saldo estoque']) ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getNomeColetaFromRow(row: Record<string, unknown>): string {
  return String(getRowValue(row, ['Nome Coleta', 'nome coleta']) ?? '').trim();
}

function buildInitialInputsFromRow(row: Record<string, unknown>): RowUserInputs {
  const cod = String(getRowValue(row, ['Codigo do Produto', 'codigo do produto']) ?? '').trim();
  const codPintadoRaw = row['_codigoPintado'];
  const codPintado =
    typeof codPintadoRaw === 'string' && codPintadoRaw.trim()
      ? codPintadoRaw.trim()
      : cod ? codigoPintadoDoCatalogo(cod) : null;
  const out: RowUserInputs = {};
  if (codPintado) out.codigoPintado = codPintado;
  return out;
}

function buildUserInputsFromRows(rows: Record<string, unknown>[]): Record<string, RowUserInputs> {
  const out: Record<string, RowUserInputs> = {};
  rows.forEach((row, idx) => {
    const key =
      typeof row.__rowKey === 'string' && row.__rowKey.trim()
        ? row.__rowKey
        : `row-${idx}`;
    const init = buildInitialInputsFromRow(row);
    if (Object.keys(init).length > 0) out[key] = init;
  });
  return out;
}

/** Preserva edições de estoque/código pintado ao re-filtrar (chave por idProduto). */
function mesclarUserInputsRefiltro(
  mapped: Record<string, unknown>[],
  fresh: Record<string, RowUserInputs>,
  prevLinhas: Record<string, unknown>[],
  prevInputs: Record<string, RowUserInputs>
): Record<string, RowUserInputs> {
  const inputsById = new Map<number, RowUserInputs>();
  prevLinhas.forEach((r, idx) => {
    const id = getIdProdutoFromRow(r);
    if (!id) return;
    const key = typeof r.__rowKey === 'string' && r.__rowKey.trim() ? r.__rowKey : `row-${idx}`;
    const inp = prevInputs[key];
    if (!inp) return;
    if (
      inp.estoqueEmProducao ||
      (inp.estoqueTotal != null && Number.isFinite(inp.estoqueTotal)) ||
      inp.codigoPintado
    ) {
      inputsById.set(id, inp);
    }
  });
  if (inputsById.size === 0) return fresh;
  const out = { ...fresh };
  mapped.forEach((row, idx) => {
    const id = getIdProdutoFromRow(row);
    if (!id) return;
    const saved = inputsById.get(id);
    if (!saved) return;
    const rowKey = typeof row.__rowKey === 'string' && row.__rowKey.trim() ? row.__rowKey : `row-${idx}`;
    out[rowKey] = { ...out[rowKey], ...saved };
  });
  return out;
}

function fmtNum(v: unknown): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
}

function fmtData(v: unknown): string {
  if (v == null || v === '') return '—';
  try {
    const d = typeof v === 'string' ? new Date(v) : new Date(Number(v));
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(v);
  }
}

function fmtPreco(v: unknown): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Saldo projetado = −Qtde Emp + Qtd Solicit. + Estoq Atual (modal) + PC Pend + Ag Pag */
function calcSaldoProjetado(row: Record<string, unknown>, userInput?: RowUserInputs): number | null {
  const estFromInput = estoqueExibicaoGrade(userInput);
  const est =
    estFromInput ??
    Number(getRowValue(row, ['Saldo Estoque', 'Saldo de Estoque', 'saldo estoque']) ?? 0);
  const emp = Number(getRowValue(row, ['Qtde Empenhada', 'qtde empenhada']) ?? 0);
  const qLiv = Number(getRowValue(row, ['Qtd Liberada', 'qtd liberada']) ?? 0);
  const pc = Number(getRowValue(row, ['PC', 'pc']) ?? 0);
  const ag = Number(getRowValue(row, ['Ag Pag', 'ag pag']) ?? 0);
  if (![est, emp, qLiv, pc, ag].some((n) => Number.isFinite(n))) return null;
  return (
    (Number.isFinite(est) ? est : 0) -
    (Number.isFinite(emp) ? emp : 0) +
    (Number.isFinite(qLiv) ? qLiv : 0) +
    (Number.isFinite(pc) ? pc : 0) +
    (Number.isFinite(ag) ? ag : 0)
  );
}

function fmtSaldoProjetado(row: Record<string, unknown>, userInput?: RowUserInputs): string {
  const n = calcSaldoProjetado(row, userInput);
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Cobertura = Saldo projetado ÷ VM (VM = 0 usa 0,01 no divisor). */
function calcCobertura(row: Record<string, unknown>, userInput?: RowUserInputs): number | null {
  const saldo = calcSaldoProjetado(row, userInput);
  if (saldo == null) return null;
  let vm = Number(getRowValue(row, ['VM', 'vm']) ?? 0);
  if (!Number.isFinite(vm)) return null;
  if (vm === 0) vm = 0.01;
  return saldo / vm;
}

function fmtCobertura(row: Record<string, unknown>, userInput?: RowUserInputs): string {
  const n = calcCobertura(row, userInput);
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseQtdeUsuarioNum(v: string | null | undefined): number {
  const raw = (v ?? '').trim();
  if (!raw) return 0;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Cobertura Sug = (Saldo projetado + Qtde sug) ÷ VM */
function calcCoberturaSug(row: Record<string, unknown>, userInput?: RowUserInputs): number | null {
  const saldo = calcSaldoProjetado(row, userInput);
  if (saldo == null) return null;
  let vm = Number(getRowValue(row, ['VM', 'vm']) ?? 0);
  if (!Number.isFinite(vm)) return null;
  if (vm === 0) vm = 0.01;
  const qtdeSug = parseQtdeUsuarioNum(userInput?.qtdeSug);
  return (saldo + qtdeSug) / vm;
}

function fmtCoberturaSug(row: Record<string, unknown>, userInput?: RowUserInputs): string {
  const n = calcCoberturaSug(row, userInput);
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Nova Cobertura = (Saldo projetado + Qtde definid) ÷ VM — somente após processado. */
function calcNovaCobertura(row: Record<string, unknown>, userInput?: RowUserInputs): number | null {
  const saldo = calcSaldoProjetado(row, userInput);
  if (saldo == null) return null;
  let vm = Number(getRowValue(row, ['VM', 'vm']) ?? 0);
  if (!Number.isFinite(vm)) return null;
  if (vm === 0) vm = 0.01;
  const qtdAprov = parseQtdeUsuarioNum(userInput?.qtdAprov);
  return (saldo + qtdAprov) / vm;
}

function fmtNovaCobertura(row: Record<string, unknown>, userInput?: RowUserInputs): string {
  const n = calcNovaCobertura(row, userInput);
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtNumeroUsuario(v: string | null | undefined): string {
  const raw = (v ?? '').trim();
  if (!raw) return '—';
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function fmtDataUsuario(v: string | null | undefined): string {
  const raw = (v ?? '').trim();
  if (!raw) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  }
  return raw;
}

function getRessupCell(
  row: Record<string, unknown>,
  key: ColKey,
  userInput?: RowUserInputs
): string {
  if (EDITABLE_KEYS.has(key)) {
    const raw = userInput?.[key];
    if (NUMERIC_INPUT_KEYS.has(key)) return fmtNumeroUsuario(raw);
    if (DATE_INPUT_KEYS.has(key)) return fmtDataUsuario(raw);
    return raw ?? '—';
  }
  switch (key) {
    case 'codigo':
      return String(getRowValue(row, ['Codigo do Produto', 'codigo do produto']) ?? '').trim() || '—';
    case 'descricao':
      return String(getRowValue(row, ['Descricao do Produto', 'descricao do produto']) ?? '').trim() || '—';
    case 'undMedida':
      return String(getRowValue(row, ['Unidade de Medida', 'unidade de medida']) ?? '').trim() || '—';
    case 'qtdeEmp':
      return fmtNum(getRowValue(row, ['Qtde Empenhada', 'qtde empenhada']));
    case 'cm':
      return fmtNum(getRowValue(row, ['Consumo Medio', 'consumo medio']));
    case 'vm':
      return fmtNum(getRowValue(row, ['VM', 'vm']));
    case 'cobertura':
      return fmtCobertura(row, userInput);
    case 'coberturaSug':
      return fmtCoberturaSug(row, userInput);
    case 'novaCobertura':
      return fmtNovaCobertura(row, userInput);
    case 'dataSolicit':
      return fmtData(getRowValue(row, ['Data Solicitacao', 'data solicitacao']));
    case 'dataNecess':
      return fmtData(getRowValue(row, ['Data Necessidade', 'data necessidade']));
    case 'qtdSolicit':
      return fmtNum(getRowValue(row, ['Qtd Liberada', 'qtd liberada']));
    case 'estoqAtual': {
      const exib = estoqueExibicaoGrade(userInput);
      if (exib != null) return fmtNum(exib);
      return '…';
    }
    case 'compraRecorrente':
      return String(getRowValue(row, ['Compra Recorrente', 'compra recorrente']) ?? '').trim() || '—';
    case 'itemCritico':
      return String(getRowValue(row, ['Item Crítico', 'Item critico', 'itemcritico']) ?? '').trim() || '—';
    case 'dataUltEntrada':
      return fmtData(getRowValue(row, ['Ultima Entrada', 'ultima entrada']));
    case 'precoAnt':
      return fmtPreco(getRowValue(row, ['Custo Unitario Compra', 'custo unitario compra']));
    case 'pcPend':
      return fmtNum(getRowValue(row, ['PC', 'pc']));
    case 'agPag':
      return fmtNum(getRowValue(row, ['Ag Pag', 'ag pag']));
    case 'coleta':
      return String(getRowValue(row, ['Nome Coleta', 'nome coleta']) ?? '').trim() || '—';
    case 'saldoProjetado':
      return fmtSaldoProjetado(row, userInput);
    default:
      return '—';
  }
}

function fmtIsoDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function valueForSort(
  row: Record<string, unknown>,
  key: ColKey,
  userInput?: RowUserInputs
): string | number {
  const s = getRessupCell(row, key, userInput);
  if (s === '—') return '';
  if (isRessupNaoAlmoxColData(key)) return parseDateSortValue(s);
  const forNum = s.replace(/\s/g, '').replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.');
  const n = Number(forNum);
  if (isRessupNaoAlmoxColNumeric(key) || (Number.isFinite(n) && /[\d]/.test(s))) return n;
  return s.toLowerCase();
}

const COLUNAS_CLASSIFICAVEIS: ColunaClassificavel[] = COL_DEFS_GRADE.map((c) => ({
  id: c.key,
  label: c.label,
}));

const labelClass = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';
const inputClass =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent min-h-[2.5rem]';

export default function RessupNaoAlmoxAnalisePage() {
  const { login: authLogin } = useAuth();
  const [opcoesFiltro, setOpcoesFiltro] = useState<{
    codigos: string[];
    descricoes: string[];
    coletas: string[];
    items: { codigo: string; descricao: string; coleta: string }[];
  }>({
    codigos: [],
    descricoes: [],
    coletas: [],
    items: [],
  });
  const [filterCodigo, setFilterCodigo] = useState('');
  const [filterDescricao, setFilterDescricao] = useState('');
  const [filterColeta, setFilterColeta] = useState('');
  const filtrosNovaAnaliseRef = useRef({ codigo: '', descricao: '', coleta: '' });
  filtrosNovaAnaliseRef.current = {
    codigo: filterCodigo,
    descricao: filterDescricao,
    coleta: filterColeta,
  };

  const [aplicado, setAplicado] = useState<{
    codigo: string;
    descricao: string;
    coleta: string;
    considerarRequisicoes?: boolean;
  } | null>(null);
  const [msgFiltro, setMsgFiltro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [msgLista, setMsgLista] = useState<string | null>(null);

  const [colunasOcultas, setColunasOcultas] = useState<string[]>(() => loadColunasOcultasStorage());
  const [colunasOcultasOpen, setColunasOcultasOpen] = useState(false);
  const colunasOcultasRef = useRef<HTMLDivElement>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [excelFilterDrafts, setExcelFilterDrafts] = useState<Record<string, ExcelFilterDraft>>({});
  const [colunaFiltroAberta, setColunaFiltroAberta] = useState<ColKey | null>(null);
  const [filtroAbertoRect, setFiltroAbertoRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const filtroDropdownRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [sortState, setSortState] = useState<SortState>(null);
  const [sortLevels, setSortLevels] = useState<SortLevel[]>(() => [...SORT_DEFAULT_RESSUP_NAO_ALMOX]);
  const [modalClassificarOpen, setModalClassificarOpen] = useState(false);
  const [pcPendModal, setPcPendModal] = useState<{
    idProduto: number;
    codigo: string;
    descricao: string;
  } | null>(null);
  const [empenhoModal, setEmpenhoModal] = useState<{
    idProduto: number;
    codigo: string;
    descricao: string;
    saldoAtual: number;
  } | null>(null);
  const [considerarRequisicoes, setConsiderarRequisicoes] = useState(false);
  const [confirmRequisicoesAberto, setConfirmRequisicoesAberto] = useState(false);
  const [filtroCompraRecorrente, setFiltroCompraRecorrente] = useState<'' | 'Sim' | 'Não'>('');
  const [detalheConsultaModal, setDetalheConsultaModal] = useState<{
    tipo: 'solicitacao' | 'cotacao';
    idProduto: number;
    codigo: string;
    descricao: string;
  } | null>(null);
  const [detalheSc, setDetalheSc] = useState<ScDetalhe[]>([]);
  const [detalheCotacao, setDetalheCotacao] = useState<CotacaoDetalhe[]>([]);
  const [obsModal, setObsModal] = useState<{
    rowKey: string;
    col: RessupObsColKey;
    colLabel: string;
    codigo: string;
    descricao: string;
    somenteLeitura: boolean;
  } | null>(null);
  const [estoqueModal, setEstoqueModal] = useState<{
    rowKey: string;
    idProduto: number;
    codigo: string;
    descricao: string;
    codigoPintado?: string | null;
    modoFundivel?: boolean;
    excluirMarcenaria?: boolean;
    nomeColeta?: string | null;
  } | null>(null);
  const [fundivelModal, setFundivelModal] = useState<{
    rowKey: string;
    codSemPintura: string;
  } | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>(readRessupNaoAlmoxColWidths);
  const colResizeRef = useRef<{ colKey: ColKey; startX: number; startW: number } | null>(null);
  const [confirmSairAberto, setConfirmSairAberto] = useState(false);

  const [gravandoAnalise, setGravandoAnalise] = useState(false);
  const [salvandoAlteracoes, setSalvandoAlteracoes] = useState(false);
  const [processandoAnalise, setProcessandoAnalise] = useState(false);
  const [concluindoAnalise, setConcluindoAnalise] = useState(false);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<number | null>(null);
  const [logoPdfBase64, setLogoPdfBase64] = useState<string | null>(null);
  const [feedbackGravacao, setFeedbackGravacao] = useState<{ ok: boolean; msg: string } | null>(null);
  /** Valores digitados nas colunas editáveis (Qtde Sug, Data Necess Sug, Qtd Aprov, Data Necess Aprov), por __rowKey. */
  const [userInputs, setUserInputs] = useState<Record<string, RowUserInputs>>({});
  /** Popover de filtros ao clicar em "Nova análise". */
  const [filtrosPopoverAberto, setFiltrosPopoverAberto] = useState(false);
  /** Exibe a grade após o primeiro "Filtrar" válido. */
  const [mostrarGradeAnalise, setMostrarGradeAnalise] = useState(false);
  /** Recarrega a lista do histórico (ex.: após gravar análise). */
  const [historicoVersao, setHistoricoVersao] = useState(0);
  const [historicoLista, setHistoricoLista] = useState<RessupNaoAlmoxAnaliseListItem[]>([]);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [historicoErro, setHistoricoErro] = useState<string | null>(null);
  /** Quando preenchido, a grade exibe um snapshot gravado (modo "visualização do histórico"). */
  const [historicoVisualizado, setHistoricoVisualizado] = useState<{
    id: number;
    createdAt: string;
    usuarioLogin: string;
    resumoFiltros: string | null;
    status: 'em_processamento' | 'processado' | 'concluido';
    processadoAt: string | null;
    usuarioLoginProcessado: string | null;
    concluidoAt: string | null;
    usuarioLoginConcluido: string | null;
  } | null>(null);
  const [historicoDetalheCarregando, setHistoricoDetalheCarregando] = useState(false);
  const [historicoDetalheErro, setHistoricoDetalheErro] = useState<string | null>(null);
  const [opcoesCarregando, setOpcoesCarregando] = useState(false);
  const detalheHistoricoReqRef = useRef(0);
  const novaAnaliseWrapRef = useRef<HTMLDivElement>(null);
  /**
   * Caches em memória dos detalhes dos modais (estratégia padrão de responsividade):
   * reabrir um modal já visto é instantâneo; todos são limpos a cada novo Filtrar.
   */
  const empenhoCacheRef = useRef(new Map<string, RessupEmpenhoPedidoResultado>());
  const estoqueCacheRef = useRef(new Map<string, EstoqueNaoAlmoxResultado>());
  const pcPendCacheRef = useRef(new Map<number, RessupNaoAlmoxPcPendLinha[]>());
  const scCacheRef = useRef(new Map<number, ScDetalhe[]>());
  const cotacaoCacheRef = useRef(new Map<number, CotacaoDetalhe[]>());

  const [prefetchEstoqueCarregando, setPrefetchEstoqueCarregando] = useState(false);

  const prefetchEstoqueErpReqRef = useRef(0);

  const prefetchEstoqueErpGrade = useCallback(async (rows: Record<string, unknown>[]) => {
    const req = ++prefetchEstoqueErpReqRef.current;
    if (rows.length === 0) {
      if (req === prefetchEstoqueErpReqRef.current) setPrefetchEstoqueCarregando(false);
      return;
    }
    setPrefetchEstoqueCarregando(true);
    const CONCURRENCY = 6;
    let idx = 0;

    const runOne = async () => {
      while (idx < rows.length) {
        if (req !== prefetchEstoqueErpReqRef.current) return;
        const i = idx++;
        const row = rows[i];
        const idProd = getIdProdutoFromRow(row);
        if (idProd == null) continue;
        const rowKey =
          typeof row.__rowKey === 'string' && row.__rowKey.trim() ? row.__rowKey : `row-${i}`;
        const codPintado =
          typeof row._codigoPintado === 'string' && row._codigoPintado.trim()
            ? row._codigoPintado.trim()
            : codigoPintadoDoCatalogo(
                String(getRowValue(row, ['Codigo do Produto', 'codigo do produto']) ?? '').trim()
              );
        const cacheKey = `${idProd}-${codPintado ?? ''}`;
        let cached = estoqueCacheRef.current.get(cacheKey);
        if (!cached) {
          const r = await fetchRessupNaoAlmoxEstoque(idProd, codPintado);
          if (req !== prefetchEstoqueErpReqRef.current) return;
          estoqueCacheRef.current.set(cacheKey, r);
          cached = r;
        }
        const erpTotal = somaSetoresErp(cached.setores) + somaSetoresErp(cached.setoresPintado);
        setUserInputs((prev) => {
          const cur = prev[rowKey];
          if (cur?.estoqueTotal != null && Number.isFinite(cur.estoqueTotal)) return prev;
          return {
            ...prev,
            [rowKey]: {
              ...cur,
              ...(codPintado ? { codigoPintado: codPintado } : {}),
              estoqueTotalErp: erpTotal,
            },
          };
        });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => runOne()));
    if (req === prefetchEstoqueErpReqRef.current) setPrefetchEstoqueCarregando(false);
  }, []);

  const carregarOpcoes = useCallback(async () => {
    setOpcoesCarregando(true);
    try {
      const r = await obterOpcoesFiltroRessupNaoAlmox();
      opcoesCarregadasRef.current = true;
      setOpcoesFiltro({
        codigos: [],
        descricoes: [],
        coletas: r.coletas ?? [],
        items: [],
      });
    } catch {
      setOpcoesFiltro({ codigos: [], descricoes: [], coletas: [], items: [] });
    } finally {
      setOpcoesCarregando(false);
    }
  }, []);

  const cascataDeps = useMemo(
    () => [filterCodigo, filterDescricao].join('\u0001'),
    [filterCodigo, filterDescricao]
  );

  const opcoesCarregadasRef = useRef(false);

  useEffect(() => {
    void imageUrlToDataUrl('/logo-soaco.png').then(setLogoPdfBase64);
  }, []);

  useEffect(() => {
    if (!filtrosPopoverAberto || !opcoesCarregadasRef.current) return;
    const t = window.setTimeout(() => {
      const f = filtrosNovaAnaliseRef.current;
      void obterOpcoesFiltroCascataRessupNaoAlmox(
        filtrosNovaAnalisePayload(f.codigo, f.descricao, f.coleta)
      ).then((r) => {
        if (!r.error) {
          const loc = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
          const coletasFixas = [...RESSUP_NAO_ALMOX_COLETAS] as string[];
          const merged = [...new Set([...coletasFixas, ...(r.coletas ?? [])])].sort(loc);
          setOpcoesFiltro((prev) => ({ ...prev, coletas: merged }));
        }
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [filtrosPopoverAberto, cascataDeps]);

  const filtrosPopoverAbertoRef = useRef(filtrosPopoverAberto);
  filtrosPopoverAbertoRef.current = filtrosPopoverAberto;

  useOnSincronizado(() => {
    if (filtrosPopoverAbertoRef.current) void carregarOpcoes();
  });

  const handleNovaAnaliseClick = useCallback(() => {
    if (filtrosPopoverAberto) {
      setFiltrosPopoverAberto(false);
      return;
    }
    setFiltrosPopoverAberto(true);
    void carregarOpcoes();
  }, [filtrosPopoverAberto, carregarOpcoes]);

  useEffect(() => {
    let cancelled = false;
    setHistoricoCarregando(true);
    setHistoricoErro(null);
    void listarRessupNaoAlmoxAnalises(100)
      .then((r) => {
        if (cancelled) return;
        setHistoricoLista(r.data);
        if (r.error) setHistoricoErro(r.error);
      })
      .catch((e) => {
        if (!cancelled) setHistoricoErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setHistoricoCarregando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [historicoVersao]);

  useEffect(() => {
    void fetchRessupNaoAlmoxCatalogo().then((c) => aplicarCatalogoRessupNaoAlmox(c));
  }, []);

  useEffect(() => {
    if (!filtrosPopoverAberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltrosPopoverAberto(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [filtrosPopoverAberto]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_COL_OCULTAS, JSON.stringify(colunasOcultas));
    } catch {
      /* ignore */
    }
  }, [colunasOcultas]);

  useEffect(() => {
    if (!colunasOcultasOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colunasOcultasRef.current && !colunasOcultasRef.current.contains(e.target as Node)) {
        setColunasOcultasOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colunasOcultasOpen]);

  const chavesValidas = useMemo(() => new Set(COL_DEFS_GRADE.map((c) => c.key)), []);

  useEffect(() => {
    const ocultasValidas = colunasOcultas.filter((k) => chavesValidas.has(k));
    if (ocultasValidas.length >= COL_DEFS_GRADE.length) ocultasValidas.pop();
    if (ocultasValidas.length !== colunasOcultas.length || ocultasValidas.some((k, i) => k !== colunasOcultas[i])) {
      setColunasOcultas(ocultasValidas);
    }
  }, [chavesValidas, colunasOcultas]);

  const exibirColunasAprovacao = useMemo(() => {
    const st = historicoVisualizado?.status;
    return st === 'processado' || st === 'concluido';
  }, [historicoVisualizado?.status]);

  const analiseNaoGravada = historicoVisualizado == null;

  const colunasVisiveisLista = useMemo(
    () =>
      COL_DEFS_GRADE.filter((c) => {
        if (analiseNaoGravada && !COLUNAS_PREVIEW_ANALISE_NOVA.has(c.key)) return false;
        if (colunasOcultas.includes(c.key)) return false;
        if (COLUNAS_APROVACAO_GRADE.has(c.key) && !exibirColunasAprovacao) return false;
        return true;
      }),
    [colunasOcultas, exibirColunasAprovacao, analiseNaoGravada]
  );

  const colunasClassificaveisAtivas = useMemo((): ColunaClassificavel[] => {
    if (!analiseNaoGravada) return COLUNAS_CLASSIFICAVEIS;
    return COLUNAS_CLASSIFICAVEIS.filter((c) =>
      COLUNAS_PREVIEW_ANALISE_NOVA.has(c.id as ColKey)
    );
  }, [analiseNaoGravada]);

  const colunasOcultasLista = useMemo(
    () =>
      COL_DEFS_GRADE.filter((c) => {
        if (!colunasOcultas.includes(c.key)) return false;
        if (COLUNAS_APROVACAO_GRADE.has(c.key) && !exibirColunasAprovacao) return false;
        return true;
      }),
    [colunasOcultas, exibirColunasAprovacao]
  );

  const ocultarColuna = (key: ColKey) => {
    if (colunasVisiveisLista.length <= 1) return;
    setColunaFiltroAberta((prev) => (prev === key ? null : prev));
    setSortState((prev) => (prev?.key === key ? null : prev));
    setColumnFilters((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setExcelFilterDrafts((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setColunasOcultas((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const reexibirColuna = (key: ColKey) => {
    setColunasOcultas((prev) => prev.filter((k) => k !== key));
  };

  const reexibirTodasColunas = () => {
    setColunasOcultas([]);
    setColunasOcultasOpen(false);
  };

  const setFiltroColuna = (key: ColKey, value: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const getRowKey = useCallback((row: Record<string, unknown>, idx: number): string => {
    const k = row.__rowKey;
    return typeof k === 'string' && k ? k : `row-${idx}`;
  }, []);

  const setRowInput = useCallback((rowKey: string, col: ColKey, value: string) => {
    setUserInputs((prev) => {
      const current = prev[rowKey] ?? {};
      if ((current[col] ?? '') === value) return prev;
      const nextRow: RowUserInputs = { ...current, [col]: value };
      if (!value) delete nextRow[col];
      const next = { ...prev };
      if (Object.keys(nextRow).length === 0) delete next[rowKey];
      else next[rowKey] = nextRow;
      return next;
    });
  }, []);

  const setRowInputsPartial = useCallback((rowKey: string, patch: Partial<RowUserInputs>) => {
    setUserInputs((prev) => {
      const current = prev[rowKey] ?? {};
      const nextRow: RowUserInputs = { ...current, ...patch };
      const next = { ...prev, [rowKey]: nextRow };
      return next;
    });
  }, []);

  const setRowObservacao = useCallback((rowKey: string, col: RessupObsColKey, value: string) => {
    setUserInputs((prev) => {
      const current = prev[rowKey] ?? {};
      const obs = { ...(current.observacoes ?? {}) };
      if (value) obs[col] = value;
      else delete obs[col];
      const nextRow: RowUserInputs = { ...current };
      if (Object.keys(obs).length > 0) nextRow.observacoes = obs;
      else delete nextRow.observacoes;
      const next = { ...prev };
      if (Object.keys(nextRow).length === 0) delete next[rowKey];
      else next[rowKey] = nextRow;
      return next;
    });
  }, []);

  const calcularValoresUnicosColuna = useCallback(
    (col: ColKey): string[] => {
      const values = new Set<string>();
      linhas.forEach((row, idx) => {
        const inputs = userInputs[getRowKey(row, idx)];
        values.add(getRessupCell(row, col, inputs));
      });
      return [...values].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    },
    [linhas, userInputs, getRowKey]
  );

  const valoresUnicosPorColuna = useMemo((): Partial<Record<ColKey, string[]>> => {
    if (!colunaFiltroAberta) return {};
    return { [colunaFiltroAberta]: calcularValoresUnicosColuna(colunaFiltroAberta) };
  }, [colunaFiltroAberta, calcularValoresUnicosColuna]);

  const abrirFiltroExcel = (key: ColKey, e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    setColunaFiltroAberta((prev) => {
      if (prev === key) {
        setFiltroAbertoRect(null);
        return null;
      }
      const valores = calcularValoresUnicosColuna(key);
      const filtroAtual = columnFilters[key];
      let selected = valores;
      let numericOp: NumericFilterOp | null = null;
      let numericV1 = '';
      let numericV2 = '';
      if (filtroAtual && isNumericColumnFilter(filtroAtual)) {
        const spec = parseNumericColumnFilter(filtroAtual);
        if (spec) {
          numericOp = spec.op;
          numericV1 = String(spec.v1);
          numericV2 = spec.v2 != null ? String(spec.v2) : '';
        }
      } else if (filtroAtual) {
        selected = filtroAtual.split('\u0001').filter(Boolean);
      }
      setExcelFilterDrafts((drafts) => ({
        ...drafts,
        [key]: { search: '', selected, numericOp, numericV1, numericV2 },
      }));
      setFiltroAbertoRect({ top: rect.bottom + 4, left: rect.left, width: 288 });
      return key;
    });
  };

  const fecharFiltroExcel = useCallback(() => {
    setColunaFiltroAberta(null);
    setFiltroAbertoRect(null);
  }, []);

  const aplicarFiltroExcel = (key: ColKey) => {
    const draft = excelFilterDrafts[key];
    const valores = calcularValoresUnicosColuna(key);
    if (draft?.numericOp && draft.numericV1?.trim()) {
      const n1 = parseNumeroFiltroInput(draft.numericV1);
      if (n1 != null) {
        if (draft.numericOp === 'between') {
          const n2 = parseNumeroFiltroInput(draft.numericV2 ?? '');
          if (n2 != null) {
            setFiltroColuna(key, encodeNumericColumnFilter('between', n1, n2));
            fecharFiltroExcel();
            return;
          }
        } else {
          setFiltroColuna(key, encodeNumericColumnFilter(draft.numericOp, n1));
          fecharFiltroExcel();
          return;
        }
      }
    }
    if (!draft || draft.selected.length === valores.length) setFiltroColuna(key, '');
    else setFiltroColuna(key, draft.selected.join('\u0001'));
    fecharFiltroExcel();
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!colunaFiltroAberta) return;
    const handle = (e: MouseEvent) => {
      if (filtroDropdownRef.current && !filtroDropdownRef.current.contains(e.target as Node)) {
        fecharFiltroExcel();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [colunaFiltroAberta, fecharFiltroExcel]);

  // Fechar dropdown ao rolar a tabela
  useEffect(() => {
    if (!colunaFiltroAberta) return;
    const el = tableScrollRef.current;
    if (!el) return;
    const handle = () => fecharFiltroExcel();
    el.addEventListener('scroll', handle, { passive: true });
    return () => el.removeEventListener('scroll', handle);
  }, [colunaFiltroAberta, fecharFiltroExcel]);

  const deferredColumnFilters = useDeferredValue(columnFilters);
  const deferredFiltroCompraRecorrente = useDeferredValue(filtroCompraRecorrente);

  const linhasFiltradas = useMemo(() => {
    const base =
      deferredFiltroCompraRecorrente === ''
        ? linhas
        : linhas.filter((row) => linhaPassaFiltroCompraRecorrente(row, deferredFiltroCompraRecorrente));
    return base.filter((row, idx) => {
      const inputs = userInputs[getRowKey(row, idx)];
      return rowMatchesColumnFilters(
        row,
        deferredColumnFilters,
        (r, key) => getRessupCell(r, key as ColKey, inputs),
        undefined,
        (r, key) => {
          const v = valueForSort(r, key as ColKey, inputs);
          return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
        }
      );
    });
  }, [linhas, deferredFiltroCompraRecorrente, deferredColumnFilters, userInputs, getRowKey]);

  const levelsOrdenacao = useMemo((): SortLevel[] => {
    if (sortState) return [{ id: sortState.key, dir: sortState.direction }];
    if (sortLevels.length > 0) return sortLevels;
    return SORT_DEFAULT_RESSUP_NAO_ALMOX;
  }, [sortState, sortLevels]);

  const linhasOrdenadas = useMemo(() => {
    return [...linhasFiltradas].sort((a, b) => {
      const ka = getRowKey(a, 0);
      const kb = getRowKey(b, 0);
      return compareRowsBySortLevels(
        a,
        b,
        levelsOrdenacao,
        (row, colId) => valueForSort(row, colId as ColKey, userInputs[getRowKey(row, 0)])
      );
    });
  }, [linhasFiltradas, levelsOrdenacao, userInputs, getRowKey]);

  const temFiltrosGrade =
    filtroCompraRecorrente !== '' ||
    Object.keys(columnFilters).length > 0 ||
    sortState != null ||
    !sortLevelsEqual(sortLevels, SORT_DEFAULT_RESSUP_NAO_ALMOX) ||
    colunasOcultas.length > 0;

  /** Navega entre inputs editáveis com Enter (linha abaixo) e Shift+Enter (linha acima). */
  const handleInputEnterKey = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colKey: ColKey
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const targetIdx = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
    if (targetIdx < 0 || targetIdx >= linhasOrdenadas.length) return;
    const targetRow = linhasOrdenadas[targetIdx];
    const targetRowKey = getRowKey(targetRow, targetIdx);
    const escapeAttr = (s: string) =>
      typeof window.CSS?.escape === 'function'
        ? window.CSS.escape(s)
        : s.replace(/[^\w-]/g, (c) => `\\${c}`);
    const selector = `[data-editinput][data-rowkey="${escapeAttr(targetRowKey)}"][data-colkey="${colKey}"]`;
    const el = document.querySelector<HTMLInputElement>(selector);
    if (el) { el.focus(); el.select(); }
  }, [linhasOrdenadas, getRowKey]);

  const limparFiltrosGrade = () => {
    setFiltroCompraRecorrente('');
    setColumnFilters({});
    setExcelFilterDrafts({});
    setSortState(null);
    setSortLevels([...SORT_DEFAULT_RESSUP_NAO_ALMOX]);
    setColunaFiltroAberta(null);
    setFiltroAbertoRect(null);
  };

  const copiarSugestoesParaAprovacao = useCallback((rowKey: string) => {
    setUserInputs((prev) => {
      const cur = prev[rowKey] ?? {};
      const next: RowUserInputs = { ...cur };
      const sugQ = (cur.qtdeSug ?? '').trim();
      const sugD = (cur.dataNecessSug ?? '').trim();
      if (sugQ) next.qtdAprov = sugQ;
      if (sugD) next.dataNecessAprov = sugD;
      if (!sugQ && !sugD) return prev;
      return { ...prev, [rowKey]: next };
    });
  }, []);

  const onColResizePointerDown = useCallback((colKey: ColKey, e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    colResizeRef.current = {
      colKey,
      startX: e.clientX,
      startW: colWidths[colKey] ?? RESSUP_NAO_ALMOX_DEFAULT_COL_WIDTHS[colKey] ?? 96,
    };
  }, [colWidths]);

  const onColResizePointerMove = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    const d = colResizeRef.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    setColWidths((prev) => ({
      ...prev,
      [d.colKey]: clampColWidth(d.startW + delta),
    }));
  }, []);

  const onColResizePointerEnd = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (!colResizeRef.current) return;
    colResizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    setColWidths((w) => {
      persistRessupNaoAlmoxColWidths(w);
      return w;
    });
  }, []);

  /**
   * Coletas disponíveis (cascata server-side); código/descrição via typeahead assíncrono.
   */
  const coletasFiltro = useMemo(() => {
    const loc = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
    const coletasFixas = [...RESSUP_NAO_ALMOX_COLETAS] as string[];
    return [...new Set([...coletasFixas, ...opcoesFiltro.coletas])].sort(loc);
  }, [opcoesFiltro.coletas]);

  const buscarCodigoFiltroAsync = useCallback(async (term: string) => {
    const f = filtrosNovaAnaliseRef.current;
    const r = await buscarOpcoesFiltroRessupNaoAlmox(
      'codigo',
      term,
      filtrosNovaAnalisePayload(f.codigo, f.descricao, f.coleta)
    );
    return r.data;
  }, []);

  const buscarDescricaoFiltroAsync = useCallback(async (term: string) => {
    const f = filtrosNovaAnaliseRef.current;
    const r = await buscarOpcoesFiltroRessupNaoAlmox(
      'descricao',
      term,
      filtrosNovaAnalisePayload(f.codigo, f.descricao, f.coleta)
    );
    return r.data;
  }, []);

  const handleFiltrar = () => {
    setMsgFiltro(null);
    setFiltrosPopoverAberto(false);
    setConfirmRequisicoesAberto(true);
  };

  const confirmarRequisicoes = (sim: boolean) => {
    setConsiderarRequisicoes(sim);
    setConfirmRequisicoesAberto(false);
    void executarFiltrar(sim);
  };

  const voltarConfirmRequisicoes = () => {
    setConfirmRequisicoesAberto(false);
    setFiltrosPopoverAberto(true);
  };

  const executarFiltrar = async (req: boolean) => {
    const prevLinhas = linhas;
    const prevInputs = userInputs;
    setMostrarGradeAnalise(true);
    setHistoricoVisualizado(null);
    setHistoricoDetalheErro(null);
    setLoading(true);
    setErroApi(null);
    setMsgLista(null);
    setLinhas([]);
    setUserInputs({});
    prefetchEstoqueErpReqRef.current += 1;
    setFiltroCompraRecorrente('');
    empenhoCacheRef.current.clear();
    estoqueCacheRef.current.clear();
    pcPendCacheRef.current.clear();
    scCacheRef.current.clear();
    cotacaoCacheRef.current.clear();
    const codigoValues = filterCodigo.split('|').filter(Boolean);
    const descricaoValues = filterDescricao.split('|').filter(Boolean);
    const coletaValues = filterColeta.split('|').filter(Boolean);
    const aplicadoLocal = {
      codigo: codigoValues.join(', '),
      descricao: descricaoValues.join(', '),
      coleta: coletaValues.join(', '),
      considerarRequisicoes: req,
    };
    try {
      const r = await listarRessupNaoAlmoxRegistroPreview({
        codigo: codigoValues.join('|') || undefined,
        descricao: descricaoValues.join('|') || undefined,
        coleta: coletaValues.join('|') || undefined,
        considerarRequisicoes: req,
      });
      setAplicado(aplicadoLocal);
      if (r.error) {
        setErroApi(r.error);
        setLinhas([]);
      } else {
        const mapped = r.data.map((row, idx) => ({ ...row, __rowKey: `row-${idx}` }));
        setLinhas(mapped);
        const freshInputs = buildUserInputsFromRows(mapped);
        setUserInputs(mesclarUserInputsRefiltro(mapped, freshInputs, prevLinhas, prevInputs));
        setSortState(null);
        setSortLevels([...SORT_DEFAULT_RESSUP_NAO_ALMOX]);
        if (r.message && r.data.length === 0) setMsgLista(r.message);
        else if (mapped.length > 0) await prefetchEstoqueErpGrade(mapped);
      }
    } catch (e) {
      setErroApi(e instanceof Error ? e.message : String(e));
      setLinhas([]);
    } finally {
      setLoading(false);
    }
  };

  const resumoFiltros =
    aplicado == null
      ? null
      : [
          aplicado.codigo && `Código: ${aplicado.codigo}`,
          aplicado.descricao && `Descrição: ${aplicado.descricao}`,
          aplicado.coleta && `Nome da coleta: ${aplicado.coleta}`,
          !aplicado.codigo && !aplicado.descricao && !aplicado.coleta && 'Todos os produtos elegíveis',
        ]
          .filter(Boolean)
          .join(' · ');

  const gravarSnapshotAnalise = useCallback(async (): Promise<boolean> => {
    if (!aplicado || linhas.length === 0) return false;
    setGravandoAnalise(true);
    setFeedbackGravacao(null);
    const columnDefs = COL_DEFS.map((c) => ({ key: c.key, label: c.label }));
    const displayRows: Record<string, string>[] = linhas.map((row, idx) => {
      const inputs = userInputs[getRowKey(row, idx)];
      const o: Record<string, string> = {};
      for (const c of COL_DEFS) o[c.key] = getRessupCell(row, c.key, inputs);
      return o;
    });
    const rawRows: Record<string, unknown>[] = linhas.map(
      (row) => JSON.parse(JSON.stringify(row)) as Record<string, unknown>
    );
    const userInputsSnapshot: Record<string, RowUserInputs> = {};
    linhas.forEach((row, idx) => {
      const key = getRowKey(row, idx);
      const inputs = userInputs[key];
      if (inputs && Object.keys(inputs).length > 0) {
        userInputsSnapshot[key] = { ...inputs };
      }
    });
    const payload: RessupNaoAlmoxAnalisePayloadV1 & { userInputs?: Record<string, RowUserInputs> } = {
      version: 1,
      columnDefs,
      displayRows,
      rawRows,
      aplicado,
      userInputs: userInputsSnapshot,
      savedUi: {
        colunasOcultas: [...colunasOcultas],
        columnFilters: { ...columnFilters },
        sort: sortState ? { key: sortState.key, direction: sortState.direction } : null,
        sortLevels: sortState ? [] : [...sortLevels],
        colWidths: { ...colWidths },
      },
    };
    try {
      const r = await gravarRessupNaoAlmoxAnalise({
        resumoFiltros: resumoFiltros ?? undefined,
        payload,
      });
      if (!r.ok) {
        setFeedbackGravacao({ ok: false, msg: r.error ?? 'Não foi possível gravar.' });
        return false;
      }
      setHistoricoVersao((v) => v + 1);
      setHistoricoVisualizado({
        id: r.id!,
        createdAt: r.createdAt ?? new Date().toISOString(),
        usuarioLogin: r.usuarioLogin ?? authLogin ?? '',
        resumoFiltros: resumoFiltros ?? null,
        status: 'em_processamento',
        processadoAt: null,
        usuarioLoginProcessado: null,
        concluidoAt: null,
        usuarioLoginConcluido: null,
      });
      setFeedbackGravacao({
        ok: true,
        msg: `Análise gravada (nº ${r.id ?? '?'}) com status "Em processamento". Você pode editar os campos e salvar as alterações.`,
      });
      return true;
    } catch (e) {
      setFeedbackGravacao({ ok: false, msg: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setGravandoAnalise(false);
    }
  }, [
    aplicado,
    linhas,
    resumoFiltros,
    colunasOcultas,
    columnFilters,
    sortState,
    sortLevels,
    colWidths,
    userInputs,
    getRowKey,
    authLogin,
  ]);

  /** Atualiza o payload de uma análise em_processamento ou processado sem mudar o status. */
  const salvarAlteracoesAnalise = useCallback(async (): Promise<boolean> => {
    if (!historicoVisualizado || historicoVisualizado.status === 'concluido') return false;
    if (!aplicado || linhas.length === 0) return false;
    setSalvandoAlteracoes(true);
    setFeedbackGravacao(null);
    const columnDefs = COL_DEFS.map((c) => ({ key: c.key, label: c.label }));
    const displayRows: Record<string, string>[] = linhas.map((row, idx) => {
      const inputs = userInputs[getRowKey(row, idx)];
      const o: Record<string, string> = {};
      for (const c of COL_DEFS) o[c.key] = getRessupCell(row, c.key, inputs);
      return o;
    });
    const rawRows: Record<string, unknown>[] = linhas.map(
      (row) => JSON.parse(JSON.stringify(row)) as Record<string, unknown>
    );
    const userInputsSnapshot: Record<string, RowUserInputs> = {};
    linhas.forEach((row, idx) => {
      const key = getRowKey(row, idx);
      const inputs = userInputs[key];
      if (inputs && Object.keys(inputs).length > 0) userInputsSnapshot[key] = { ...inputs };
    });
    const payload: RessupNaoAlmoxAnalisePayloadV1 & { userInputs?: Record<string, RowUserInputs> } = {
      version: 1,
      columnDefs,
      displayRows,
      rawRows,
      aplicado,
      userInputs: userInputsSnapshot,
      savedUi: {
        colunasOcultas: [...colunasOcultas],
        columnFilters: { ...columnFilters },
        sort: sortState ? { key: sortState.key, direction: sortState.direction } : null,
        sortLevels: sortState ? [] : [...sortLevels],
        colWidths: { ...colWidths },
      },
    };
    try {
      const r = await atualizarRessupNaoAlmoxAnalise(historicoVisualizado.id, {
        resumoFiltros: resumoFiltros ?? undefined,
        payload,
      });
      if (!r.ok) {
        setFeedbackGravacao({ ok: false, msg: r.error ?? 'Não foi possível salvar as alterações.' });
        return false;
      }
      setHistoricoVersao((v) => v + 1);
      setFeedbackGravacao({ ok: true, msg: 'Alterações salvas com sucesso.' });
      return true;
    } catch (e) {
      setFeedbackGravacao({ ok: false, msg: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setSalvandoAlteracoes(false);
    }
  }, [
    historicoVisualizado,
    aplicado,
    linhas,
    resumoFiltros,
    colunasOcultas,
    columnFilters,
    sortState,
    sortLevels,
    colWidths,
    userInputs,
    getRowKey,
  ]);

  /** Muda o status de uma análise em_processamento para processado. */
  const processarAnalise = useCallback(async (id: number) => {
    setProcessandoAnalise(true);
    setAcaoEmAndamento(id);
    setFeedbackGravacao(null);
    try {
      const r = await processarRessupNaoAlmoxAnalise(id);
      if (!r.ok) {
        setFeedbackGravacao({ ok: false, msg: r.error ?? 'Não foi possível processar a análise.' });
      } else {
        const agora = new Date().toISOString();
        setHistoricoVisualizado((prev) =>
          prev?.id === id
            ? { ...prev, status: 'processado', processadoAt: agora, usuarioLoginProcessado: authLogin ?? '' }
            : prev
        );
        setHistoricoLista((prev) =>
          prev.map((h) =>
            h.id === id
              ? {
                  ...h,
                  status: 'processado' as const,
                  usuarioLoginProcessado: authLogin ?? '',
                  processadoAt: agora,
                }
              : h
          )
        );
        setHistoricoVersao((v) => v + 1);
        setFeedbackGravacao({ ok: true, msg: 'Análise marcada como processada.' });
      }
    } catch (e) {
      setFeedbackGravacao({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setProcessandoAnalise(false);
      setAcaoEmAndamento(null);
    }
  }, [authLogin]);

  /** Muda o status de uma análise processado para concluido. */
  const concluirAnalise = useCallback(async (id: number) => {
    setConcluindoAnalise(true);
    setAcaoEmAndamento(id);
    setFeedbackGravacao(null);
    try {
      const r = await concluirRessupNaoAlmoxAnalise(id);
      if (!r.ok) {
        setFeedbackGravacao({ ok: false, msg: r.error ?? 'Não foi possível concluir a análise.' });
      } else {
        const agora = new Date().toISOString();
        setHistoricoVisualizado((prev) =>
          prev?.id === id
            ? { ...prev, status: 'concluido', concluidoAt: agora, usuarioLoginConcluido: authLogin ?? '' }
            : prev
        );
        setHistoricoLista((prev) =>
          prev.map((h) =>
            h.id === id
              ? {
                  ...h,
                  status: 'concluido' as const,
                  usuarioLoginConcluido: authLogin ?? '',
                  concluidoAt: agora,
                }
              : h
          )
        );
        setHistoricoVersao((v) => v + 1);
        setFeedbackGravacao({ ok: true, msg: 'Análise concluída.' });
      }
    } catch (e) {
      setFeedbackGravacao({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setConcluindoAnalise(false);
      setAcaoEmAndamento(null);
    }
  }, [authLogin]);

  /** Exporta somente linhas e colunas visíveis na grade (filtros por coluna + colunas ocultas pelo usuário). */
  const exportarExcel = useCallback(() => {
    if (linhasOrdenadas.length === 0) return;
    const colunasExport = colunasVisiveisLista;
    const headers = colunasExport.map((c) => c.label);
    const rows = linhasOrdenadas.map((row, idx) => {
      const inputs = userInputs[getRowKey(row, idx)];
      return colunasExport.map((c) => {
        const cell = getRessupCell(row, c.key, inputs);
        return cell === '—' ? '' : cell;
      });
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ressup Não Almox');
    const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    XLSX.writeFile(wb, `ressup-nao-almox-${ts}.xlsx`);
  }, [colunasVisiveisLista, linhasOrdenadas, userInputs, getRowKey]);

  const montarLinhasPdf = useCallback(
    (rows: Record<string, unknown>[], inputsMap: Record<string, RowUserInputs>) => {
      return rows.map((row, idx) => {
        const inputs = inputsMap[getRowKey(row, idx)];
        const cell = (key: ColKey) => {
          const v = getRessupCell(row, key, inputs);
          return v === '—' || v === '…' ? '' : v;
        };
        return {
          codigo: cell('codigo'),
          descricao: cell('descricao'),
          empenho: cell('qtdeEmp'),
          qtdSolicit: cell('qtdSolicit'),
          estoqAtual: cell('estoqAtual'),
          pcPend: cell('pcPend'),
          agPag: cell('agPag'),
          saldoProjetado: cell('saldoProjetado'),
        };
      });
    },
    [getRowKey]
  );

  const gerarPdfGrade = useCallback(() => {
    if (linhasOrdenadas.length === 0) return;
    const subtitulo = historicoVisualizado
      ? `Análise #${historicoVisualizado.id}${historicoVisualizado.resumoFiltros ? ` · ${historicoVisualizado.resumoFiltros}` : ''}`
      : resumoFiltros ?? undefined;
    downloadRessupNaoAlmoxPdf({
      titulo: 'Ressup Não Almox',
      subtitulo,
      linhas: montarLinhasPdf(linhasOrdenadas, userInputs),
      logoBase64: logoPdfBase64,
    });
  }, [historicoVisualizado, linhasOrdenadas, logoPdfBase64, montarLinhasPdf, resumoFiltros, userInputs]);

  const gerarPdfHistorico = useCallback(
    async (id: number) => {
      setAcaoEmAndamento(id);
      try {
        const r = await obterRessupNaoAlmoxAnalise(id);
        if (r.error || !r.payload) return;
        const rawRows = Array.isArray(r.payload.rawRows) ? r.payload.rawRows : [];
        const linhasSnap = rawRows.map((row, idx) => {
          const o: Record<string, unknown> = { ...(row as Record<string, unknown>) };
          const k = o.__rowKey;
          if (typeof k !== 'string' || !k) o.__rowKey = `row-${idx}`;
          return o;
        });
        const inputsRaw = (r.payload as RessupNaoAlmoxAnalisePayloadV1 & {
          userInputs?: Record<string, RowUserInputs>;
        }).userInputs;
        const inputsMap = inputsRaw && typeof inputsRaw === 'object' ? inputsRaw : {};
        downloadRessupNaoAlmoxPdf({
          titulo: 'Ressup Não Almox',
          subtitulo: `Análise #${id}${r.resumoFiltros ? ` · ${r.resumoFiltros}` : ''}`,
          linhas: montarLinhasPdf(linhasSnap, inputsMap),
          logoBase64: logoPdfBase64,
        });
      } finally {
        setAcaoEmAndamento(null);
      }
    },
    [logoPdfBase64, montarLinhasPdf]
  );

  const fecharVisualizacaoHistorico = useCallback(() => {
    detalheHistoricoReqRef.current += 1;
    setHistoricoDetalheCarregando(false);
    setHistoricoDetalheErro(null);
    setHistoricoVisualizado(null);
    setMostrarGradeAnalise(false);
    setLinhas([]);
    setUserInputs({});
    setAplicado(null);
    setFeedbackGravacao(null);
    setColumnFilters({});
    setFiltroCompraRecorrente('');
    setExcelFilterDrafts({});
    setSortState(null);
    setSortLevels([...SORT_DEFAULT_RESSUP_NAO_ALMOX]);
    setColunaFiltroAberta(null);
    setConfirmSairAberto(false);
    setMsgLista(null);
    setErroApi(null);
  }, []);

  /**
   * Carrega um snapshot do histórico na MESMA grade usada durante a criação da análise:
   * hidrata `linhas` (rawRows), `aplicado`, `userInputs` e a UI persistida (colunas ocultas,
   * filtros por coluna e ordenação). Mantém a grade editável para que o usuário possa ajustar
   * e, se quiser, gravar como nova análise.
   */
  const abrirDetalheHistorico = useCallback(async (id: number) => {
    const req = ++detalheHistoricoReqRef.current;
    setHistoricoDetalheErro(null);
    setHistoricoDetalheCarregando(true);
    setFeedbackGravacao(null);
    setColunasOcultasOpen(false);
    try {
      const r = await obterRessupNaoAlmoxAnalise(id);
      if (req !== detalheHistoricoReqRef.current) return;
      if (r.error) {
        setHistoricoDetalheErro(r.error);
        return;
      }
      const payload = r.payload;
      if (!payload) {
        setHistoricoDetalheErro('Snapshot sem dados legíveis.');
        return;
      }

      const rawRows = Array.isArray(payload.rawRows) ? payload.rawRows : [];
      const linhasSnapshot = rawRows.map((row, idx) => {
        const o: Record<string, unknown> = { ...(row as Record<string, unknown>) };
        const k = o.__rowKey;
        if (typeof k !== 'string' || !k) o.__rowKey = `row-${idx}`;
        return o;
      });

      const ui = payload.savedUi ?? null;
      const ocultasValidas = Array.isArray(ui?.colunasOcultas)
        ? ui!.colunasOcultas.filter((k) => chavesValidas.has(k as ColKey))
        : [];
      const filtrosUi = ui?.columnFilters && typeof ui.columnFilters === 'object'
        ? (ui.columnFilters as Record<string, string>)
        : {};
      const sortUi = ui?.sort ?? null;
      const sortLevelsUi = Array.isArray(ui?.sortLevels) ? ui!.sortLevels : null;
      const colWidthsUi =
        ui?.colWidths && typeof ui.colWidths === 'object'
          ? (ui.colWidths as Record<string, number>)
          : null;

      const inputsRaw = (payload as RessupNaoAlmoxAnalisePayloadV1 & {
        userInputs?: Record<string, RowUserInputs>;
      }).userInputs;
      const inputsSnapshot = inputsRaw && typeof inputsRaw === 'object' ? inputsRaw : {};

      const aplicadoPayload = {
        codigo: payload.aplicado?.codigo ?? '',
        descricao: payload.aplicado?.descricao ?? '',
        coleta: payload.aplicado?.coleta ?? '',
        considerarRequisicoes: Boolean(payload.aplicado?.considerarRequisicoes),
      };

      let linhasHidr = linhasSnapshot;
      let inputs = inputsSnapshot;
      if (payload.aplicado) {
        try {
          const preview = await listarRessupNaoAlmoxRegistroPreview(
            aplicadoParaFiltrosPreview(aplicadoPayload)
          );
          if (req !== detalheHistoricoReqRef.current) return;
          if (!preview.error && preview.data.length > 0) {
            const merged = mesclarLinhasHistoricoComApi(linhasSnapshot, preview.data, inputsSnapshot);
            linhasHidr = merged.linhas;
            inputs = merged.userInputs;
          }
        } catch {
          /* fallback: mantém snapshot gravado */
        }
      }

      setMostrarGradeAnalise(true);
      setLinhas(linhasHidr);
      setAplicado(aplicadoPayload);
      setConsiderarRequisicoes(aplicadoPayload.considerarRequisicoes);
      setUserInputs(inputs);
      setColunasOcultas(ocultasValidas);
      setColumnFilters(filtrosUi);
      setFiltroCompraRecorrente('');
      if (linhasHidr.length > 0) await prefetchEstoqueErpGrade(linhasHidr);
      setExcelFilterDrafts({});
      if (sortLevelsUi && sortLevelsUi.length > 0) {
        setSortLevels(
          sortLevelsUi.filter((l) => chavesValidas.has(l.id as ColKey)) as SortLevel[]
        );
        setSortState(null);
      } else if (sortUi && typeof sortUi === 'object' && 'key' in sortUi) {
        setSortState({ key: sortUi.key as ColKey, direction: sortUi.direction as 'asc' | 'desc' });
        setSortLevels([...SORT_DEFAULT_RESSUP_NAO_ALMOX]);
      } else {
        setSortState(null);
        setSortLevels([...SORT_DEFAULT_RESSUP_NAO_ALMOX]);
      }
      if (colWidthsUi) {
        const merged = { ...readRessupNaoAlmoxColWidths() };
        for (const [k, v] of Object.entries(colWidthsUi)) {
          if (typeof v === 'number' && Number.isFinite(v)) merged[k] = clampColWidth(v);
        }
        setColWidths(merged);
      }
      setColunaFiltroAberta(null);
      setMsgLista(null);
      setErroApi(null);
      setLoading(false);
      setFiltrosPopoverAberto(false);
      setHistoricoVisualizado({
        id: r.id,
        createdAt: r.createdAt,
        usuarioLogin: r.usuarioLogin,
        resumoFiltros: r.resumoFiltros,
        status: r.status,
        processadoAt: r.processadoAt,
        usuarioLoginProcessado: r.usuarioLoginProcessado,
        concluidoAt: r.concluidoAt,
        usuarioLoginConcluido: r.usuarioLoginConcluido,
      });
    } catch (e) {
      if (req !== detalheHistoricoReqRef.current) return;
      setHistoricoDetalheErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (req === detalheHistoricoReqRef.current) setHistoricoDetalheCarregando(false);
    }
  }, [chavesValidas]);

  /** Análise totalmente bloqueada para edição */
  const analiseReadOnly = historicoVisualizado?.status === 'concluido';
  /** Análise com edição restrita apenas às colunas de aprovação */
  const apenasAprovEditavel = historicoVisualizado?.status === 'processado';

  const observacaoBloqueada = useCallback(
    (col: RessupObsColKey) => {
      if (analiseReadOnly) return true;
      if (apenasAprovEditavel && (col === 'qtdeSug' || col === 'dataNecessSug')) return true;
      return false;
    },
    [analiseReadOnly, apenasAprovEditavel]
  );

  const tdComObsClass = useCallback(
    (inputs: RowUserInputs | undefined, col: RessupObsColKey) =>
      hasRessupObservacao(inputs, col) ? RESSUP_TD_COM_OBS_CLASS : '',
    []
  );

  const colSpanGrade = Math.max(1, colunasVisiveisLista.length);

  const larguraMinimaTabela = useMemo(() => {
    let w = 0;
    for (const col of colunasVisiveisLista) {
      w += colWidths[col.key] ?? RESSUP_NAO_ALMOX_DEFAULT_COL_WIDTHS[col.key] ?? 96;
    }
    return Math.max(w, 900);
  }, [colunasVisiveisLista, colWidths]);

  const podeSalvarAntesDeSair =
    linhas.length > 0 &&
    !analiseReadOnly &&
    (!historicoVisualizado ||
      historicoVisualizado.status === 'em_processamento' ||
      historicoVisualizado.status === 'processado');

  const handleVoltarHistorico = useCallback(() => {
    if (analiseReadOnly) {
      fecharVisualizacaoHistorico();
      return;
    }
    if (linhas.length === 0) {
      fecharVisualizacaoHistorico();
      return;
    }
    setConfirmSairAberto(true);
  }, [linhas.length, fecharVisualizacaoHistorico, analiseReadOnly]);

  const detalheConsultaDetailKey = detalheConsultaModal
    ? `${detalheConsultaModal.tipo}-${detalheConsultaModal.idProduto}`
    : null;

  const carregarDetalheConsultaModal = useCallback(async (): Promise<{ error?: string }> => {
    if (!detalheConsultaModal) return {};
    const { tipo, idProduto } = detalheConsultaModal;
    if (tipo === 'solicitacao') {
      const cached = scCacheRef.current.get(idProduto);
      if (cached) {
        setDetalheSc(cached);
        return {};
      }
      const r = await obterScDetalhe(idProduto);
      if (!r.error) scCacheRef.current.set(idProduto, r.data);
      setDetalheSc(r.data);
      return { error: r.error };
    }
    const cached = cotacaoCacheRef.current.get(idProduto);
    if (cached) {
      setDetalheCotacao(cached);
      return {};
    }
    const r = await obterCotacaoDetalhe(idProduto);
    if (!r.error) cotacaoCacheRef.current.set(idProduto, r.data);
    setDetalheCotacao(r.data);
    return { error: r.error };
  }, [detalheConsultaModal]);

  const handleConfirmSairSemSalvar = useCallback(() => {
    setConfirmSairAberto(false);
    fecharVisualizacaoHistorico();
  }, [fecharVisualizacaoHistorico]);

  const handleConfirmSalvarESair = useCallback(async () => {
    setConfirmSairAberto(false);
    if (!podeSalvarAntesDeSair) {
      fecharVisualizacaoHistorico();
      return;
    }
    const ok = historicoVisualizado
      ? await salvarAlteracoesAnalise()
      : await gravarSnapshotAnalise();
    if (ok) fecharVisualizacaoHistorico();
  }, [
    podeSalvarAntesDeSair,
    historicoVisualizado,
    salvarAlteracoesAnalise,
    gravarSnapshotAnalise,
    fecharVisualizacaoHistorico,
  ]);

  const overlayPrincipalAtivo =
    loading ||
    prefetchEstoqueCarregando ||
    gravandoAnalise ||
    salvandoAlteracoes ||
    processandoAnalise ||
    concluindoAnalise ||
    historicoDetalheCarregando;
  const overlayPrincipalMsg = gravandoAnalise
    ? 'Gravando análise…'
    : salvandoAlteracoes
      ? 'Salvando alterações…'
      : processandoAnalise
        ? 'Processando análise…'
        : concluindoAnalise
          ? 'Concluindo análise…'
          : prefetchEstoqueCarregando
            ? 'Carregando estoque dos produtos…'
            : loading
              ? 'Consultando Nomus (produtos e registro da coleta)…'
              : historicoDetalheCarregando
                ? 'Carregando análise gravada…'
                : 'Carregando informações...';

  const historicoListaOverlayAtivo = historicoCarregando;

  return (
    <div className="relative flex flex-col flex-1 min-h-0 p-3 max-w-[1920px] mx-auto w-full">
      <CarregandoInformacoesOverlay show={overlayPrincipalAtivo} mensagem={overlayPrincipalMsg} mode="contained" />

      <>
        <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide leading-none mb-0.5">PCP</p>
                <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 leading-tight">Ressup Não Almox</h1>
              </div>
              {/* Badge de status inline com o título quando há análise aberta */}
              {mostrarGradeAnalise && historicoVisualizado && (
                <>
                  <span className={`self-end mb-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    historicoVisualizado.status === 'concluido'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : historicoVisualizado.status === 'processado'
                        ? 'bg-primary-100 text-blue-800 dark:bg-primary-900/40 dark:text-primary-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    {historicoVisualizado.status === 'concluido' ? '✓ Concluído' : historicoVisualizado.status === 'processado' ? '◎ Processado' : '● Em processamento'}
                  </span>
                  <span className="self-end mb-0.5 inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    #{historicoVisualizado.id}
                  </span>
                </>
              )}
            </div>
            {/* Subtítulo compacto com metadados da análise */}
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0">
              {mostrarGradeAnalise && historicoVisualizado ? (
                <>
                  <span><span className="font-medium">Criada em:</span> {fmtIsoDataHora(historicoVisualizado.createdAt)} por {historicoVisualizado.usuarioLogin}</span>
                  {historicoVisualizado.processadoAt && <span><span className="font-medium">Processada por:</span> {historicoVisualizado.usuarioLoginProcessado ?? '—'}</span>}
                  {historicoVisualizado.concluidoAt && <span><span className="font-medium">Concluída por:</span> {historicoVisualizado.usuarioLoginConcluido ?? '—'}</span>}
                  {historicoVisualizado.resumoFiltros && <span><span className="font-medium">Filtros:</span> {historicoVisualizado.resumoFiltros}</span>}
                </>
              ) : mostrarGradeAnalise ? (
                <span>Análise atual — ajuste, grave e exporte os dados do Nomus.</span>
              ) : (
                <span>Histórico de análises gravadas no sistema.</span>
              )}
            </p>
          </div>
          <div ref={novaAnaliseWrapRef} className="flex shrink-0 flex-wrap items-center gap-2 self-start">
            {mostrarGradeAnalise && (
              <button
                type="button"
                onClick={handleVoltarHistorico}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                title="Voltar para a lista de análises gravadas"
              >
                ← Voltar ao histórico
              </button>
            )}
            {mostrarGradeAnalise && (historicoVisualizado?.status === 'em_processamento' || historicoVisualizado?.status === 'processado') && (
              <button
                type="button"
                onClick={() => void salvarAlteracoesAnalise()}
                disabled={salvandoAlteracoes || linhas.length === 0}
                className={BTN_SECONDARY}
                title="Salva as alterações dos campos editáveis"
              >
                Salvar alterações
              </button>
            )}
            <button
              type="button"
              onClick={handleNovaAnaliseClick}
              className={BTN_PRIMARY}
              aria-expanded={filtrosPopoverAberto}
              aria-haspopup="dialog"
            >
              Nova análise
            </button>
          </div>
        </div>

        {filtrosPopoverAberto && (
          <div
            className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setFiltrosPopoverAberto(false)}
            role="presentation"
          >
            <div
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-800 dark:shadow-black/40 overflow-x-hidden overflow-y-auto"
              style={{
                resize: 'both',
                overflowX: 'hidden',
                overflowY: 'auto',
                width: 'min(calc(100vw - 2rem), 72rem)',
                height: 'min(calc(100vh - 4rem), 34rem)',
                minWidth: '20rem',
                minHeight: '16rem',
                maxWidth: 'calc(100vw - 2rem)',
                maxHeight: 'calc(100vh - 2rem)',
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Filtros — nova análise"
            >
              <div className="relative min-h-[14rem]">
              <CarregandoInformacoesOverlay
                show={opcoesCarregando}
                mensagem="Carregando opções de filtro…"
                mode="contained"
                className="rounded-lg"
              />
              <div className={opcoesCarregando ? 'pointer-events-none opacity-50' : undefined}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Filtros
                </p>
                <button
                  type="button"
                  onClick={() => setFiltrosPopoverAberto(false)}
                  className="ml-2 flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Fechar painel de filtros"
                >
                  ✕
                </button>
              </div>
              <div className="grid min-w-0 grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Código do Produto"
                  placeholder="Digite 2+ caracteres…"
                  options={[]}
                  value={filterCodigo}
                  onChange={(v) => startTransition(() => setFilterCodigo(v))}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  optionLabel="códigos"
                  valueSeparator="|"
                  fillContainer
                  dropdownZIndex={FILTROS_DROPDOWN_Z}
                  minSearchChars={2}
                  onSearchAsync={buscarCodigoFiltroAsync}
                  optionsLoading={opcoesCarregando}
                />
                </div>
                <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Descrição do Produto"
                  placeholder="Digite 2+ caracteres…"
                  options={[]}
                  value={filterDescricao}
                  onChange={(v) => startTransition(() => setFilterDescricao(v))}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  optionLabel="descrições"
                  valueSeparator="|"
                  fillContainer
                  dropdownZIndex={FILTROS_DROPDOWN_Z}
                  minSearchChars={2}
                  onSearchAsync={buscarDescricaoFiltroAsync}
                  optionsLoading={opcoesCarregando}
                />
                </div>
                <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Nome da coleta"
                  placeholder="Todas"
                  options={coletasFiltro}
                  value={filterColeta}
                  onChange={(v) => startTransition(() => setFilterColeta(v))}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  optionLabel="coletas"
                  valueSeparator="|"
                  fillContainer
                  dropdownZIndex={FILTROS_DROPDOWN_Z}
                />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleFiltrar()}
                  disabled={loading || opcoesCarregando}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-4 py-2 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50"
                >
                  Filtrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterCodigo('');
                    setFilterDescricao('');
                    setFilterColeta('');
                    setMsgFiltro(null);
                  }}
                  disabled={loading || opcoesCarregando}
                  className={BTN_SECONDARY}
                >
                  Limpar filtros
                </button>
              </div>
              {msgFiltro && (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300" role="alert">
                  {msgFiltro}
                </p>
              )}
              </div>
              </div>
            </div>
          </div>
        )}

          {!mostrarGradeAnalise && (
            <div className="relative flex-1 min-h-0 card-panel p-4 shadow-sm overflow-auto">
              <CarregandoInformacoesOverlay
                show={historicoListaOverlayAtivo}
                mensagem="Carregando informações..."
                mode="contained"
                className="rounded-xl"
              />
              {/* Legenda dos status */}
              <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">● Em processamento</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">Criado, mas ainda sugerindo quantidades e datas.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-primary-900/40 dark:text-primary-300">◎ Processado</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">Quantidades e datas sugeridas e gravadas, mas pendente análise.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">✓ Concluído</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">Quantidades e datas analisadas e concluídas.</span>
                </div>
              </div>
              {historicoErro && !historicoCarregando && (
                <p className="text-sm text-red-600 dark:text-red-300">{historicoErro}</p>
              )}
              {!historicoCarregando && !historicoErro && historicoLista.length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Nenhuma análise gravada ainda. Use <span className="font-medium">Nova análise</span> para consultar o Nomus e gravar um snapshot.
                </p>
              )}
              {!historicoCarregando && historicoLista.length > 0 && (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                      <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Código da análise</th>
                      <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Data de criação</th>
                      <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Criado por</th>
                      <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Processado por</th>
                      <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Concluído por</th>
                      <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200 text-center">Linhas</th>
                      <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Status</th>
                      <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoLista.map((h) => {
                      const selecionada = historicoVisualizado?.id === h.id;
                      return (
                        <tr
                          key={h.id}
                          tabIndex={0}
                          aria-selected={selecionada}
                          className={`border-b border-slate-100 dark:border-slate-700 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${
                            selecionada
                              ? 'bg-primary-50 dark:bg-primary-900/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                          }`}
                          title="Clique para abrir esta análise na grade"
                          onClick={() => void abrirDetalheHistorico(h.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              void abrirDetalheHistorico(h.id);
                            }
                          }}
                        >
                          <td className="py-2 px-2 font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                            {h.id}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {fmtIsoDataHora(h.createdAt)}
                          </td>
                          <td className="py-2 px-2 text-slate-800 dark:text-slate-200">{h.usuarioLogin}</td>
                          <td className="py-2 px-2 text-slate-500 dark:text-slate-400">
                            {h.usuarioLoginProcessado ? (
                              <span
                                className={
                                  h.processadoAt
                                    ? 'cursor-help border-b border-dotted border-slate-400 dark:border-slate-500'
                                    : undefined
                                }
                                title={
                                  h.processadoAt
                                    ? `Processado em: ${fmtIsoDataHora(h.processadoAt)}`
                                    : undefined
                                }
                              >
                                {h.usuarioLoginProcessado}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-500 dark:text-slate-400">
                            {h.usuarioLoginConcluido ? (
                              <span
                                className={
                                  h.concluidoAt
                                    ? 'cursor-help border-b border-dotted border-slate-400 dark:border-slate-500'
                                    : undefined
                                }
                                title={
                                  h.concluidoAt
                                    ? `Concluído em: ${fmtIsoDataHora(h.concluidoAt)}`
                                    : undefined
                                }
                              >
                                {h.usuarioLoginConcluido}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-800 dark:text-slate-200">{h.linhaCount}</td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            {h.status === 'concluido' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                ✓ Concluído
                              </span>
                            ) : h.status === 'processado' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-primary-900/40 dark:text-primary-300">
                                ◎ Processado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                ● Em processamento
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              disabled={acaoEmAndamento !== null}
                              onClick={(e) => {
                                e.stopPropagation();
                                void gerarPdfHistorico(h.id);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                              title="Gerar PDF desta análise"
                            >
                              {acaoEmAndamento === h.id ? '…' : 'PDF'}
                            </button>
                            {h.status === 'em_processamento' && (
                              <button
                                type="button"
                                disabled={acaoEmAndamento !== null}
                                onClick={(e) => { e.stopPropagation(); void processarAnalise(h.id); }}
                                className="px-2 py-1 rounded-lg border border-blue-400 bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
                                title="Marcar esta análise como Processada"
                              >
                                {acaoEmAndamento === h.id ? '…' : 'Processar'}
                              </button>
                            )}
                            {h.status === 'processado' && (
                              <button
                                type="button"
                                disabled={acaoEmAndamento !== null}
                                onClick={(e) => { e.stopPropagation(); void concluirAnalise(h.id); }}
                                className="px-2 py-1 rounded-lg border border-emerald-400 bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                                title="Concluir esta análise"
                              >
                                {acaoEmAndamento === h.id ? '…' : 'Concluir'}
                              </button>
                            )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

      {mostrarGradeAnalise && (
      <div className="flex flex-col flex-1 min-h-0 gap-1.5">
        {historicoDetalheErro && (
          <p className="text-sm text-red-700 dark:text-red-300 shrink-0" role="alert">
            {historicoDetalheErro}
          </p>
        )}
        {erroApi && (
          <p className="text-sm text-red-700 dark:text-red-300 shrink-0" role="alert">
            {erroApi}
          </p>
        )}
        <div className="flex flex-col flex-1 min-h-0 gap-1">
        <div className="flex flex-wrap items-center justify-between gap-1.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {!analiseReadOnly && (
              <button type="button" onClick={limparFiltrosGrade} className={BTN_PRIMARY} title="Limpar filtros e ordenação da grade (mantém dados carregados)">
                Limpar filtros da grade
              </button>
            )}
            <button
              type="button"
              onClick={() => setModalClassificarOpen(true)}
              disabled={linhas.length === 0}
              className={BTN_SECONDARY}
              title="Definir classificação personalizada (vários níveis)"
            >
              Classificar
            </button>
            {mostrarGradeAnalise && linhas.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="filtro-compra-recorrente-ressup-nao-almox"
                  className="text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0"
                >
                  Compra recorrente
                </label>
                <select
                  id="filtro-compra-recorrente-ressup-nao-almox"
                  value={filtroCompraRecorrente}
                  onChange={(e) => setFiltroCompraRecorrente(e.target.value as '' | 'Sim' | 'Não')}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="">Todos</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
            )}
            {/* Sem historicoVisualizado = análise nova → botão "Gravar análise" cria registro */}
            {!historicoVisualizado && (
              <button
                type="button"
                onClick={() => void gravarSnapshotAnalise()}
                disabled={gravandoAnalise || linhas.length === 0 || aplicado == null}
                className={BTN_SECONDARY}
                title="Grava no banco local um snapshot (status: em processamento) de todas as linhas carregadas"
              >
                Gravar análise
              </button>
            )}
            <button
              type="button"
              onClick={gerarPdfGrade}
              disabled={linhasOrdenadas.length === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              title="Gera PDF com as colunas principais da grade"
            >
              Gerar PDF
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              disabled={linhasOrdenadas.length === 0}
              className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 font-medium text-sm hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
              title="Exporta as linhas e colunas exibidas na grade (respeita filtros por coluna e colunas ocultas)"
            >
              Exportar Excel
            </button>
            {temFiltrosGrade && linhas.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exibindo {linhasOrdenadas.length} de {linhas.length} linha(s) carregada(s)
              </p>
            )}
          </div>
          {mostrarGradeAnalise && linhas.length > 0 && historicoVisualizado && (
            <div className="relative" ref={colunasOcultasRef}>
              <button
                type="button"
                onClick={() => setColunasOcultasOpen((o) => !o)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-expanded={colunasOcultasOpen}
                aria-haspopup="true"
              >
                Colunas
                {colunasOcultasLista.length > 0 && (
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
                    {colunasOcultasLista.length} oculta{colunasOcultasLista.length === 1 ? '' : 's'}
                  </span>
                )}
              </button>
              {colunasOcultasOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  role="dialog"
                  aria-label="Gerenciar colunas da grade"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-600">
                    <p className="text-sm font-semibold">Colunas da grade</p>
                    <button
                      type="button"
                      onClick={reexibirTodasColunas}
                      className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-300"
                    >
                      Reexibir todas
                    </button>
                  </div>
                  {colunasOcultasLista.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Ocultas
                      </p>
                      <div className="max-h-40 overflow-auto">
                        {colunasOcultasLista.map((col) => (
                          <button
                            key={col.key}
                            type="button"
                            onClick={() => reexibirColuna(col.key)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <span className="truncate" title={col.label}>
                              {col.label}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-primary-600 dark:text-primary-300">Reexibir</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {colunasVisiveisLista.length > 0 && (
                    <div className={colunasOcultasLista.length > 0 ? 'mt-3 border-t border-slate-200 pt-2 dark:border-slate-600' : 'mt-2'}>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Visíveis
                      </p>
                      <div className="max-h-48 overflow-auto">
                        {colunasVisiveisLista.map((col) => (
                          <button
                            key={col.key}
                            type="button"
                            onClick={() => ocultarColuna(col.key)}
                            disabled={colunasVisiveisLista.length <= 1}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-700"
                          >
                            <span className="truncate" title={col.label}>
                              {col.label}
                            </span>
                            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">Ocultar</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {feedbackGravacao && (
          <p
            className={`text-xs sm:text-sm shrink-0 ${feedbackGravacao.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
            role="status"
          >
            {feedbackGravacao.msg}
          </p>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div
            ref={tableScrollRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain max-h-[calc(100vh-10rem)]"
          >
            <table
              className="w-full border-separate border-spacing-0 text-left text-sm"
              style={{ tableLayout: 'fixed', minWidth: larguraMinimaTabela }}
            >
              <colgroup>
                {colunasVisiveisLista.map((col) => (
                  <col
                    key={col.key}
                    style={{ width: colWidths[col.key] ?? RESSUP_NAO_ALMOX_DEFAULT_COL_WIDTHS[col.key] ?? 96 }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-primary-600 text-white">
                  {colunasVisiveisLista.map((col) => {
                    const sortAtivo =
                      sortState?.key === col.key || sortLevels.some((l) => l.id === col.key);
                    return (
                    <th
                      key={col.key}
                      className="sticky top-0 z-30 border border-primary-500/40 bg-primary-600 px-1.5 py-2 align-middle font-semibold shadow-[0_1px_0_rgba(0,0,0,0.08)]"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-1">
                        <span className="min-w-0 flex-1 truncate leading-tight text-[11px] sm:text-xs" title={col.label}>
                          {col.label}
                        </span>
                        <span className="flex shrink-0 flex-col gap-0.5">
                          <GradeFiltroCabecalhoBtn
                            ativo={Boolean(columnFilters[col.key]?.trim()) || sortAtivo}
                            onClick={(e) => abrirFiltroExcel(col.key, e)}
                          />
                          <button
                            type="button"
                            onClick={() => ocultarColuna(col.key)}
                            disabled={colunasVisiveisLista.length <= 1}
                            className="inline-flex items-center justify-center rounded border border-white/25 px-1 py-0.5 text-white/80 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                            title="Ocultar coluna"
                            aria-label={`Ocultar coluna ${col.label}`}
                          >
                            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.08A9.77 9.77 0 0112 4c5 0 8.27 4.11 9.54 6.06a1.75 1.75 0 010 1.88 16.2 16.2 0 01-2.1 2.64M6.1 6.1a16.46 16.46 0 00-3.64 3.96 1.75 1.75 0 000 1.88C3.73 13.89 7 18 12 18a9.77 9.77 0 004.17-.94"
                              />
                            </svg>
                          </button>
                        </span>
                      </div>
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Redimensionar coluna ${col.label}`}
                        title="Arraste para ajustar a largura"
                        className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-sky-300/60 active:bg-sky-300"
                        onPointerDown={(e) => onColResizePointerDown(col.key, e)}
                        onPointerMove={onColResizePointerMove}
                        onPointerUp={onColResizePointerEnd}
                        onPointerCancel={onColResizePointerEnd}
                      />
                    </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200 divide-y divide-slate-200 dark:divide-slate-600">
                {aplicado == null && !loading && (
                  <tr>
                    <td
                      colSpan={colSpanGrade}
                      className="py-6 px-3 text-center text-slate-500 dark:text-slate-400 text-xs"
                    >
                      Abra <span className="font-medium">Nova análise</span>, defina os filtros (como em Coletas de Preços) e clique em Filtrar para carregar os itens.
                    </td>
                  </tr>
                )}
                {!loading && aplicado != null && linhas.length === 0 && !erroApi && (
                  <tr>
                    <td colSpan={colSpanGrade} className="py-6 px-3 text-center text-slate-600 dark:text-slate-300 text-xs">
                      {msgLista ??
                        `Filtros aplicados: ${resumoFiltros}. Nenhuma linha retornada para esses filtros no Nomus.`}
                    </td>
                  </tr>
                )}
                {!loading && !prefetchEstoqueCarregando && aplicado != null && linhas.length > 0 && linhasOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={colSpanGrade} className="py-6 px-3 text-center text-slate-500 dark:text-slate-400 text-xs">
                      Nenhuma linha com os filtros da grade. Ajuste ou limpe os filtros por coluna.
                    </td>
                  </tr>
                )}
                {!loading && !prefetchEstoqueCarregando &&
                  linhasOrdenadas.map((row, idx) => {
                    const rowKey = getRowKey(row, idx);
                    const inputs = userInputs[rowKey];
                    /** Tooltips concentram informações ocultas da grade em colunas-âncora. */
                    const tooltipCodigo = `Und Medida: ${getRessupCell(row, 'undMedida', inputs)}`;
                    const tooltipQtdSolicit =
                      `Data Solicit.: ${getRessupCell(row, 'dataSolicit', inputs)}\n` +
                      `Data Necess.: ${getRessupCell(row, 'dataNecess', inputs)}`;
                    const tooltipPreco =
                      `Data Ult Entrada: ${getRessupCell(row, 'dataUltEntrada', inputs)}\n` +
                      `Preço Ant: ${getRessupCell(row, 'precoAnt', inputs)}`;
                    const coberturaVal = calcCobertura(row, inputs);
                    const vmRaw = getVmRawFromRow(row);
                    const coberturaBaixa =
                      Number.isFinite(vmRaw) &&
                      vmRaw > 0.5 &&
                      coberturaVal != null &&
                      Number.isFinite(coberturaVal) &&
                      coberturaVal < 1;
                    return (
                      <tr
                        key={rowKey}
                        className={
                          coberturaBaixa
                            ? RUPTURA_ROW_CLASS
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                        }
                      >
                        {colunasVisiveisLista.map((col) => {
                          if (NUMERIC_INPUT_KEYS.has(col.key)) {
                            // qtdeSug: somente leitura quando processado ou concluido
                            // qtdAprov: somente leitura apenas quando concluido
                            const isReadOnly = analiseReadOnly || (apenasAprovEditavel && col.key === 'qtdeSug');
                            const obsCol = isRessupObsColKey(col.key) ? col.key : null;
                            const obsBtn =
                              obsCol != null ? (
                                <BotaoObservacaoCelula
                                  hasObservacao={hasRessupObservacao(inputs, obsCol)}
                                  bloqueado={observacaoBloqueada(obsCol)}
                                  titulo={
                                    observacaoBloqueada(obsCol)
                                      ? hasRessupObservacao(inputs, obsCol)
                                        ? 'Ver observação (somente leitura)'
                                        : 'Observações bloqueadas nesta etapa'
                                      : hasRessupObservacao(inputs, obsCol)
                                        ? 'Editar observação'
                                        : 'Adicionar observação'
                                  }
                                  onClick={() =>
                                    setObsModal({
                                      rowKey,
                                      col: obsCol,
                                      colLabel: col.label,
                                      codigo: getRessupCell(row, 'codigo', inputs),
                                      descricao: getRessupCell(row, 'descricao', inputs),
                                      somenteLeitura: observacaoBloqueada(obsCol),
                                    })
                                  }
                                />
                              ) : null;
                            const tdObs = obsCol ? tdComObsClass(inputs, obsCol) : '';
                            if (isReadOnly) {
                              return (
                                <td
                                  key={col.key}
                                  className={`border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words text-right dark:text-slate-200 ${tdObs}`}
                                >
                                  <div className="flex min-w-0 items-center gap-1">
                                    {obsBtn}
                                    <span className="min-w-0 flex-1 tabular-nums">{fmtNumeroUsuario(inputs?.[col.key])}</span>
                                  </div>
                                </td>
                              );
                            }
                            const mostrarCopiarSug = apenasAprovEditavel && col.key === 'qtdAprov';
                            return (
                              <td
                                key={col.key}
                                className={`border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words dark:text-slate-200 ${tdObs}`}
                              >
                                <div className="flex min-w-0 items-center gap-1">
                                  {obsBtn}
                                  {mostrarCopiarSug && (
                                    <button
                                      type="button"
                                      onClick={() => copiarSugestoesParaAprovacao(rowKey)}
                                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-primary-50 hover:text-primary-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                      title="Copiar Qtde Sug e Data Necess Sug para Qtd Aprov e Data Necess Aprov"
                                      aria-label="Copiar sugestões para aprovação"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    min={0}
                                    value={inputs?.[col.key] ?? ''}
                                    onChange={(e) => setRowInput(rowKey, col.key, e.target.value)}
                                    onKeyDown={(e) => handleInputEnterKey(e, idx, col.key)}
                                    data-editinput
                                    data-rowkey={rowKey}
                                    data-colkey={col.key}
                                    className="ressup-nao-almox-num-input min-w-0 flex-1 rounded border border-slate-300 bg-white px-1.5 py-1 text-right text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                                    placeholder="—"
                                    aria-label={col.label}
                                  />
                                </div>
                              </td>
                            );
                          }
                          if (DATE_INPUT_KEYS.has(col.key)) {
                            // dataNecessSug: somente leitura quando processado ou concluido
                            // dataNecessAprov: somente leitura apenas quando concluido
                            const isReadOnly = analiseReadOnly || (apenasAprovEditavel && col.key === 'dataNecessSug');
                            const obsCol = isRessupObsColKey(col.key) ? col.key : null;
                            const obsBtn =
                              obsCol != null ? (
                                <BotaoObservacaoCelula
                                  hasObservacao={hasRessupObservacao(inputs, obsCol)}
                                  bloqueado={observacaoBloqueada(obsCol)}
                                  titulo={
                                    observacaoBloqueada(obsCol)
                                      ? hasRessupObservacao(inputs, obsCol)
                                        ? 'Ver observação (somente leitura)'
                                        : 'Observações bloqueadas nesta etapa'
                                      : hasRessupObservacao(inputs, obsCol)
                                        ? 'Editar observação'
                                        : 'Adicionar observação'
                                  }
                                  onClick={() =>
                                    setObsModal({
                                      rowKey,
                                      col: obsCol,
                                      colLabel: col.label,
                                      codigo: getRessupCell(row, 'codigo', inputs),
                                      descricao: getRessupCell(row, 'descricao', inputs),
                                      somenteLeitura: observacaoBloqueada(obsCol),
                                    })
                                  }
                                />
                              ) : null;
                            const tdObs = obsCol ? tdComObsClass(inputs, obsCol) : '';
                            if (isReadOnly) {
                              return (
                                <td
                                  key={col.key}
                                  className={`border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words dark:text-slate-200 ${tdObs}`}
                                >
                                  <div className="flex min-w-0 items-center gap-1">
                                    <span className="min-w-0 flex-1">{fmtDataUsuario(inputs?.[col.key])}</span>
                                    {obsBtn}
                                  </div>
                                </td>
                              );
                            }
                            return (
                              <td
                                key={col.key}
                                className={`border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words dark:text-slate-200 ${tdObs}`}
                              >
                                <div className="flex min-w-0 items-center gap-1">
                                  <input
                                    type="date"
                                    value={inputs?.[col.key] ?? ''}
                                    onChange={(e) => setRowInput(rowKey, col.key, e.target.value)}
                                    onKeyDown={(e) => handleInputEnterKey(e, idx, col.key)}
                                    data-editinput
                                    data-rowkey={rowKey}
                                    data-colkey={col.key}
                                    className="min-w-0 flex-1 max-w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                                    aria-label={col.label}
                                  />
                                  {obsBtn}
                                </div>
                              </td>
                            );
                          }
                          let tooltip: string | undefined;
                          if (col.key === 'codigo') {
                            const codVal = getRessupCell(row, 'codigo', inputs);
                            const nomeColeta = getNomeColetaFromRow(row);
                            const ehFundivel = isColetaFundiveis(nomeColeta);
                            return (
                              <td
                                key={col.key}
                                className="border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words dark:text-slate-200"
                                title={tooltipCodigo}
                              >
                                {ehFundivel ? (
                                  <button
                                    type="button"
                                    className="text-left text-primary-600 hover:underline dark:text-primary-400"
                                    onClick={() =>
                                      setFundivelModal({
                                        rowKey,
                                        codSemPintura: codVal,
                                      })
                                    }
                                  >
                                    {codVal}
                                  </button>
                                ) : (
                                  <span>{codVal}</span>
                                )}
                              </td>
                            );
                          }
                          if (col.key === 'qtdeEmp') {
                            const val = getRessupCell(row, 'qtdeEmp', inputs);
                            const idProd = getIdProdutoFromRow(row);
                            const qtdeEmp = getQtdeEmpNumerico(row);
                            const clicavel = idProd != null && qtdeEmp > 0;
                            return (
                              <td
                                key={col.key}
                                className="border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words text-right dark:text-slate-200"
                              >
                                {clicavel ? (
                                  <GradeCelulaModalBtn
                                    onClick={() =>
                                      setEmpenhoModal({
                                        idProduto: idProd,
                                        codigo: getRessupCell(row, 'codigo', inputs),
                                        descricao: getRessupCell(row, 'descricao', inputs),
                                        saldoAtual: getEstoqAtualNumerico(row, inputs),
                                      })
                                    }
                                    title="Ver empenho por pedido"
                                  >
                                    {val}
                                  </GradeCelulaModalBtn>
                                ) : (
                                  <span className="block text-right tabular-nums">{val}</span>
                                )}
                              </td>
                            );
                          }
                          if (col.key === 'estoqAtual') {
                            const val = getRessupCell(row, 'estoqAtual', inputs);
                            const idProd = getIdProdutoFromRow(row);
                            const nomeColeta = getNomeColetaFromRow(row);
                            const modoFund = isColetaFundiveis(nomeColeta);
                            const exclMarc = coletaExcluiMarcenaria(nomeColeta);
                            const btnVariant = temEstoqueProducaoManual(inputs, modoFund, exclMarc)
                              ? 'verde'
                              : 'laranja';
                            return (
                              <td
                                key={col.key}
                                className="border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words text-right tabular-nums dark:text-slate-200"
                              >
                                {idProd != null ? (
                                  <GradeCelulaModalBtn
                                    variant={btnVariant}
                                    onClick={() => {
                                      setEstoqueModal({
                                        rowKey,
                                        idProduto: idProd,
                                        codigo: getRessupCell(row, 'codigo', inputs),
                                        descricao: getRessupCell(row, 'descricao', inputs),
                                        codigoPintado:
                                          inputs?.codigoPintado ??
                                          (typeof row['_codigoPintado'] === 'string'
                                            ? row['_codigoPintado']
                                            : null),
                                        modoFundivel: modoFund,
                                        excluirMarcenaria: exclMarc,
                                        nomeColeta: getNomeColetaFromRow(row),
                                      });
                                    }}
                                    title="Detalhar estoque"
                                  >
                                    {val}
                                  </GradeCelulaModalBtn>
                                ) : (
                                  <span className="block text-right tabular-nums">{val}</span>
                                )}
                              </td>
                            );
                          }
                          if (col.key === 'qtdSolicit') {
                            const val = getRessupCell(row, 'qtdSolicit', inputs);
                            const idProd = getIdProdutoFromRow(row);
                            const clicavel = idProd != null;
                            return (
                              <td
                                key={col.key}
                                className="border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words text-right dark:text-slate-200"
                                title={tooltipQtdSolicit}
                              >
                                {clicavel ? (
                                  <GradeCelulaModalBtn
                                    onClick={() =>
                                      setDetalheConsultaModal({
                                        tipo: 'solicitacao',
                                        idProduto: idProd,
                                        codigo: getRessupCell(row, 'codigo', inputs),
                                        descricao: getRessupCell(row, 'descricao', inputs),
                                      })
                                    }
                                    title="Ver solicitações de compra abertas"
                                  >
                                    {val}
                                  </GradeCelulaModalBtn>
                                ) : (
                                  <span className="block text-right tabular-nums">{val}</span>
                                )}
                              </td>
                            );
                          }
                          if (col.key === 'cm') tooltip = tooltipPreco;
                          if (col.key === 'cobertura') {
                            const cob = calcCobertura(row, inputs);
                            const baixa = cob != null && Number.isFinite(cob) && cob < 1;
                            return (
                              <td
                                key={col.key}
                                className={`border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words text-right tabular-nums dark:text-slate-200 ${
                                  baixa ? RUPTURA_CELL_CLASS : ''
                                }`}
                              >
                                {getRessupCell(row, 'cobertura', inputs)}
                              </td>
                            );
                          }
                          if (col.key === 'pcPend') {
                            const val = getRessupCell(row, 'pcPend', inputs);
                            const idProd = getIdProdutoFromRow(row);
                            const qtdePc = getPcPendNumerico(row);
                            const clicavel = idProd != null && qtdePc > 0;
                            return (
                              <td
                                key={col.key}
                                className="border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words text-right dark:text-slate-200"
                              >
                                {clicavel ? (
                                  <GradeCelulaModalBtn
                                    onClick={() =>
                                      setPcPendModal({
                                        idProduto: idProd,
                                        codigo: getRessupCell(row, 'codigo', inputs),
                                        descricao: getRessupCell(row, 'descricao', inputs),
                                      })
                                    }
                                    title="Ver pedidos de compra pendentes"
                                  >
                                    {val}
                                  </GradeCelulaModalBtn>
                                ) : (
                                  <span className="block text-right tabular-nums">{val}</span>
                                )}
                              </td>
                            );
                          }
                          if (col.key === 'agPag') {
                            const val = getRessupCell(row, 'agPag', inputs);
                            const idProd = getIdProdutoFromRow(row);
                            const qtdeAg = getAgPagNumerico(row);
                            const clicavel = idProd != null && qtdeAg > 0;
                            return (
                              <td
                                key={col.key}
                                className="border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words text-right dark:text-slate-200"
                              >
                                {clicavel ? (
                                  <GradeCelulaModalBtn
                                    onClick={() =>
                                      setDetalheConsultaModal({
                                        tipo: 'cotacao',
                                        idProduto: idProd,
                                        codigo: getRessupCell(row, 'codigo', inputs),
                                        descricao: getRessupCell(row, 'descricao', inputs),
                                      })
                                    }
                                    title="Ver cotações aguardando pagamento"
                                  >
                                    {val}
                                  </GradeCelulaModalBtn>
                                ) : (
                                  <span className="block text-right tabular-nums">{val}</span>
                                )}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.key}
                              title={tooltip}
                              className={`border border-slate-200 dark:border-slate-600 px-1 py-1 align-top text-xs break-words dark:text-slate-200 ${
                                tooltip ? 'cursor-help' : ''
                              }`}
                            >
                              {getRessupCell(row, col.key, inputs)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
      )}
        </>

      {colunaFiltroAberta && filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={colunaFiltroAberta}
          rect={filtroAbertoRect}
          dropdownRef={filtroDropdownRef}
          excelFilterDrafts={excelFilterDrafts}
          setExcelFilterDrafts={setExcelFilterDrafts}
          valoresUnicosPorColuna={valoresUnicosPorColuna}
          sortAscLabel={getOrderLabelsForRessupNaoAlmoxCol(colunaFiltroAberta).asc}
          sortDescLabel={getOrderLabelsForRessupNaoAlmoxCol(colunaFiltroAberta).desc}
          showNumericFilters={isRessupNaoAlmoxColNumeric(colunaFiltroAberta)}
          onSortAsc={(colId) => {
            setSortState({ key: colId as ColKey, direction: 'asc' });
            setSortLevels([]);
            fecharFiltroExcel();
          }}
          onSortDesc={(colId) => {
            setSortState({ key: colId as ColKey, direction: 'desc' });
            setSortLevels([]);
            fecharFiltroExcel();
          }}
          onAplicar={(colId) => aplicarFiltroExcel(colId as ColKey)}
          onCancelar={fecharFiltroExcel}
        />
      )}

      <ModalClassificarGrade
        open={modalClassificarOpen}
        onClose={() => setModalClassificarOpen(false)}
        colunas={colunasClassificaveisAtivas}
        initialLevels={sortLevels.length > 0 ? sortLevels : SORT_DEFAULT_RESSUP_NAO_ALMOX}
        getOrderLabels={getOrderLabelsForRessupNaoAlmoxCol}
        onApply={(levels) => {
          setSortLevels(levels);
          setSortState(null);
        }}
      />

      <ModalPcPendDetalhes
        open={pcPendModal != null}
        idProduto={pcPendModal?.idProduto ?? null}
        codigo={pcPendModal?.codigo ?? ''}
        descricao={pcPendModal?.descricao ?? ''}
        onClose={() => setPcPendModal(null)}
        cacheRef={pcPendCacheRef}
        fetchDetalhes={obterRessupNaoAlmoxPcPendDetalhes}
      />

      {detalheConsultaModal && (
        <ModalConsultaEstoqueDetalhe
          open
          titulo={
            detalheConsultaModal.tipo === 'solicitacao'
              ? `Solicitação de compra — ${detalheConsultaModal.codigo}`
              : `Ag Pag — ${detalheConsultaModal.codigo}`
          }
          subtitulo={detalheConsultaModal.descricao}
          onClose={() => setDetalheConsultaModal(null)}
          detailKey={detalheConsultaDetailKey}
          onLoad={carregarDetalheConsultaModal}
        >
          {({ carregando, erro }) => {
            if (carregando) return <p className="py-6 text-center text-slate-500">Carregando…</p>;
            if (erro) return <p className="text-red-600">{erro}</p>;
            if (detalheConsultaModal.tipo === 'solicitacao') {
              return <TabelaDetalheSolicitacao linhas={detalheSc} />;
            }
            return <TabelaDetalheCotacao linhas={detalheCotacao} />;
          }}
        </ModalConsultaEstoqueDetalhe>
      )}

      <ModalObservacaoCelula
        open={obsModal != null}
        tituloColuna={obsModal?.colLabel ?? ''}
        codigo={obsModal?.codigo ?? ''}
        descricao={obsModal?.descricao ?? ''}
        valorInicial={
          obsModal ? (userInputs[obsModal.rowKey]?.observacoes?.[obsModal.col] ?? '') : ''
        }
        somenteLeitura={obsModal?.somenteLeitura ?? false}
        onClose={() => setObsModal(null)}
        onSalvar={(texto) => {
          if (!obsModal || obsModal.somenteLeitura) return;
          setRowObservacao(obsModal.rowKey, obsModal.col, texto);
        }}
      />

      {confirmRequisicoesAberto && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <p className="text-sm text-slate-800 dark:text-slate-100">
              Deseja considerar <strong>requisições de loja</strong> no cálculo de <strong>Empenho</strong>?
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Requisições = pedidos com atributo Requisitado (313) = Sim. Pedidos{' '}
              <strong>Produção para estoque</strong> entram sempre, em Sim ou Não.
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={voltarConfirmRequisicoes}
              >
                ← Voltar
              </button>
              <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-200"
                onClick={() => confirmarRequisicoes(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white"
                onClick={() => confirmarRequisicoes(true)}
              >
                Sim
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ModalEmpenhoRessup
        open={empenhoModal != null}
        idProduto={empenhoModal?.idProduto ?? null}
        codigo={empenhoModal?.codigo ?? ''}
        descricao={empenhoModal?.descricao ?? ''}
        saldoAtual={empenhoModal?.saldoAtual ?? 0}
        considerarRequisicoes={considerarRequisicoes}
        modoNaoAlmox
        onClose={() => setEmpenhoModal(null)}
        cacheRef={empenhoCacheRef}
      />

      {estoqueModal && (
        <ModalEstoqueNaoAlmox
          idProduto={estoqueModal.idProduto}
          codigo={estoqueModal.codigo}
          descricao={estoqueModal.descricao}
          codigoPintado={estoqueModal.codigoPintado}
          modoFundivel={estoqueModal.modoFundivel}
          excluirMarcenaria={estoqueModal.excluirMarcenaria}
          nomeColeta={estoqueModal.nomeColeta}
          readOnly={analiseReadOnly}
          estoqueEmProducao={userInputs[estoqueModal.rowKey]?.estoqueEmProducao}
          onClose={() => setEstoqueModal(null)}
          onSave={({ estoqueEmProducao, estoqueTotal }) => {
            setRowInputsPartial(estoqueModal.rowKey, { estoqueEmProducao, estoqueTotal });
          }}
          cacheRef={estoqueCacheRef}
        />
      )}

      {fundivelModal && (
        <ModalRelacaoFundivel
          codSemPintura={fundivelModal.codSemPintura}
          codComPinturaAtual={
            userInputs[fundivelModal.rowKey]?.codigoPintado ??
            codigoPintadoDoCatalogo(fundivelModal.codSemPintura) ??
            ''
          }
          readOnly={analiseReadOnly}
          onClose={() => setFundivelModal(null)}
          onSave={(codComPintura) => {
            setRowInputsPartial(fundivelModal.rowKey, { codigoPintado: codComPintura });
            if (!analiseReadOnly) {
              const sem = normalizarCodProduto(fundivelModal.codSemPintura);
              patchCatalogoFundivelRuntime(sem, codComPintura);
              void saveCatalogoFundivelNaoAlmox(sem, codComPintura).then((r) =>
                aplicarCatalogoRessupNaoAlmox({ fundiveis: r.fundiveis })
              );
            }
          }}
        />
      )}

      {confirmSairAberto && (
        <div
          className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => setConfirmSairAberto(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ressup-confirm-sair-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ressup-confirm-sair-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Sair da análise?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Deseja gravar as alterações antes de voltar ao histórico ou sair sem salvar?
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConfirmSairAberto(false)} className={BTN_SECONDARY}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmSairSemSalvar} className={BTN_SECONDARY}>
                Sair sem salvar
              </button>
              {podeSalvarAntesDeSair && (
                <button
                  type="button"
                  onClick={() => void handleConfirmSalvarESair()}
                  disabled={gravandoAnalise || salvandoAlteracoes}
                  className={BTN_PRIMARY}
                >
                  {historicoVisualizado ? 'Salvar e sair' : 'Gravar e sair'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
