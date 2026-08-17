import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  colunaCalendarioId,
  computarCalendarioProducao,
  dataProducaoInserirRomaneioApartirDe,
  dataProducaoCarradaEmFormacaoApartirDe,
  datasItemPedidoGerenciador,
  encontrarLinhaSnapshotParaTooltipItem,
  formatDataCurta,
  formatQtdeInt,
  isFimDeSemana,
  carradaKey,
  linhaCarradaKey,
  maxDataProducaoCarradasNormais,
  montarDemandaMateriaisDoCalendario,
  montarEixoDatasCalendario,
  resolverDataCalendarioLinha,
  simItemKey,
  toISODate,
  tooltipDetalheComDatasEfetivas,
  valorEfetivo,
  type CalendarioAAlocarItem,
  type CalendarioCelulaDetalhe,
  type CarradaBaseline,
  type ColunaCalendario,
  type SimEntry,
} from './simulacaoCarradas';
import IndicadorDataPorPrevisao from './IndicadorDataPorPrevisao';
import IndicadoresPrevisaoConfiavel, { IndicadorPrevisaoConfiavel } from './IndicadorPrevisaoConfiavel';
import {
  agregarStatusConfiavel,
  linhaPassaFiltroConfiavel,
  mapaStatusConfiavelPorId,
  statusConfiavelDaLinha,
  statusConfiavelDoDetalhe,
  type StatusConfiavelCalendario,
} from './previsaoConfiavelCalendario';

function BadgeSemCarrada() {
  return (
    <span
      className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/40 dark:text-amber-200"
      title="Inserir em Romaneio ≥ corte com produção alocada — ainda sem ROTA/carrada formada"
    >
      Sem carrada
    </span>
  );
}
import CalendarioSetorProdutosModal from './CalendarioSetorProdutosModal';
import CalendarioMateriaisDiaModal from './CalendarioMateriaisDiaModal';
import CalendarioMaterialHorizonteModal from './CalendarioMaterialHorizonteModal';
import {
  comparePedidoAsc,
  isCarradaOrdemFinal,
  linhaSnapshotParaPedido,
  listarLinhasSnapshotPorPd,
  listarTooltipDetalhePorPd,
  montarEscopoReplicacaoMesmoRm,
  type EscopoReplicacaoRm,
  SUBTOTAL_ROW_CLASS,
} from './sequenciamentoCarradasUtils';
import {
  mensagemCanalDatasPedido,
  rotaPermiteAlterarDatasNoSequenciamentoCalendario,
  pedidoPermiteAlterarDatasNoSequenciamentoCalendario,
} from '../../utils/canalReprogramacaoDatas';
import MultiSelectWithSearch from '../MultiSelectWithSearch';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import HeatmapPedidoItensModal from '../HeatmapPedidoItensModal';
import ModalAjustePrevisao, {
  type AjustePrevisaoContextoCalendario,
  type AjustePrevisaoSimulacaoMeta,
  type AjustePrevisaoSuccessMeta,
} from '../ModalAjustePrevisao';
import GradeCelulaModalBtn from '../pcp/GradeCelulaModalBtn';
import CopiarTextoBtn, { numeroPedidoLimpo } from '../CopiarTextoBtn';
import { labelPedidoMapa } from '../../utils/mapaMunicipioPedido';
import { normalizePdLabelForCompare } from '../../utils/rotaCarrada';
import {
  montarQtdeLiquidaDoSnapshot,
} from '../../utils/abaterSaldoEstoqueProgramacao';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { useModalFlutuante } from '../../hooks/useModalFlutuante';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import type { Pedido, TooltipDetalheRow } from '../../api/pedidos';
import {
  consultarDisponibilidadeMateriaisSintetica,
  type DisponibilidadeMateriaisSintetica,
  type MaterialCriticoCalendario,
  type MaterialDiaCalendario,
  type StatusMaterialDia,
  type StatusPorDataMateriais,
} from '../../api/sequenciamentoCarradas';

type Props = {
  linhas: Record<string, unknown>[];
  sim: Map<string, SimEntry>;
  baseline: Map<string, CarradaBaseline>;
  onClose: () => void;
  onLinhasAtualizadas?: (linhas: Record<string, unknown>[]) => void;
  onEditarDataProducao?: (carradaKey: string, novaData: string) => void;
  onEditarDataEntrega?: (carradaKey: string, novaData: string) => void;
  /** Motivo/obs/confiável do modal de reprogramação → estado do rascunho (conclusão). */
  onRegistrarMotivoSimulacao?: (idsPedido: string[], meta: AjustePrevisaoSimulacaoMeta) => void;
  /** False quando o snapshot já está concluído (somente leitura). */
  editavel?: boolean;
  /**
   * Saldo de estoque congelado no snapshot do sequenciamento.
   * Ausente/legado: passar `{}` e `estoqueCongelado: false`.
   */
  estoquePorCod?: Record<string, number>;
  /** True se o payload tinha `estoquePorCod` (mesmo que vazio). */
  estoqueCongelado?: boolean;
  /** ISO de quando linhas+estoque foram capturados (legenda). */
  geradoEm?: string;
  /**
   * Snapshot da sequência em visualização. Com ele, materiais, PCs e estoque/empenho
   * saem da base congelada no Gravar em vez do Nomus ao vivo.
   */
  snapshotId?: number | null;
  /**
   * Overrides de previsão confiável do rascunho (id_pedido → true/false/null).
   * Precedência no calendário: override → snapshot → em branco.
   */
  previsaoConfiavelPorId?: Record<string, boolean | null>;
};

type EscopoAjustePd = 'item' | 'todos_itens_pd';

type PedidoAjusteState = {
  pedido: Pedido;
  pd: string;
  carradaKey: string;
  carradaKeysTodosItens: string[];
  calendario: AjustePrevisaoContextoCalendario;
  escopo: EscopoAjustePd;
};

type Drill =
  | { nivel: 'pivot' }
  | { nivel: 'tipof'; setor: string; data: string }
  | { nivel: 'carradas'; setor: string; data: string; tipoF: string }
  | { nivel: 'pedidos'; setor: string; data: string; tipoF: string; carradaKey: string };

/** TipoFs distintos na célula (setor + data). */
function tipoFsNaCelula(detalhes: CalendarioCelulaDetalhe[], setor: string, data: string): string[] {
  const set = new Set<string>();
  for (const d of detalhes) {
    if (d.setor === setor && d.data === data) set.add(d.tipoF);
  }
  return [...set];
}

/** Chaves de carrada distintas no TipoF da célula. */
function carradaKeysNoTipoF(
  detalhes: CalendarioCelulaDetalhe[],
  setor: string,
  data: string,
  tipoF: string
): string[] {
  const set = new Set<string>();
  for (const d of detalhes) {
    if (d.setor === setor && d.data === data && d.tipoF === tipoF) {
      set.add(carradaKey(d.cod, d.carrada));
    }
  }
  return [...set];
}

/**
 * Abre o drill a partir da qtde do dia: se só houver um TipoF, pula essa tela;
 * se esse TipoF tiver só uma carrada, vai direto aos pedidos (nível útil).
 */
function drillAposCliqueQtde(
  detalhes: CalendarioCelulaDetalhe[],
  setor: string,
  data: string
): Drill {
  const tipos = tipoFsNaCelula(detalhes, setor, data);
  if (tipos.length !== 1) return { nivel: 'tipof', setor, data };
  const tipoF = tipos[0]!;
  const keys = carradaKeysNoTipoF(detalhes, setor, data, tipoF);
  if (keys.length === 1) {
    return { nivel: 'pedidos', setor, data, tipoF, carradaKey: keys[0]! };
  }
  return { nivel: 'carradas', setor, data, tipoF };
}

/** Após escolher um TipoF: pula carradas quando há só uma. */
function drillAposEscolherTipoF(
  detalhes: CalendarioCelulaDetalhe[],
  setor: string,
  data: string,
  tipoF: string
): Drill {
  const keys = carradaKeysNoTipoF(detalhes, setor, data, tipoF);
  if (keys.length === 1) {
    return { nivel: 'pedidos', setor, data, tipoF, carradaKey: keys[0]! };
  }
  return { nivel: 'carradas', setor, data, tipoF };
}

type SetorRow = { setor: string };

const COL_SETOR = 'setor';
const COL_TOTAL = '__total';
type IconeCalendario = 'previsao' | StatusConfiavelCalendario;

const ICONES_CALENDARIO_INICIAIS: Record<IconeCalendario, boolean> = {
  previsao: true,
  sim: true,
  nao: true,
  branco: true,
};

function filtrarStatusConfiavelVisivel(
  statuses: StatusConfiavelCalendario[],
  iconesVisiveis: Record<IconeCalendario, boolean>
): StatusConfiavelCalendario[] {
  return statuses.filter((status) => iconesVisiveis[status]);
}

const TH = 'px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'px-2 py-1.5 text-slate-700 dark:text-slate-200';
const WEEKEND_TD = 'bg-slate-100/80 dark:bg-slate-900/40';
const OCIOso_TD = 'bg-slate-50/60 dark:bg-slate-900/20';

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

function pdDaLinha(row: Record<string, unknown>): string {
  for (const k of ['PD', 'pd']) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function pdPassaFiltro(pdLinha: string, selecionados: string[]): boolean {
  if (selecionados.length === 0) return true;
  const digitosLinha = normalizePdLabelForCompare(pdLinha);
  return selecionados.some((sel) => {
    if (!sel.trim()) return false;
    if (pdLinha.trim().toUpperCase() === sel.trim().toUpperCase()) return true;
    const digitosSel = normalizePdLabelForCompare(sel);
    return !!digitosLinha && !!digitosSel && digitosLinha === digitosSel;
  });
}

function requisicaoDaLinha(row: Record<string, unknown>): string {
  for (const k of ['Requisicao de loja do grupo?', 'requisicao de loja do grupo?']) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function requisicaoPassaFiltro(valorLinha: string, selecionados: string[]): boolean {
  if (selecionados.length === 0) return true;
  return selecionados.some((sel) => sel.trim().toUpperCase() === valorLinha.trim().toUpperCase());
}

const FILTRO_PD_LABEL_CLASS = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';
const FILTRO_PD_INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 focus:border-transparent focus:ring-2 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';
/** Acima do modal do calendário (z ~50–130) e do portal de filtro Excel. */
const FILTRO_PD_DROPDOWN_Z = 10080;

function formatGeradoEmLegenda(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

function tituloStatusMateriais(st: StatusPorDataMateriais | undefined): string {
  if (!st) return 'Disponibilidade de materiais não carregada';
  if (st.status === 'falta') {
    return `${st.qtdeMateriaisFalta} material(is) em falta neste dia — clique para detalhar`;
  }
  if (st.status === 'atencao') {
    return `${st.qtdeMateriaisAtencao} material(is) cobertos só com PC do dia — clique para detalhar`;
  }
  return 'Materiais OK neste dia — clique para ver';
}

function SemaforoMateriais({
  status,
  title,
  onClick,
}: {
  status: StatusMaterialDia | undefined;
  title: string;
  onClick: () => void;
}) {
  const cor =
    status === 'falta'
      ? 'bg-red-400 ring-red-200'
      : status === 'atencao'
        ? 'bg-amber-300 ring-amber-100'
        : status === 'ok'
          ? 'bg-emerald-400 ring-emerald-100'
          : 'bg-slate-400/70 ring-slate-200';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`ml-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${cor} hover:scale-125`}
      aria-label={title}
    />
  );
}

export default function CalendarioProducaoModal({
  linhas,
  sim,
  baseline,
  onClose,
  onLinhasAtualizadas: _onLinhasAtualizadas,
  onEditarDataProducao,
  onEditarDataEntrega,
  onRegistrarMotivoSimulacao,
  editavel = true,
  estoquePorCod = {},
  estoqueCongelado = false,
  geradoEm,
  snapshotId = null,
  previsaoConfiavelPorId = {},
}: Props) {
  const { hasPermission } = useAuth();
  const podeAjustarPrevisao =
    editavel &&
    (hasPermission(PERMISSOES.PCP_AJUSTAR_PREVISAO) ||
      hasPermission(PERMISSOES.PCP_TOTAL) ||
      hasPermission(PERMISSOES.PEDIDOS_EDITAR));

  const [filtroPd, setFiltroPd] = useState('');
  const [filtroRequisicao, setFiltroRequisicao] = useState('');
  const [filtroConfiavel, setFiltroConfiavel] = useState('');
  const [somentePrev, setSomentePrev] = useState(false);
  const [iconesVisiveis, setIconesVisiveis] = useState<Record<IconeCalendario, boolean>>(
    ICONES_CALENDARIO_INICIAIS
  );
  const alternarIcone = useCallback((icone: IconeCalendario) => {
    setIconesVisiveis((atual) => ({ ...atual, [icone]: !atual[icone] }));
  }, []);

  const qtdePorRow = useMemo(() => {
    const porIndex = montarQtdeLiquidaDoSnapshot(linhas, estoquePorCod);
    const map = new Map<Record<string, unknown>, number>();
    linhas.forEach((row, i) => {
      map.set(row, porIndex.get(i) ?? 0);
    });
    return map;
  }, [linhas, estoquePorCod]);

  const getQtdeLinha = useCallback(
    (row: Record<string, unknown>) => qtdePorRow.get(row) ?? 0,
    [qtdePorRow]
  );

  const opcoesPd = useMemo(() => {
    const set = new Set<string>();
    for (const row of linhas) {
      const pd = pdDaLinha(row);
      if (pd) set.add(pd);
    }
    return [...set].sort(comparePedidoAsc);
  }, [linhas]);

  const opcoesRequisicao = useMemo(() => {
    const set = new Set<string>();
    for (const row of linhas) {
      const req = requisicaoDaLinha(row);
      if (req) set.add(req);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [linhas]);

  const pdsSelecionados = useMemo(
    () =>
      filtroPd
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [filtroPd]
  );

  const requisicoesSelecionadas = useMemo(
    () =>
      filtroRequisicao
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [filtroRequisicao]
  );

  const confiavelSelecionados = useMemo(
    () =>
      filtroConfiavel
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [filtroConfiavel]
  );

  const temFiltroAtivo = useMemo(() => {
    const pdParcial =
      pdsSelecionados.length > 0 &&
      (opcoesPd.length === 0 || pdsSelecionados.length < opcoesPd.length);
    const requisicaoParcial =
      requisicoesSelecionadas.length > 0 &&
      (opcoesRequisicao.length === 0 || requisicoesSelecionadas.length < opcoesRequisicao.length);
    const confiavelParcial =
      confiavelSelecionados.length > 0 && confiavelSelecionados.length < 3;
    return pdParcial || requisicaoParcial || confiavelParcial || somentePrev;
  }, [
    pdsSelecionados,
    opcoesPd.length,
    requisicoesSelecionadas,
    opcoesRequisicao.length,
    confiavelSelecionados,
    somentePrev,
  ]);

  const statusPorIdPedido = useMemo(
    () => mapaStatusConfiavelPorId(linhas, previsaoConfiavelPorId),
    [linhas, previsaoConfiavelPorId]
  );

  const linhasFiltradas = useMemo(() => {
    let rows = linhas;
    if (pdsSelecionados.length > 0) {
      rows = rows.filter((row) => pdPassaFiltro(pdDaLinha(row), pdsSelecionados));
    }
    if (requisicoesSelecionadas.length > 0) {
      rows = rows.filter((row) =>
        requisicaoPassaFiltro(requisicaoDaLinha(row), requisicoesSelecionadas)
      );
    }
    if (confiavelSelecionados.length > 0) {
      rows = rows.filter((row) =>
        linhaPassaFiltroConfiavel(statusConfiavelDaLinha(row, previsaoConfiavelPorId), confiavelSelecionados)
      );
    }
    return rows;
  }, [
    linhas,
    pdsSelecionados,
    requisicoesSelecionadas,
    confiavelSelecionados,
    previsaoConfiavelPorId,
  ]);

  const maxProducaoNormais = useMemo(
    () => maxDataProducaoCarradasNormais(linhas, sim, baseline),
    [linhas, sim, baseline]
  );
  const dataInserirRomaneio = useMemo(
    () => dataProducaoInserirRomaneioApartirDe(maxProducaoNormais),
    [maxProducaoNormais]
  );
  const dataEmFormacao = useMemo(
    () => dataProducaoCarradaEmFormacaoApartirDe(maxProducaoNormais),
    [maxProducaoNormais]
  );

  /** Quando ativo, só entra no calendário o que cai em ⚠️ (posição pela previsão). */
  const linhasCalendario = useMemo(() => {
    if (!somentePrev) return linhasFiltradas;
    return linhasFiltradas.filter((row) => {
      const { origem } = resolverDataCalendarioLinha(
        row,
        sim,
        baseline,
        dataInserirRomaneio,
        dataEmFormacao
      );
      return origem === 'previsao';
    });
  }, [linhasFiltradas, somentePrev, sim, baseline, dataInserirRomaneio, dataEmFormacao]);

  const dados = useMemo(
    () =>
      computarCalendarioProducao(linhasCalendario, sim, baseline, (row) => getQtdeLinha(row), {
        dataInserirRomaneio,
        dataEmFormacao,
      }),
    [linhasCalendario, sim, baseline, getQtdeLinha, dataInserirRomaneio, dataEmFormacao]
  );
  const [drill, setDrill] = useState<Drill>({ nivel: 'pivot' });

  useEffect(() => {
    setDrill({ nivel: 'pivot' });
  }, [filtroPd, filtroRequisicao, filtroConfiavel, somentePrev]);
  const [pedidoModal, setPedidoModal] = useState<{
    linha: TooltipDetalheRow;
    itens: TooltipDetalheRow[];
    setorDestaque: string;
    selecaoInicial?: string[];
  } | null>(null);
  /**
   * Split: modal do PD no topo + pivô do calendário abaixo (ambos navegáveis).
   * Guarda o drill anterior para restaurar ao ocultar.
   */
  const [splitComPedido, setSplitComPedido] = useState(false);
  const drillAntesSplitRef = useRef<Drill | null>(null);
  const [vistaCalendario, setVistaCalendario] = useState<'producao' | 'materiais'>('producao');

  const encerrarSplitComPedido = useCallback(() => {
    setSplitComPedido(false);
    const previo = drillAntesSplitRef.current;
    drillAntesSplitRef.current = null;
    if (previo) setDrill(previo);
  }, []);

  const toggleSplitComPedido = useCallback(() => {
    if (splitComPedido) {
      encerrarSplitComPedido();
      return;
    }
    drillAntesSplitRef.current = drill.nivel === 'pivot' ? null : drill;
    setDrill({ nivel: 'pivot' });
    setVistaCalendario('producao');
    setSplitComPedido(true);
  }, [splitComPedido, drill, encerrarSplitComPedido]);

  /** PD a reabrir no Heatmap após Cancelar/ESC do ajuste (preserva seleção). */
  const pedidoModalRefreshRef = useRef<{
    pd: string;
    setorDestaque: string;
    selecaoKeys?: string[];
  } | null>(null);
  /**
   * Patches de sim aplicados no mesmo tick do save (antes do setSim do pai propagar).
   * Usado para reabrir o Heatmap com datas já atualizadas.
   */
  const simPatchRef = useRef<Map<string, SimEntry>>(new Map());
  const [pedidoAjustePrevisao, setPedidoAjustePrevisao] = useState<PedidoAjusteState | null>(null);
  /** Painel A alocar expandido (default aberto). */
  const [painelAAlocarAberto, setPainelAAlocarAberto] = useState(true);
  const [confirmReplicacaoRm, setConfirmReplicacaoRm] = useState<{
    pd: string;
    setorDestaque: string;
    selecaoKeys: string[];
    marcados: number;
    escopo: EscopoReplicacaoRm;
  } | null>(null);
  const [setorDetalhe, setSetorDetalhe] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dispMateriais, setDispMateriais] = useState<DisponibilidadeMateriaisSintetica | null>(null);
  const [dispCarregando, setDispCarregando] = useState(false);
  const [dispErro, setDispErro] = useState<string | null>(null);
  const [materiaisDiaIso, setMateriaisDiaIso] = useState<string | null>(null);
  const [horizonteItem, setHorizonteItem] = useState<{
    codigo: string;
    idProduto: number | null;
    descricao: string;
  } | null>(null);
  const materiaisDiaCacheRef = useRef(new Map<string, MaterialDiaCalendario[]>());
  const horizonteCacheRef = useRef(
    new Map<
      string,
      {
        idProduto: number;
        codigo: string;
        descricao: string;
        saldoInicial: number;
        dias: import('../../api/sequenciamentoCarradas').HorizonteDiaCalendario[];
        origens: import('../../api/sequenciamentoCarradas').OrigemConsumoCalendario[];
      }
    >()
  );

  const demandaMateriais = useMemo(
    () => montarDemandaMateriaisDoCalendario(dados.detalhes),
    [dados.detalhes]
  );
  const demandaMateriaisKey = useMemo(
    () =>
      JSON.stringify(
        demandaMateriais.map((d) => [
          d.codigoPa,
          d.dataIso,
          d.qtde,
          d.pd ?? '',
          d.setor ?? '',
          d.carrada ?? '',
        ])
      ),
    [demandaMateriais]
  );

  // Debounce ao filtrar pedido: evita 2 consultas Nomus em paralelo (ECONNRESET).
  const [demandaKeyConsulta, setDemandaKeyConsulta] = useState(demandaMateriaisKey);
  const demandaRef = useRef(demandaMateriais);
  demandaRef.current = demandaMateriais;
  useEffect(() => {
    const t = window.setTimeout(() => setDemandaKeyConsulta(demandaMateriaisKey), 280);
    return () => window.clearTimeout(t);
  }, [demandaMateriaisKey]);

  useEffect(() => {
    materiaisDiaCacheRef.current.clear();
    horizonteCacheRef.current.clear();
    setDispErro(null);
    const demanda = demandaRef.current;
    if (demanda.length === 0) {
      setDispMateriais(null);
      setDispCarregando(false);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setDispMateriais(null);
    setDispCarregando(true);
    void consultarDisponibilidadeMateriaisSintetica(demanda, { signal: ac.signal, snapshotId })
      .then((r) => {
        if (cancelled || ac.signal.aborted) return;
        setDispCarregando(false);
        if (r.error) {
          setDispErro(r.error);
          setDispMateriais(null);
          return;
        }
        setDispMateriais(r.data ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled || ac.signal.aborted) return;
        setDispCarregando(false);
        const msg = err instanceof Error ? err.message : String(err ?? '');
        if (/abort|AbortError/i.test(msg)) return;
        setDispErro(msg || 'Falha ao consultar disponibilidade de materiais.');
        setDispMateriais(null);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [demandaKeyConsulta, snapshotId]);

  const statusPorDataMap = useMemo(() => {
    const m = new Map<string, StatusPorDataMateriais>();
    for (const s of dispMateriais?.statusPorData ?? []) m.set(s.data, s);
    return m;
  }, [dispMateriais]);

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

  const criticosRows = dispMateriais?.materiaisCriticos ?? [];
  const CRITICOS_COLS = ['codigo', 'descricao', 'primeiraDataFalta', 'falta'] as const;
  const gradeCriticos = useGradeFiltrosExcel<MaterialCriticoCalendario>({
    rows: criticosRows,
    columnIds: [...CRITICOS_COLS],
    getCellText: (row, colId) => {
      if (colId === 'codigo') return row.codigo;
      if (colId === 'descricao') return row.descricao || '';
      if (colId === 'primeiraDataFalta') return formatDataCurta(row.primeiraDataFalta);
      if (colId === 'falta') {
        return row.faltaNaPrimeiraData.toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
      }
      return '';
    },
    valueForSort: (row, colId) => {
      if (colId === 'falta') return row.faltaNaPrimeiraData;
      if (colId === 'primeiraDataFalta') return row.primeiraDataFalta;
      if (colId === 'descricao') return row.descricao || '';
      return row.codigo;
    },
    defaultSortLevels: [{ id: 'descricao', dir: 'asc' }],
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

  /** Subtotais do rodapé: carradas/demais vs romaneio pendente (semCarrada). */
  const totaisDesdobrados = useMemo(() => {
    const setoresVisiveis = new Set(grade.rowsExibidas.map((r) => r.setor));
    const porData = new Map<string, { carradas: number; romaneio: number }>();
    let geralCarradas = 0;
    let geralRomaneio = 0;
    for (const d of dados.detalhes) {
      if (!setoresVisiveis.has(d.setor)) continue;
      const cur = porData.get(d.data) ?? { carradas: 0, romaneio: 0 };
      if (d.semCarrada) {
        cur.romaneio += d.qtde;
        geralRomaneio += d.qtde;
      } else {
        cur.carradas += d.qtde;
        geralCarradas += d.qtde;
      }
      porData.set(d.data, cur);
    }
    return { porData, geralCarradas, geralRomaneio, geral: geralCarradas + geralRomaneio };
  }, [grade.rowsExibidas, dados.detalhes]);

  const aAlocarResumo = useMemo(() => {
    const itens = dados.aAlocar;
    const qtde = itens.reduce((s, i) => s + i.qtde, 0);
    return { itens, qtde, n: itens.length };
  }, [dados.aAlocar]);

  const tipoFRows = useMemo(() => {
    if (drill.nivel !== 'tipof') return [];
    const map = new Map<
      string,
      {
        qtde: number;
        producaoPorPrevisao: boolean;
        semCarrada: boolean;
        statusSet: Set<StatusConfiavelCalendario>;
      }
    >();
    for (const d of dados.detalhes) {
      if (d.setor === drill.setor && d.data === drill.data) {
        const cur = map.get(d.tipoF) ?? {
          qtde: 0,
          producaoPorPrevisao: false,
          semCarrada: false,
          statusSet: new Set(),
        };
        cur.qtde += d.qtde;
        if (d.producaoPorPrevisao) cur.producaoPorPrevisao = true;
        if (d.semCarrada) cur.semCarrada = true;
        cur.statusSet.add(statusConfiavelDoDetalhe(d.idPedido, statusPorIdPedido));
        map.set(d.tipoF, cur);
      }
    }
    return [...map.entries()]
      .map(([tipoF, v]) => ({
        tipoF,
        qtde: v.qtde,
        producaoPorPrevisao: v.producaoPorPrevisao,
        semCarrada: v.semCarrada,
        statusConfiavel: agregarStatusConfiavel(v.statusSet),
      }))
      .sort((a, b) => b.qtde - a.qtde);
  }, [drill, dados.detalhes, statusPorIdPedido]);

  const carradaRows = useMemo(() => {
    if (drill.nivel !== 'carradas') return [];
    const map = new Map<
      string,
      {
        cod: string;
        carrada: string;
        qtde: number;
        producaoPorPrevisao: boolean;
        semCarrada: boolean;
        statusSet: Set<StatusConfiavelCalendario>;
      }
    >();
    for (const d of dados.detalhes) {
      if (d.setor === drill.setor && d.data === drill.data && d.tipoF === drill.tipoF) {
        const key = carradaKey(d.cod, d.carrada);
        const cur = map.get(key) ?? {
          cod: d.cod,
          carrada: d.carrada,
          qtde: 0,
          producaoPorPrevisao: false,
          semCarrada: false,
          statusSet: new Set(),
        };
        cur.qtde += d.qtde;
        if (d.producaoPorPrevisao) cur.producaoPorPrevisao = true;
        if (d.semCarrada) cur.semCarrada = true;
        cur.statusSet.add(statusConfiavelDoDetalhe(d.idPedido, statusPorIdPedido));
        map.set(key, cur);
      }
    }
    return [...map.entries()]
      .map(([key, v]) => ({
        key,
        cod: v.cod,
        carrada: v.carrada,
        qtde: v.qtde,
        producaoPorPrevisao: v.producaoPorPrevisao,
        semCarrada: v.semCarrada,
        statusConfiavel: agregarStatusConfiavel(v.statusSet),
      }))
      .sort((a, b) => b.qtde - a.qtde || a.cod.localeCompare(b.cod, 'pt-BR'));
  }, [drill, dados.detalhes, statusPorIdPedido]);

  const pedidoRows = useMemo(() => {
    if (drill.nivel !== 'pedidos') return [];
    const map = new Map<
      string,
      {
        qtde: number;
        producaoPorPrevisao: boolean;
        semCarrada: boolean;
        cliente: string;
        statusSet: Set<StatusConfiavelCalendario>;
      }
    >();
    for (const d of dados.detalhes) {
      if (
        d.setor === drill.setor &&
        d.data === drill.data &&
        d.tipoF === drill.tipoF &&
        carradaKey(d.cod, d.carrada) === drill.carradaKey
      ) {
        const cur = map.get(d.pd) ?? {
          qtde: 0,
          producaoPorPrevisao: false,
          semCarrada: false,
          cliente: '',
          statusSet: new Set(),
        };
        cur.qtde += d.qtde;
        if (d.producaoPorPrevisao) cur.producaoPorPrevisao = true;
        if (d.semCarrada) cur.semCarrada = true;
        cur.statusSet.add(statusConfiavelDoDetalhe(d.idPedido, statusPorIdPedido));
        if (!cur.cliente && d.cliente) cur.cliente = d.cliente;
        map.set(d.pd, cur);
      }
    }
    return [...map.entries()]
      .map(([pd, v]) => ({
        pd,
        qtde: v.qtde,
        producaoPorPrevisao: v.producaoPorPrevisao,
        semCarrada: v.semCarrada,
        cliente: v.cliente,
        statusConfiavel: agregarStatusConfiavel(v.statusSet),
      }))
      .sort((a, b) => comparePedidoAsc(a.pd, b.pd));
  }, [drill, dados.detalhes, statusPorIdPedido]);

  const celulasComPrevisao = useMemo(() => {
    const set = new Set<string>();
    for (const d of dados.detalhes) {
      if (d.producaoPorPrevisao) set.add(`${d.setor}\0${d.data}`);
    }
    return set;
  }, [dados.detalhes]);

  const celulasComSemCarrada = useMemo(() => {
    const set = new Set<string>();
    for (const d of dados.detalhes) {
      if (d.semCarrada) set.add(`${d.setor}\0${d.data}`);
    }
    return set;
  }, [dados.detalhes]);

  const celulasStatusConfiavel = useMemo(() => {
    const map = new Map<string, Set<StatusConfiavelCalendario>>();
    for (const d of dados.detalhes) {
      const key = `${d.setor}\0${d.data}`;
      let set = map.get(key);
      if (!set) {
        set = new Set();
        map.set(key, set);
      }
      set.add(statusConfiavelDoDetalhe(d.idPedido, statusPorIdPedido));
    }
    const out = new Map<string, StatusConfiavelCalendario[]>();
    for (const [key, set] of map) {
      out.set(key, agregarStatusConfiavel(set));
    }
    return out;
  }, [dados.detalhes, statusPorIdPedido]);

  const tipoFTotal = tipoFRows.reduce((s, r) => s + r.qtde, 0);
  const carradaTotal = carradaRows.reduce((s, r) => s + r.qtde, 0);
  const pedidoTotal = pedidoRows.reduce((s, r) => s + r.qtde, 0);

  const voltarNivel = useCallback(() => {
    const detalhes = dados.detalhes;
    setDrill((cur) => {
      if (cur.nivel === 'pedidos') {
        const keys = carradaKeysNoTipoF(detalhes, cur.setor, cur.data, cur.tipoF);
        if (keys.length <= 1) {
          // Carrada foi pulada na ida: se TipoF também era único, volta ao calendário.
          const tipos = tipoFsNaCelula(detalhes, cur.setor, cur.data);
          if (tipos.length <= 1) return { nivel: 'pivot' };
          return { nivel: 'tipof', setor: cur.setor, data: cur.data };
        }
        return { nivel: 'carradas', setor: cur.setor, data: cur.data, tipoF: cur.tipoF };
      }
      if (cur.nivel === 'carradas') {
        const tipos = tipoFsNaCelula(detalhes, cur.setor, cur.data);
        if (tipos.length <= 1) return { nivel: 'pivot' };
        return { nivel: 'tipof', setor: cur.setor, data: cur.data };
      }
      if (cur.nivel === 'tipof') return { nivel: 'pivot' };
      return cur;
    });
  }, [dados.detalhes]);

  const emDrill = drill.nivel !== 'pivot';

  const mergeSimComPatch = useCallback((base: Map<string, SimEntry>, patch: Map<string, SimEntry>) => {
    if (patch.size === 0) return base;
    const next = new Map(base);
    for (const [key, entry] of patch) {
      next.set(key, { ...next.get(key), ...entry });
    }
    return next;
  }, []);

  const acumularSimPatch = useCallback((key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => {
    const cur = { ...(simPatchRef.current.get(key) ?? {}) };
    cur[campo] = value;
    simPatchRef.current.set(key, cur);
  }, []);

  const montarPedidoModal = useCallback(
    (
      sourceLinhas: Record<string, unknown>[],
      pd: string,
      setorDestaque: string,
      selecaoInicial?: string[],
      simOverride?: Map<string, SimEntry>
    ) => {
      const simEfetivo = simOverride ?? mergeSimComPatch(sim, simPatchRef.current);
      const linhasPd = listarLinhasSnapshotPorPd(sourceLinhas, pd);
      const itens = listarTooltipDetalhePorPd(sourceLinhas, pd).map((item) => {
        const linha = encontrarLinhaSnapshotParaTooltipItem(linhasPd, item);
        return linha
          ? tooltipDetalheComDatasEfetivas(
              item,
              linha,
              simEfetivo,
              baseline,
              dataInserirRomaneio,
              dataEmFormacao
            )
          : item;
      });
      if (itens.length === 0) return;
      setPedidoModal({
        linha: itens[0]!,
        itens,
        setorDestaque,
        selecaoInicial: selecaoInicial?.length ? selecaoInicial : undefined,
      });
    },
    [sim, baseline, dataInserirRomaneio, dataEmFormacao, mergeSimComPatch]
  );

  const abrirModalPedido = useCallback(
    (pd: string) => {
      if (drill.nivel !== 'pedidos') return;
      montarPedidoModal(linhas, pd, drill.setor);
    },
    [drill, linhas, montarPedidoModal]
  );

  const reabrirPedidoModalAposAjuste = useCallback(
    (sourceLinhas: Record<string, unknown>[]) => {
      const refresh = pedidoModalRefreshRef.current;
      if (!refresh) return;
      // Pós-sucesso: não restaura checkboxes; usa patch local (sim do pai ainda pode estar stale).
      pedidoModalRefreshRef.current = null;
      const simEfetivo = mergeSimComPatch(sim, simPatchRef.current);
      montarPedidoModal(sourceLinhas, refresh.pd, refresh.setorDestaque, undefined, simEfetivo);
      simPatchRef.current = new Map();
    },
    [montarPedidoModal, mergeSimComPatch, sim]
  );

  /** Esc/Cancel no ajuste: volta ao modal de itens do pedido com a seleção anterior. */
  const voltarAoPedidoModal = useCallback(() => {
    setPedidoAjustePrevisao(null);
    simPatchRef.current = new Map();
    const refresh = pedidoModalRefreshRef.current;
    if (!refresh) return;
    montarPedidoModal(linhas, refresh.pd, refresh.setorDestaque, refresh.selecaoKeys);
  }, [linhas, montarPedidoModal]);

  const handleEscape = useCallback(() => {
    if (confirmReplicacaoRm) {
      setConfirmReplicacaoRm(null);
      return;
    }
    if (horizonteItem) {
      setHorizonteItem(null);
      return;
    }
    if (materiaisDiaIso) {
      setMateriaisDiaIso(null);
      return;
    }
    if (pedidoAjustePrevisao) {
      voltarAoPedidoModal();
      return;
    }
    if (pedidoModal) {
      pedidoModalRefreshRef.current = null;
      encerrarSplitComPedido();
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
    if (gradeCriticos.colunaFiltroAberta) {
      gradeCriticos.fecharFiltroExcel();
      return;
    }
    if (drill.nivel !== 'pivot') {
      voltarNivel();
      return;
    }
    onClose();
  }, [
    confirmReplicacaoRm,
    horizonteItem,
    materiaisDiaIso,
    pedidoAjustePrevisao,
    pedidoModal,
    setorDetalhe,
    grade,
    gradeCriticos,
    drill.nivel,
    voltarNivel,
    onClose,
    voltarAoPedidoModal,
    encerrarSplitComPedido,
  ]);

  const abrirAjustePrevisao = useCallback(
    (
      pd: string,
      itensAlvo: Pick<TooltipDetalheRow, 'codigo' | 'rota' | 'pedido'>[],
      linhasPreSelecionadas?: Record<string, unknown>[]
    ) => {
      const drillPedidos =
        drill.nivel === 'pedidos'
          ? drill
          : drillAntesSplitRef.current?.nivel === 'pedidos'
            ? drillAntesSplitRef.current
            : null;
      if (!drillPedidos) return;
      if (itensAlvo.length === 0 && !(linhasPreSelecionadas && linhasPreSelecionadas.length > 0)) return;

      let linhasSel: Record<string, unknown>[] = [];
      const seen = new Set<string>();

      if (linhasPreSelecionadas && linhasPreSelecionadas.length > 0) {
        for (const found of linhasPreSelecionadas) {
          const id = String(found['id_pedido'] ?? found['idPedido'] ?? linhaCarradaKey(found));
          if (seen.has(id)) continue;
          seen.add(id);
          linhasSel.push(found);
        }
      } else {
        const linhasPd = listarLinhasSnapshotPorPd(linhas, pd);
        for (const alvo of itensAlvo) {
          const found = encontrarLinhaSnapshotParaTooltipItem(linhasPd, alvo);
          if (!found) continue;
          const id = String(found['id_pedido'] ?? found['idPedido'] ?? linhaCarradaKey(found));
          if (seen.has(id)) continue;
          seen.add(id);
          linhasSel.push(found);
        }
      }

      const linha = linhasSel[0] ?? null;
      if (!linha) return;
      const pedido = linhaSnapshotParaPedido(linha);
      if (!pedido) return;

      const row = pedido as unknown as Record<string, unknown>;
      const rotaLinha = String(
        row['Observacoes'] ?? row['Observações'] ?? drillPedidos.tipoF ?? ''
      ).trim();
      if (
        !rotaPermiteAlterarDatasNoSequenciamentoCalendario(rotaLinha) &&
        !rotaPermiteAlterarDatasNoSequenciamentoCalendario(String(drillPedidos.tipoF ?? '')) &&
        !pedidoPermiteAlterarDatasNoSequenciamentoCalendario(row)
      ) {
        setToast(mensagemCanalDatasPedido(row));
        setTimeout(() => setToast(null), 4000);
        return;
      }

      const escopo: EscopoAjustePd = linhasSel.length > 1 ? 'todos_itens_pd' : 'item';
      const pedidosSel = linhasSel
        .map((r) => linhaSnapshotParaPedido(r))
        .filter((p): p is Pedido => p != null);
      const demaisItensPd =
        escopo === 'todos_itens_pd'
          ? pedidosSel.filter((p) => p.id_pedido !== pedido.id_pedido)
          : undefined;
      const carradaKeysTodosItens = [
        ...new Set(linhasSel.map((r) => linhaCarradaKey(r))),
      ];

      const key = linhaCarradaKey(linha);
      const datasExibidas = datasItemPedidoGerenciador(
        linha,
        sim,
        baseline,
        dataInserirRomaneio,
        dataEmFormacao
      );
      const dataProducaoAtual =
        datasExibidas.dataProducao || datasExibidas.dataCalendario || valorEfetivo(sim, baseline, key, 'dataProducao');
      setPedidoAjustePrevisao({
        pedido,
        pd,
        carradaKey: key,
        carradaKeysTodosItens,
        escopo,
        calendario: {
          dataProducaoAtual,
          // Produção e previsão são independentes na simulação; ⚠️ só some
          // quando dataProducao entra no Map sim (igual ao painel A alocar).
          producaoDerivadaPrevisao: false,
          escopoTodosItensPd: escopo === 'todos_itens_pd',
          demaisItensPd,
        },
      });
    },
    [linhas, sim, baseline, dataInserirRomaneio, dataEmFormacao, drill]
  );

  /** Abre ModalAjustePrevisao a partir do painel A alocar (sem exigir drill de pedidos). */
  const abrirAlocarDoPainel = useCallback(
    (item: CalendarioAAlocarItem) => {
      let linha: Record<string, unknown> | null = null;
      if (item.idPedido) {
        linha =
          linhasFiltradas.find(
            (r) => String(r['id_pedido'] ?? r['idChave'] ?? '').trim() === item.idPedido
          ) ?? null;
      }
      if (!linha && item.indexLinha >= 0 && item.indexLinha < linhasFiltradas.length) {
        linha = linhasFiltradas[item.indexLinha] ?? null;
      }
      if (!linha) {
        setToast('Não foi possível localizar o item no snapshot para alocar.');
        setTimeout(() => setToast(null), 4000);
        return;
      }
      const pedido = linhaSnapshotParaPedido(linha);
      if (!pedido) {
        setToast('Item sem id de pedido — não é possível alocar data.');
        setTimeout(() => setToast(null), 4000);
        return;
      }
      const row = pedido as unknown as Record<string, unknown>;
      if (!pedidoPermiteAlterarDatasNoSequenciamentoCalendario(row)) {
        const rotaLinha = String(row['Observacoes'] ?? row['Observações'] ?? '').trim();
        if (!rotaPermiteAlterarDatasNoSequenciamentoCalendario(rotaLinha)) {
          setToast(mensagemCanalDatasPedido(row));
          setTimeout(() => setToast(null), 4000);
          return;
        }
      }
      const key = linhaCarradaKey(linha);
      const datasExibidas = datasItemPedidoGerenciador(
        linha,
        sim,
        baseline,
        dataInserirRomaneio,
        dataEmFormacao
      );
      setPedidoAjustePrevisao({
        pedido,
        pd: item.pd,
        carradaKey: key,
        carradaKeysTodosItens: [key],
        escopo: 'item',
        calendario: {
          dataProducaoAtual: datasExibidas.dataProducao || '',
          producaoDerivadaPrevisao: false,
          escopoTodosItensPd: false,
        },
      });
    },
    [linhasFiltradas, sim, baseline, dataInserirRomaneio, dataEmFormacao]
  );

  const podeReprogramarNoCalendario = useCallback(
    (pd: string): boolean => {
      const drillPedidos =
        drill.nivel === 'pedidos'
          ? drill
          : drillAntesSplitRef.current?.nivel === 'pedidos'
            ? drillAntesSplitRef.current
            : null;
      if (!drillPedidos) return false;
      if (rotaPermiteAlterarDatasNoSequenciamentoCalendario(String(drillPedidos.tipoF ?? ''))) {
        return true;
      }
      const linhasPd = listarLinhasSnapshotPorPd(linhas, pd);
      const linha = linhasPd[0];
      if (!linha) return false;
      const pedido = linhaSnapshotParaPedido(linha);
      if (!pedido) return false;
      const row = pedido as unknown as Record<string, unknown>;
      if (pedidoPermiteAlterarDatasNoSequenciamentoCalendario(row)) return true;
      const rotaLinha = String(row['Observacoes'] ?? row['Observações'] ?? '').trim();
      return rotaPermiteAlterarDatasNoSequenciamentoCalendario(rotaLinha);
    },
    [drill, linhas]
  );

  const handleAjusteSuccess = useCallback(
    (_atualizado: Pedido, _meta?: AjustePrevisaoSuccessMeta) => {
      // Feedback "Gravado com sucesso" já foi exibido no ModalAjustePrevisao; só reabre o PD.
      reabrirPedidoModalAposAjuste(linhas);
    },
    [linhas, reabrirPedidoModalAposAjuste]
  );

  const keysEscopoAjuste = useCallback((): string[] => {
    if (!pedidoAjustePrevisao) return [];
    return pedidoAjustePrevisao.escopo === 'todos_itens_pd'
      ? pedidoAjustePrevisao.carradaKeysTodosItens
      : [pedidoAjustePrevisao.carradaKey];
  }, [pedidoAjustePrevisao]);

  const idsPedidoEscopoAjuste = useCallback((): string[] => {
    if (!pedidoAjustePrevisao) return [];
    const pedidosEscopo =
      pedidoAjustePrevisao.escopo === 'todos_itens_pd'
        ? [
            pedidoAjustePrevisao.pedido,
            ...(pedidoAjustePrevisao.calendario.demaisItensPd ?? []),
          ]
        : [pedidoAjustePrevisao.pedido];
    return pedidosEscopo
      .map((p) => String(p.id_pedido ?? '').trim())
      .filter(Boolean);
  }, [pedidoAjustePrevisao]);

  const pedidosEscopoAjuste = useCallback((): Pedido[] => {
    if (!pedidoAjustePrevisao) return [];
    return pedidoAjustePrevisao.escopo === 'todos_itens_pd'
      ? [
          pedidoAjustePrevisao.pedido,
          ...(pedidoAjustePrevisao.calendario.demaisItensPd ?? []),
        ]
      : [pedidoAjustePrevisao.pedido];
  }, [pedidoAjustePrevisao]);

  const escopoEhOrdemFinal = useCallback((): boolean => {
    return pedidosEscopoAjuste().some((p) => {
      const rota = String(
        (p as Record<string, unknown>)['Observacoes'] ??
          (p as Record<string, unknown>)['Observações'] ??
          ''
      ).trim();
      return rota && isCarradaOrdemFinal(rota);
    });
  }, [pedidosEscopoAjuste]);

  const handleSalvarDataProducao = useCallback(
    (novaData: string) => {
      if (!pedidoAjustePrevisao) return;
      // Ordem final (Requisição/Retirada/Entrega GT): só simItemKey — a chave
      // linhaCarradaKey é compartilhada por todo o TipoF e contaminaria os demais.
      if (escopoEhOrdemFinal()) {
        for (const id of idsPedidoEscopoAjuste()) {
          const key = simItemKey(id);
          acumularSimPatch(key, 'dataProducao', novaData);
          onEditarDataProducao?.(key, novaData);
        }
        return;
      }
      for (const key of keysEscopoAjuste()) {
        acumularSimPatch(key, 'dataProducao', novaData);
        onEditarDataProducao?.(key, novaData);
      }
    },
    [
      pedidoAjustePrevisao,
      onEditarDataProducao,
      keysEscopoAjuste,
      idsPedidoEscopoAjuste,
      escopoEhOrdemFinal,
      acumularSimPatch,
    ]
  );

  const handleSalvarPrevisaoSimulacao = useCallback(
    (novaData: string, meta: AjustePrevisaoSimulacaoMeta) => {
      if (!pedidoAjustePrevisao) return;
      const dataNorm = String(novaData ?? '').trim().slice(0, 10);
      if (dataNorm) {
        if (escopoEhOrdemFinal()) {
          for (const id of idsPedidoEscopoAjuste()) {
            const key = simItemKey(id);
            acumularSimPatch(key, 'dataEntrega', dataNorm);
            onEditarDataEntrega?.(key, dataNorm);
          }
        } else {
          for (const key of keysEscopoAjuste()) {
            acumularSimPatch(key, 'dataEntrega', dataNorm);
            onEditarDataEntrega?.(key, dataNorm);
          }
        }
      }

      const ids = idsPedidoEscopoAjuste();
      // Sempre registra motivo/obs/confiável no rascunho (mesmo sem mudança efetiva de data).
      if (ids.length > 0) {
        onRegistrarMotivoSimulacao?.(ids, meta);
      }
    },
    [
      pedidoAjustePrevisao,
      onEditarDataEntrega,
      onRegistrarMotivoSimulacao,
      keysEscopoAjuste,
      idsPedidoEscopoAjuste,
      escopoEhOrdemFinal,
      acumularSimPatch,
    ]
  );

  useRegisterModalEscape({ id: 'seq-carradas-calendario', onClose: handleEscape, zIndex: 130 });

  /** Com modal do PD aberto (sem split), bloqueia drill. No split ambos ficam navegáveis. */
  const interacaoCalendarioBloqueada = !!(
    (pedidoModal && !splitComPedido) ||
    pedidoAjustePrevisao ||
    confirmReplicacaoRm
  );

  const runSeInterativo = (fn: () => void) => {
    if (interacaoCalendarioBloqueada) return;
    fn();
  };

  const janelaCalendario = useModalFlutuante({
    enabled: true,
    open: true,
    defaultSize: {
      w: typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.82) : 1100,
      h: typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.57) : 560,
    },
    minSize: { w: 560, h: 280 },
    resetKey: 'calendario-producao',
  });

  useEffect(() => {
    // rAF: aplica depois do layout do modal do PD, evitando “nascer” cortado.
    const id = window.requestAnimationFrame(() => {
      if (splitComPedido) janelaCalendario.aplicarBaseSplit();
      else janelaCalendario.aplicarCentroPadrao();
    });
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao toggle split
  }, [splitComPedido]);

  const renderTh = (colId: string) => {
    const isSetor = colId === COL_SETOR;
    const isTotal = colId === COL_TOTAL;
    const col = colunas.find((c) => colunaCalendarioId(c) === colId);
    const weekend = col?.tipo === 'data' && isFimDeSemana(col.iso);
    const ocioso = col?.tipo === 'ocioso';
    const label = isSetor ? 'Setor de produção' : isTotal ? 'Total Geral' : col ? labelColuna(col) : colId;
    const st = col?.tipo === 'data' ? statusPorDataMap.get(col.iso) : undefined;
    const titleBase = isSetor || isTotal ? label : col ? tituloColuna(col) : label;
    const title =
      col?.tipo === 'data' ? `${titleBase} · ${tituloStatusMateriais(st)}` : titleBase;
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
          {col?.tipo === 'data' && (
            <SemaforoMateriais
              status={st?.status}
              title={tituloStatusMateriais(st)}
              onClick={() => runSeInterativo(() => setMateriaisDiaIso(toISODate(col.iso) || col.iso))}
            />
          )}
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
    const temSemCarrada = celulasComSemCarrada.has(`${setor}\0${col.iso}`);
    const statusConfiavel = celulasStatusConfiavel.get(`${setor}\0${col.iso}`) ?? [];
    const statusConfiavelVisivel = filtrarStatusConfiavelVisivel(statusConfiavel, iconesVisiveis);
    const tituloBase = 'Ver detalhamento por TipoF';
    const tituloParts = [tituloBase];
    if (temPrevisaoFallback) {
      tituloParts.push('(contém itens posicionados pela previsão atual — ⚠️)');
    }
    if (temSemCarrada) {
      tituloParts.push('(contém Inserir em Romaneio ≥ corte sem carrada formada)');
    }
    if (statusConfiavel.includes('sim')) tituloParts.push('(contém Confiável)');
    if (statusConfiavel.includes('nao')) tituloParts.push('(contém Não confiável)');
    if (statusConfiavel.includes('branco')) tituloParts.push('(contém Em branco)');
    return (
      <td key={colId} className={`${TD} text-right ${weekend ? 'px-1' : ''} ${weekend ? WEEKEND_TD : ''}`}>
        {v > 0 ? (
          <GradeCelulaModalBtn
            onClick={() =>
              runSeInterativo(() => setDrill(drillAposCliqueQtde(dados.detalhes, setor, col.iso)))
            }
            title={
              interacaoCalendarioBloqueada
                ? 'Feche o painel do pedido para navegar no calendário'
                : tituloParts.join(' ')
            }
            align="right"
          >
            <span className="inline-flex flex-col items-end gap-0.5">
              <span className="inline-flex items-center gap-0.5">
                {formatQtdeInt(v)}
                {temPrevisaoFallback && iconesVisiveis.previsao ? <IndicadorDataPorPrevisao /> : null}
                <IndicadoresPrevisaoConfiavel statuses={statusConfiavelVisivel} />
              </span>
              {temSemCarrada ? <BadgeSemCarrada /> : null}
            </span>
          </GradeCelulaModalBtn>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>
    );
  };

  return (
    <>
    <div
      className="pointer-events-none fixed inset-0 z-[130] bg-black/50"
      role="presentation"
    >
      <div
        className={`pointer-events-auto relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800 ${
          janelaCalendario.dragging ? 'select-none' : ''
        }`}
        style={janelaCalendario.panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendario-producao-titulo"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={`flex shrink-0 cursor-grab items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 touch-none dark:border-slate-600 ${
            janelaCalendario.dragging ? 'cursor-grabbing' : ''
          }`}
          title="Arraste para mover o calendário"
          onPointerDown={janelaCalendario.onDragPointerDown}
          onPointerMove={janelaCalendario.onDragPointerMove}
          onPointerUp={janelaCalendario.onDragPointerEnd}
          onPointerCancel={janelaCalendario.onDragPointerEnd}
        >
          <h2 id="calendario-producao-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Calendário de produção
          </h2>
          <div className="flex items-center gap-2" data-no-drag>
            {emDrill && (
              <button
                type="button"
                onClick={handleEscape}
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

        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-400">
          <div className="grid min-w-0 max-w-xl grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span>Datas do calendário baseadas na data de produção</span>
              <button
                type="button"
                onClick={() => alternarIcone('previsao')}
                aria-pressed={iconesVisiveis.previsao}
                title={`${iconesVisiveis.previsao ? 'Ocultar' : 'Exibir'} ícone de previsão`}
                className={`inline-flex w-fit items-start gap-1 rounded px-1 text-left ${
                  iconesVisiveis.previsao
                    ? 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    : 'opacity-45 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <IndicadorDataPorPrevisao className="mt-px" />
                <span>= sem data de produção, usando previsão atual.</span>
              </button>
              <button
                type="button"
                onClick={() => alternarIcone('sim')}
                aria-pressed={iconesVisiveis.sim}
                title={`${iconesVisiveis.sim ? 'Ocultar' : 'Exibir'} ícone Confiável`}
                className={`inline-flex w-fit items-center gap-1 rounded px-1 text-left ${
                  iconesVisiveis.sim
                    ? 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    : 'opacity-45 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <IndicadorPrevisaoConfiavel status="sim" />
                <span>= Confiável</span>
              </button>
            </div>
            <div className="flex flex-col justify-end gap-0.5">
              <button
                type="button"
                onClick={() => alternarIcone('nao')}
                aria-pressed={iconesVisiveis.nao}
                title={`${iconesVisiveis.nao ? 'Ocultar' : 'Exibir'} ícone Não confiável`}
                className={`inline-flex w-fit items-center gap-1 rounded px-1 text-left ${
                  iconesVisiveis.nao
                    ? 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    : 'opacity-45 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <IndicadorPrevisaoConfiavel status="nao" />
                <span>= Não confiável</span>
              </button>
              <button
                type="button"
                onClick={() => alternarIcone('branco')}
                aria-pressed={iconesVisiveis.branco}
                title={`${iconesVisiveis.branco ? 'Ocultar' : 'Exibir'} ícone Em branco`}
                className={`inline-flex w-fit items-center gap-1 rounded px-1 text-left ${
                  iconesVisiveis.branco
                    ? 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    : 'opacity-45 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <IndicadorPrevisaoConfiavel status="branco" />
                <span>= Em branco</span>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setVistaCalendario('producao')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  vistaCalendario === 'producao'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                Produção
              </button>
              <button
                type="button"
                onClick={() => setVistaCalendario('materiais')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  vistaCalendario === 'materiais'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                Materiais críticos
                {(dispMateriais?.materiaisCriticos.length ?? 0) > 0
                  ? ` (${dispMateriais!.materiaisCriticos.length})`
                  : ''}
              </button>
            </div>
            <div className="min-w-[11rem] max-w-[16rem]">
              <MultiSelectWithSearch
                label="Pedido"
                placeholder="Todos"
                options={opcoesPd}
                value={filtroPd}
                onChange={setFiltroPd}
                labelClass={FILTRO_PD_LABEL_CLASS}
                inputClass={FILTRO_PD_INPUT_CLASS}
                minWidth="11rem"
                optionLabel="pedidos"
                dropdownZIndex={FILTRO_PD_DROPDOWN_Z}
                fillContainer
              />
            </div>
            <div className="min-w-[11rem] max-w-[14rem]">
              <MultiSelectWithSearch
                label="Requisição"
                placeholder="Todos"
                options={opcoesRequisicao}
                value={filtroRequisicao}
                onChange={setFiltroRequisicao}
                labelClass={FILTRO_PD_LABEL_CLASS}
                inputClass={FILTRO_PD_INPUT_CLASS}
                minWidth="11rem"
                optionLabel="opções"
                dropdownZIndex={FILTRO_PD_DROPDOWN_Z}
                fillContainer
              />
            </div>
            <div className="min-w-[11rem] max-w-[14rem]">
              <MultiSelectWithSearch
                label="Confiável"
                placeholder="Todos"
                options={['sim', 'nao', 'branco']}
                labelByValue={{
                  sim: 'Confiáveis',
                  nao: 'Não confiáveis',
                  branco: 'Em branco',
                }}
                value={filtroConfiavel}
                onChange={setFiltroConfiavel}
                labelClass={FILTRO_PD_LABEL_CLASS}
                inputClass={FILTRO_PD_INPUT_CLASS}
                minWidth="11rem"
                optionLabel="opções"
                dropdownZIndex={FILTRO_PD_DROPDOWN_Z}
                fillContainer
              />
            </div>
            <button
              type="button"
              onClick={() => setSomentePrev((ativo) => !ativo)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                somentePrev
                  ? 'bg-primary-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Exibir somente quantidades posicionadas pela previsão (células com ⚠️)"
            >
              Somente ⚠️
            </button>
            {temFiltroAtivo && (
              <button
                type="button"
                onClick={() => {
                  setFiltroPd('');
                  setFiltroRequisicao('');
                  setFiltroConfiavel('');
                  setSomentePrev(false);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title="Limpar filtros de pedido, requisição, confiável e somente ⚠️"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        <>
        {emDrill && (
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 px-4 py-2 text-xs dark:border-slate-600">
            <button
              type="button"
              onClick={() => runSeInterativo(() => setDrill({ nivel: 'pivot' }))}
              disabled={interacaoCalendarioBloqueada}
              className="rounded px-2 py-1 font-medium text-primary-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-300 dark:hover:bg-slate-700"
            >
              Calendário
            </button>
            <span className="text-slate-400">/</span>
            <button
              type="button"
              onClick={() =>
                runSeInterativo(() =>
                  setDrill({ nivel: 'tipof', setor: drill.setor, data: drill.data })
                )
              }
              disabled={interacaoCalendarioBloqueada}
              className={`rounded px-2 py-1 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${drill.nivel === 'tipof' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'text-primary-700 hover:bg-slate-100 dark:text-primary-300 dark:hover:bg-slate-700'}`}
            >
              {drill.setor} · {formatDataCurta(drill.data)}
            </button>
            {(drill.nivel === 'carradas' || drill.nivel === 'pedidos') && (
              <>
                <span className="text-slate-400">/</span>
                <button
                  type="button"
                  onClick={() =>
                    runSeInterativo(() =>
                      setDrill({
                        nivel: 'carradas',
                        setor: drill.setor,
                        data: drill.data,
                        tipoF: drill.tipoF,
                      })
                    )
                  }
                  disabled={interacaoCalendarioBloqueada}
                  className={`rounded px-2 py-1 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${drill.nivel === 'carradas' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'text-primary-700 hover:bg-slate-100 dark:text-primary-300 dark:hover:bg-slate-700'}`}
                >
                  TipoF: {drill.tipoF}
                </button>
              </>
            )}
            {drill.nivel === 'pedidos' && (
              <>
                <span className="text-slate-400">/</span>
                <span className="rounded bg-primary-100 px-2 py-1 font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">
                  Carrada
                </span>
              </>
            )}
          </div>
        )}

        {drill.nivel === 'pivot' && vistaCalendario === 'producao' && grade.temFiltrosOuOrdem && (
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

        {drill.nivel === 'pivot' && vistaCalendario === 'producao' && aAlocarResumo.n > 0 && (
          <div className="mx-4 mt-3 shrink-0 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/30">
            <button
              type="button"
              onClick={() => setPainelAAlocarAberto((v) => !v)}
              className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-100 px-3 py-2 text-left dark:border-amber-700/50 dark:bg-amber-900/40"
              aria-expanded={painelAAlocarAberto}
            >
              <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 shrink-0 transition-transform ${painelAAlocarAberto ? 'rotate-90' : ''}`}
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                    clipRule="evenodd"
                  />
                </svg>
                A alocar — Inserir em Romaneio (≥ corte)
              </span>
              <span className="rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-600 dark:bg-slate-800 dark:text-amber-200">
                {aAlocarResumo.n} item(ns) · qtde {formatQtdeInt(aAlocarResumo.qtde)}
              </span>
            </button>
            {painelAAlocarAberto && (
              <>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-amber-100 bg-orange-50/80 dark:border-amber-800/40 dark:bg-amber-950/40">
                        <th className="px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Pedido
                        </th>
                        <th className="px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Cliente
                        </th>
                        <th className="px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Cód
                        </th>
                        <th className="px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Descrição
                        </th>
                        <th className="px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Setor
                        </th>
                        <th className="px-2.5 py-1.5 text-right font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Qtde
                        </th>
                        <th className="px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Previsão ref.
                        </th>
                        <th className="px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Ação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {aAlocarResumo.itens.map((item) => (
                        <tr
                          key={`${item.idPedido || item.pd}-${item.codigoProduto}-${item.indexLinha}`}
                          className="border-b border-amber-100/80 last:border-0 dark:border-amber-900/40"
                        >
                          <td className="px-2.5 py-1.5 font-semibold text-primary-700 dark:text-primary-300">
                            {labelPedidoMapa(item.pd)}
                          </td>
                          <td
                            className="max-w-[180px] truncate px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
                            title={item.cliente || undefined}
                          >
                            {item.cliente || '—'}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 font-medium tabular-nums text-slate-800 dark:text-slate-100">
                            {item.codigoProduto || '—'}
                          </td>
                          <td
                            className="max-w-[220px] truncate px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
                            title={item.descricaoProduto || undefined}
                          >
                            {item.descricaoProduto || '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-200">{item.setor}</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                            {formatQtdeInt(item.qtde)}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300">
                            {item.previsaoRef ? formatDataCurta(item.previsaoRef) : '—'}
                            <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
                              só referência — não posiciona no pivô
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <button
                              type="button"
                              onClick={() => runSeInterativo(() => abrirAlocarDoPainel(item))}
                              disabled={interacaoCalendarioBloqueada}
                              className="rounded-md bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Alocar data…
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-amber-200 bg-amber-50/80 px-3 py-1.5 text-[11px] text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-200">
                  Demanda ainda sem ROTA / carrada formada. Não entra na carga das colunas de data nem na
                  demanda de materiais até você alocar uma data de produção (rascunho do sequenciamento).
                  Motivo/observação só são exigidos se você também alterar a previsão.
                </p>
              </>
            )}
          </div>
        )}

        <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto p-4">
          {drill.nivel === 'pivot' && vistaCalendario === 'materiais' && (
            <div className="space-y-3">
              {dispCarregando && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Consultando disponibilidade de materiais…
                </p>
              )}
              {dispErro && (
                <p className="text-sm text-red-600 dark:text-red-400">{dispErro}</p>
              )}
              {!dispCarregando && !dispErro && (dispMateriais?.materiaisCriticos.length ?? 0) === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {demandaMateriais.length === 0 ? (
                    <>
                      Sem demanda de produção no calendário para analisar materiais.
                    </>
                  ) : (dispMateriais?.qtdeMateriaisEscopo ?? 0) === 0 ? (
                    <>
                      Nenhum componente no escopo do calendário (almox secundário, lista válida, sem
                      Matéria Prima) na BOM dos produtos do calendário. O semáforo só cobre esses materiais.
                    </>
                  ) : (
                    <>
                      Nenhum material com falta no horizonte ({dispMateriais!.qtdeMateriaisEscopo}{' '}
                      material(is) de almox secundário cobertos por saldo e/ou PC).
                    </>
                  )}
                </p>
              )}
              {!dispCarregando && (dispMateriais?.materiaisCriticos.length ?? 0) > 0 && (
                <div className="space-y-2">
                  {gradeCriticos.temFiltrosOuOrdem && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={gradeCriticos.limparFiltrosGrade}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Limpar filtros/ordem
                      </button>
                    </div>
                  )}
                  <div ref={gradeCriticos.tableScrollRef} className="overflow-auto">
                    <table className="w-full max-w-4xl border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                          {(
                            [
                              ['codigo', 'Código', false],
                              ['descricao', 'Descrição', false],
                              ['primeiraDataFalta', '1ª data falta', false],
                              ['falta', 'Falta', true],
                            ] as const
                          ).map(([colId, label, numeric]) => (
                            <th
                              key={colId}
                              className={`${TH} ${numeric ? 'text-right' : 'text-left'}`}
                            >
                              <div
                                className={`flex items-center gap-1 ${numeric ? 'justify-end' : 'justify-between'}`}
                              >
                                <span>{label}</span>
                                <GradeFiltroCabecalhoBtn
                                  ativo={gradeCriticos.colunaComFiltroAtivo(colId)}
                                  onClick={(e) => gradeCriticos.abrirFiltroExcel(colId, e)}
                                />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gradeCriticos.rowsExibidas.map((m) => (
                          <tr key={m.codigo} className="border-b border-slate-100 dark:border-slate-700">
                            <td className={TD}>
                              <span className="inline-flex items-center gap-1">
                                <GradeCelulaModalBtn
                                  onClick={() =>
                                    setHorizonteItem({
                                      codigo: m.codigo,
                                      idProduto: m.idProduto,
                                      descricao: m.descricao,
                                    })
                                  }
                                  title="Ver horizonte do material"
                                  align="left"
                                >
                                  {m.codigo}
                                </GradeCelulaModalBtn>
                                <CopiarTextoBtn texto={m.codigo} title="Copiar código do material" />
                              </span>
                            </td>
                            <td className={`${TD} max-w-[16rem] truncate`} title={m.descricao}>
                              {m.descricao || '—'}
                            </td>
                            <td className={TD}>
                              <GradeCelulaModalBtn
                                onClick={() =>
                                  setMateriaisDiaIso(
                                    toISODate(m.primeiraDataFalta) || m.primeiraDataFalta
                                  )
                                }
                                title="Ver materiais deste dia"
                                align="left"
                              >
                                {formatDataCurta(m.primeiraDataFalta)}
                              </GradeCelulaModalBtn>
                            </td>
                            <td
                              className={`${TD} text-right tabular-nums text-red-700 dark:text-red-300`}
                            >
                              {m.faltaNaPrimeiraData.toLocaleString('pt-BR', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {gradeCriticos.colunaFiltroAberta && gradeCriticos.filtroAbertoRect && (
                    <GradeFiltroExcelPortal
                      colunaAberta={gradeCriticos.colunaFiltroAberta}
                      rect={gradeCriticos.filtroAbertoRect}
                      dropdownRef={gradeCriticos.filtroDropdownRef}
                      excelFilterDrafts={gradeCriticos.excelFilterDrafts}
                      setExcelFilterDrafts={gradeCriticos.setExcelFilterDrafts}
                      valoresUnicosPorColuna={gradeCriticos.valoresUnicosPorColuna}
                      onSortAsc={(colId) => {
                        gradeCriticos.setSortState({ key: colId, direction: 'asc' });
                        gradeCriticos.setSortLevels([]);
                        gradeCriticos.fecharFiltroExcel();
                      }}
                      onSortDesc={(colId) => {
                        gradeCriticos.setSortState({ key: colId, direction: 'desc' });
                        gradeCriticos.setSortLevels([]);
                        gradeCriticos.fecharFiltroExcel();
                      }}
                      onAplicar={gradeCriticos.aplicarFiltroExcel}
                      onCancelar={gradeCriticos.fecharFiltroExcel}
                      sortAscLabel={
                        gradeCriticos.colunaFiltroAberta === 'falta' ? 'Menor para Maior' : undefined
                      }
                      sortDescLabel={
                        gradeCriticos.colunaFiltroAberta === 'falta' ? 'Maior para Menor' : undefined
                      }
                      showNumericFilters={gradeCriticos.colunaFiltroAberta === 'falta'}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {drill.nivel === 'pivot' &&
            vistaCalendario === 'producao' &&
            (colunas.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {aAlocarResumo.n > 0
                  ? 'Nenhum item com data de produção no pivô. Use o painel A alocar acima para definir produção dos Inserir em Romaneio ≥ corte.'
                  : 'Nenhum item com data de produção ou previsão atual para montar o calendário.'}
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
                          onClick={() => runSeInterativo(() => setSetorDetalhe(setor))}
                          title={
                            interacaoCalendarioBloqueada
                              ? 'Feche o painel do pedido para navegar no calendário'
                              : 'Ver códigos e descrições do setor'
                          }
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
                      const desd = totaisDesdobrados.porData.get(col.iso) ?? {
                        carradas: 0,
                        romaneio: 0,
                      };
                      const total = desd.carradas + desd.romaneio;
                      return (
                        <td
                          key={colId}
                          className={`${TD} text-right tabular-nums ${isFimDeSemana(col.iso) ? `px-1 ${WEEKEND_TD}` : ''}`}
                        >
                          {totaisDesdobrados.geralRomaneio > 0 || desd.romaneio > 0 ? (
                            <div className="flex flex-col items-end gap-0.5 text-[11px] leading-tight">
                              <span className="font-semibold text-slate-600 dark:text-slate-300">
                                Carradas {formatQtdeInt(desd.carradas)}
                              </span>
                              <span className="font-semibold text-amber-800 dark:text-amber-300">
                                Romaneio pend. {formatQtdeInt(desd.romaneio)}
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                Total {formatQtdeInt(total)}
                              </span>
                            </div>
                          ) : (
                            formatQtdeInt(totais.porColId.get(colId) ?? 0)
                          )}
                        </td>
                      );
                    })}
                    <td className={`${TD} text-right tabular-nums`}>
                      {totaisDesdobrados.geralRomaneio > 0 ? (
                        <div className="flex flex-col items-end gap-0.5 text-[11px] leading-tight">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            Carradas {formatQtdeInt(totaisDesdobrados.geralCarradas)}
                          </span>
                          <span className="font-semibold text-amber-800 dark:text-amber-300">
                            Romaneio pend. {formatQtdeInt(totaisDesdobrados.geralRomaneio)}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Total {formatQtdeInt(totaisDesdobrados.geral)}
                          </span>
                        </div>
                      ) : (
                        formatQtdeInt(totais.geral)
                      )}
                    </td>
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
                          runSeInterativo(() =>
                            setDrill(
                              drillAposEscolherTipoF(
                                dados.detalhes,
                                drill.setor,
                                drill.data,
                                r.tipoF
                              )
                            )
                          )
                        }
                        title={
                          interacaoCalendarioBloqueada
                            ? 'Feche o painel do pedido para navegar no calendário'
                            : 'Ver carradas'
                        }
                        align="left"
                      >
                        {r.tipoF}
                      </GradeCelulaModalBtn>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      <span className="inline-flex items-center justify-end gap-0.5">
                        {formatQtdeInt(r.qtde)}
                        {r.producaoPorPrevisao && iconesVisiveis.previsao ? (
                          <IndicadorDataPorPrevisao />
                        ) : null}
                        <IndicadoresPrevisaoConfiavel
                          statuses={filtrarStatusConfiavelVisivel(r.statusConfiavel, iconesVisiveis)}
                        />
                        {r.semCarrada ? (
                          <span className="ml-0.5 inline-block align-middle">
                            <BadgeSemCarrada />
                          </span>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className={SUBTOTAL_ROW_CLASS}>
                  <td className={TD}>Total</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(tipoFTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {drill.nivel === 'carradas' && (
            <table className="w-full max-w-3xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={`${TH} text-left`}>Cód</th>
                  <th className={`${TH} text-left`}>Carrada</th>
                  <th className={`${TH} text-right`}>Qtde Pendente Real</th>
                </tr>
              </thead>
              <tbody>
                {carradaRows.map((r) => (
                  <tr key={r.key} className="border-b border-slate-100 dark:border-slate-700">
                    <td className={`${TD} tabular-nums`}>{r.cod}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-1.5">
                        <GradeCelulaModalBtn
                          onClick={() =>
                            runSeInterativo(() =>
                              setDrill({
                                nivel: 'pedidos',
                                setor: drill.setor,
                                data: drill.data,
                                tipoF: drill.tipoF,
                                carradaKey: r.key,
                              })
                            )
                          }
                          title={
                            interacaoCalendarioBloqueada
                              ? 'Feche o painel do pedido para navegar no calendário'
                              : 'Ver pedidos'
                          }
                          align="left"
                        >
                          {r.carrada}
                        </GradeCelulaModalBtn>
                        {r.producaoPorPrevisao && iconesVisiveis.previsao && <IndicadorDataPorPrevisao />}
                        <IndicadoresPrevisaoConfiavel
                          statuses={filtrarStatusConfiavelVisivel(r.statusConfiavel, iconesVisiveis)}
                        />
                        {r.semCarrada && <BadgeSemCarrada />}
                      </div>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(r.qtde)}</td>
                  </tr>
                ))}
                <tr className={SUBTOTAL_ROW_CLASS}>
                  <td className={TD} colSpan={2}>
                    Total
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(carradaTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {drill.nivel === 'pedidos' && (
            <table className="w-full max-w-4xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={`${TH} text-left`}>Pedido</th>
                  <th className={`${TH} text-left`}>Cliente</th>
                  <th className={`${TH} text-right`}>Qtde Pendente Real</th>
                </tr>
              </thead>
              <tbody>
                {pedidoRows.map((r) => (
                  <tr key={r.pd} className="border-b border-slate-100 dark:border-slate-700">
                    <td className={TD}>
                      <div className="flex items-center gap-1.5">
                        <GradeCelulaModalBtn
                          onClick={() => runSeInterativo(() => abrirModalPedido(r.pd))}
                          title={
                            interacaoCalendarioBloqueada
                              ? 'Feche o painel do pedido para navegar no calendário'
                              : 'Ver itens do pedido'
                          }
                          align="left"
                        >
                          {labelPedidoMapa(r.pd)}
                        </GradeCelulaModalBtn>
                        <CopiarTextoBtn
                          texto={numeroPedidoLimpo(r.pd)}
                          title="Copiar número do pedido"
                        />
                        {r.producaoPorPrevisao && iconesVisiveis.previsao && <IndicadorDataPorPrevisao />}
                        <IndicadoresPrevisaoConfiavel
                          statuses={filtrarStatusConfiavelVisivel(r.statusConfiavel, iconesVisiveis)}
                        />
                        {r.semCarrada && <BadgeSemCarrada />}
                      </div>
                    </td>
                    <td className={`${TD} max-w-[280px] truncate`} title={r.cliente || undefined}>
                      {r.cliente || '—'}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(r.qtde)}</td>
                  </tr>
                ))}
                <tr className={SUBTOTAL_ROW_CLASS}>
                  <td className={TD} colSpan={2}>
                    Total
                  </td>
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
        </>
        <button
          type="button"
          aria-label="Redimensionar calendário"
          title="Arraste para redimensionar"
          data-no-drag
          className="absolute bottom-0 right-0 z-20 h-5 w-5 cursor-se-resize touch-none rounded-br-xl border-l border-t border-slate-300/80 bg-slate-200/90 hover:bg-slate-300 dark:border-slate-500 dark:bg-slate-600/90 dark:hover:bg-slate-500"
          onPointerDown={janelaCalendario.onResizePointerDown}
          onPointerMove={janelaCalendario.onResizePointerMove}
          onPointerUp={janelaCalendario.onResizePointerEnd}
          onPointerCancel={janelaCalendario.onResizePointerEnd}
        >
          <span className="sr-only">Redimensionar</span>
          <svg
            className="pointer-events-none absolute bottom-0.5 right-0.5 h-3 w-3 text-slate-500 dark:text-slate-300"
            viewBox="0 0 12 12"
            aria-hidden
          >
            <path fill="currentColor" d="M12 12H8V10h2V8h2v4zM10 8H8V6h2V4h2v4zM6 6H4V4h2V2h2v4z" />
          </svg>
        </button>
      </div>
    </div>

      {pedidoModal && (
        <HeatmapPedidoItensModal
          open
          varianteLayout="flutuanteCalendario"
          linha={pedidoModal.linha}
          municipioLabel={pedidoModal.linha.municipio || '—'}
          itens={pedidoModal.itens}
          setorDestaque={pedidoModal.setorDestaque}
          selecaoInicial={pedidoModal.selecaoInicial}
          statusConfiavelPorIdPedido={statusPorIdPedido}
          visualizandoCalendario={splitComPedido}
          onToggleVisualizarCalendario={toggleSplitComPedido}
          onClose={() => {
            pedidoModalRefreshRef.current = null;
            encerrarSplitComPedido();
            setPedidoModal(null);
          }}
          podeReprogramar={
            podeAjustarPrevisao && podeReprogramarNoCalendario(pedidoModal.linha.pedido)
          }
          onReprogramar={(itensSel) => {
            const pd = pedidoModal.linha.pedido;
            const selecaoKeys = itensSel.map((r) => `${r.codigo}\0${r.rota}`);
            const escopoRm = montarEscopoReplicacaoMesmoRm(itensSel, linhas);
            if (escopoRm.precisaConfirmar) {
              setConfirmReplicacaoRm({
                pd,
                setorDestaque: pedidoModal.setorDestaque,
                selecaoKeys,
                marcados: itensSel.length,
                escopo: escopoRm,
              });
              return;
            }
            pedidoModalRefreshRef.current = {
              pd,
              setorDestaque: pedidoModal.setorDestaque,
              selecaoKeys,
            };
            // Abrir ajuste ANTES de limpar o split: drillAntesSplitRef ainda tem o nível pedidos.
            if (escopoRm.linhasSnapshot.length > 0) {
              abrirAjustePrevisao(pd, itensSel, escopoRm.linhasSnapshot);
            } else {
              abrirAjustePrevisao(pd, itensSel);
            }
            setSplitComPedido(false);
            drillAntesSplitRef.current = null;
            setPedidoModal(null);
          }}
        />
      )}

      {confirmReplicacaoRm &&
        createPortal(
          <div
            className="fixed inset-0 z-[14100] flex items-center justify-center bg-black/60 p-4"
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmReplicacaoRm(null);
            }}
          >
            <div
              className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
              role="dialog"
              aria-modal
              aria-labelledby="confirm-rm-titulo"
              onClick={(e) => e.stopPropagation()}
            >
              <h4
                id="confirm-rm-titulo"
                className="text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                Replicar datas na carrada (RM)
              </h4>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Você marcou {confirmReplicacaoRm.marcados} item(ns) de tipof carradas
                {confirmReplicacaoRm.escopo.rotulosRm.length > 0
                  ? ` (RM ${confirmReplicacaoRm.escopo.rotulosRm.join(', ')})`
                  : ''}
                . A alteração será aplicada a todos os {confirmReplicacaoRm.escopo.qtdItens} itens de{' '}
                {confirmReplicacaoRm.escopo.qtdPedidos} pedido(s) no mesmo código de romaneio, para que
                fiquem com as mesmas datas
                {confirmReplicacaoRm.escopo.extras > 0
                  ? ` — incluindo ${confirmReplicacaoRm.escopo.extras} item(ns) além do(s) marcado(s)`
                  : ''}
                .
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReplicacaoRm(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = confirmReplicacaoRm;
                    setConfirmReplicacaoRm(null);
                    pedidoModalRefreshRef.current = {
                      pd: c.pd,
                      setorDestaque: c.setorDestaque,
                      selecaoKeys: c.selecaoKeys,
                    };
                    // Abrir ajuste ANTES de limpar o split (mesmo motivo do onReprogramar).
                    abrirAjustePrevisao(c.pd, c.escopo.itens, c.escopo.linhasSnapshot);
                    setSplitComPedido(false);
                    drillAntesSplitRef.current = null;
                    setPedidoModal(null);
                  }}
                  className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                >
                  Continuar e reprogramar todos do RM
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {setorDetalhe && (
        <CalendarioSetorProdutosModal
          setor={setorDetalhe}
          linhas={linhasFiltradas}
          sim={sim}
          baseline={baseline}
          dataInserirRomaneio={dataInserirRomaneio}
          getQtdeLinha={getQtdeLinha}
          onClose={() => setSetorDetalhe(null)}
          snapshotId={snapshotId}
        />
      )}

      {pedidoAjustePrevisao && (
        <ModalAjustePrevisao
          pedido={pedidoAjustePrevisao.pedido}
          calendario={pedidoAjustePrevisao.calendario}
          varianteLayout="flutuanteCalendario"
          persistirNoGerenciador={false}
          onSalvarDataProducao={handleSalvarDataProducao}
          onSalvarPrevisaoSimulacao={handleSalvarPrevisaoSimulacao}
          onVoltar={voltarAoPedidoModal}
          onClose={() => setPedidoAjustePrevisao(null)}
          onSuccess={(atualizado, meta) => {
            handleAjusteSuccess(atualizado, meta);
          }}
          onError={(msg) => {
            setToast(msg);
            setTimeout(() => setToast(null), 5000);
          }}
        />
      )}

      {materiaisDiaIso && (
        <CalendarioMateriaisDiaModal
          open
          dataIso={materiaisDiaIso}
          demanda={demandaMateriais}
          onClose={() => setMateriaisDiaIso(null)}
          onAbrirItem={(codigo, idProduto, descricao) =>
            setHorizonteItem({ codigo, idProduto, descricao })
          }
          cacheRef={materiaisDiaCacheRef}
          snapshotId={snapshotId}
        />
      )}

      {horizonteItem && (
        <CalendarioMaterialHorizonteModal
          open
          codigo={horizonteItem.codigo}
          idProdutoHint={horizonteItem.idProduto}
          descricaoHint={horizonteItem.descricao}
          demanda={demandaMateriais}
          onClose={() => setHorizonteItem(null)}
          cacheRef={horizonteCacheRef}
          snapshotId={snapshotId}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-[160] rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-800 shadow-lg dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
          {toast}
        </div>
      )}
    </>
  );
}
