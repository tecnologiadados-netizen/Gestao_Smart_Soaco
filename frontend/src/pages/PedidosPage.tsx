import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { countFiltrosModalAtivos, type FiltrosPedidosState } from '../components/FiltroPedidos';
import ModalMaisFiltrosPedidos from '../components/ModalMaisFiltrosPedidos';
import PedidosAjudaModal from './pedidos/PedidosAjudaModal';
import TabelaPedidos, { SORT_LEVELS_DEFAULT } from '../components/TabelaPedidos';
import ModalClassificarPedidos from '../components/ModalClassificarPedidos';
import FiltroDatasPopover from '../components/FiltroDatasPopover';
import ModalAjustePrevisao, { type AjustePrevisaoSuccessMeta } from '../components/ModalAjustePrevisao';
import ModalReprogramacaoLote from '../components/ModalReprogramacaoLote';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../config/permissoes';
import {
  listarPedidos,
  listarPedidosExport,
  ajustarPrevisao,
  ajustarPrevisaoLote,
  checkPedidosEmSycro,
  type FiltrosPedidos,
  type Pedido,
} from '../api/pedidos';
import { listarMotivosSugestao } from '../api/motivosSugestao';
import { downloadPedidosXlsx, downloadPedidosGradeXlsx, parsePedidosXlsxForImport, type LinhaImportacao } from '../utils/exportImportPedidos';
import ModalImportacao, { type ResultadoImportacao } from '../components/ModalImportacao';
import {
  bloqueioImportacaoCarrada,
  bloqueioImportacaoDataAnteriorHoje,
  bloqueioImportacaoPrevisaoConfiavel,
  bloqueioImportacaoSycro,
  bloqueioImportacaoValidacao,
  type ImportacaoBloqueioDetalhe,
} from '../utils/mensagensImportacaoPedidos';
import { loadFiltrosPedidos, saveFiltrosPedidos } from '../utils/persistFiltros';
import {
  analisarInconsistenciaQtdePendenteReal,
  resumoTooltipInconsistencia,
  type GrupoInconsistenciaQtdePendente,
} from '../utils/qtdePendenteInconsistencia';

const PAGE_SIZE = 100;
/** Limite para varrer todos os registros do filtro atual e detectar inconsistência (evita requisição gigante). */
const MAX_INCOHERENCE_PEDIDOS = 3000;

function buildFiltrosPedidosApi(
  f: FiltrosPedidosState,
  sortLevelsArg: { id: string; dir: 'asc' | 'desc' }[]
): Omit<FiltrosPedidos, 'page' | 'limit'> {
  return {
    cliente: f.cliente || undefined,
    observacoes: f.observacoes || undefined,
    pd: f.pd || undefined,
    cod: f.cod || undefined,
    data_emissao_ini: f.data_emissao_ini || undefined,
    data_emissao_fim: f.data_emissao_fim || undefined,
    data_entrega_ini: f.data_entrega_ini || undefined,
    data_entrega_fim: f.data_entrega_fim || undefined,
    data_previsao_anterior_ini: f.data_previsao_anterior_ini || undefined,
    data_previsao_anterior_fim: f.data_previsao_anterior_fim || undefined,
    data_ini: f.data_previsao_ini || undefined,
    data_fim: f.data_previsao_fim || undefined,
    atrasados: f.atrasados || undefined,
    grupo_produto: f.grupo_produto || undefined,
    setor_producao: f.setor_producao || undefined,
    uf: f.uf || undefined,
    municipio_entrega: f.municipio_entrega || undefined,
    motivo: f.motivo || undefined,
    vendedor: f.vendedor || undefined,
    tipo_f: f.tipo_f || undefined,
    status: f.status || undefined,
    metodo: f.metodo || undefined,
    sort_levels: Array.isArray(sortLevelsArg) && sortLevelsArg.length > 0 ? sortLevelsArg : undefined,
  };
}

function buildListarPedidosQuery(
  pagina: number,
  pageLimit: number,
  f: FiltrosPedidosState,
  sortLevelsArg: { id: string; dir: 'asc' | 'desc' }[]
) {
  return {
    ...buildFiltrosPedidosApi(f, sortLevelsArg),
    page: pagina,
    limit: pageLimit,
  };
}

const filtrosIniciais: FiltrosPedidosState = {
  cliente: '',
  observacoes: '',
  pd: '',
  cod: '',
  data_emissao_ini: '',
  data_emissao_fim: '',
  data_entrega_ini: '',
  data_entrega_fim: '',
  data_previsao_anterior_ini: '',
  data_previsao_anterior_fim: '',
  data_previsao_ini: '',
  data_previsao_fim: '',
  atrasados: false,
  grupo_produto: '',
  setor_producao: '',
  uf: '',
  municipio_entrega: '',
  motivo: '',
  vendedor: '',
  tipo_f: '',
  status: '',
  metodo: '',
};

export default function PedidosPage() {
  const { hasPermission, login } = useAuth();
  const podeExportarXlsx = hasPermission(PERMISSOES.PCP_EXPORTAR_XLSX) || hasPermission(PERMISSOES.PCP_TOTAL) || hasPermission(PERMISSOES.PEDIDOS_EDITAR);
  const podeExportarGrade = hasPermission(PERMISSOES.PCP_EXPORTAR_GRADE) || hasPermission(PERMISSOES.PCP_TOTAL) || hasPermission(PERMISSOES.PEDIDOS_EDITAR);
  const podeImportarXlsx = hasPermission(PERMISSOES.PCP_IMPORTAR_XLSX) || hasPermission(PERMISSOES.PCP_TOTAL) || hasPermission(PERMISSOES.PEDIDOS_EDITAR);
  const podeAjustarPrevisao = hasPermission(PERMISSOES.PCP_AJUSTAR_PREVISAO) || hasPermission(PERMISSOES.PCP_TOTAL) || hasPermission(PERMISSOES.PEDIDOS_EDITAR);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosPedidosState>(() => loadFiltrosPedidos(filtrosIniciais));
  const [modalPedido, setModalPedido] = useState<Pedido | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportGradeLoading, setExportGradeLoading] = useState(false);
  /** Linhas visíveis na grade (ref evita re-render em loop ao sincronizar a tabela). */
  const pedidosGradeExportRef = useRef<Pedido[]>([]);
  const syncPedidosGradeExport = useCallback((rows: Pedido[]) => {
    pedidosGradeExportRef.current = rows;
  }, []);
  const [importLoading, setImportLoading] = useState(false);
  const inputImportRef = useRef<HTMLInputElement>(null);
  const [modalImportOpen, setModalImportOpen] = useState(false);
  const [importProgresso, setImportProgresso] = useState(0);
  const [importStatus, setImportStatus] = useState<'importando' | 'sucesso' | 'erro'>('importando');
  const [importResultado, setImportResultado] = useState<ResultadoImportacao | null>(null);
  const [importMensagemErro, setImportMensagemErro] = useState<string | undefined>(undefined);
  const [importBloqueio, setImportBloqueio] = useState<ImportacaoBloqueioDetalhe | null>(null);
  const [erroConexaoErp, setErroConexaoErp] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalLoteOpen, setModalLoteOpen] = useState(false);
  const [modalClassificarOpen, setModalClassificarOpen] = useState(false);
  const [sortLevelsPersonalizado, setSortLevelsPersonalizado] = useState<{ id: string; dir: 'asc' | 'desc' }[]>(() => [...SORT_LEVELS_DEFAULT]);
  const [modalMaisFiltrosOpen, setModalMaisFiltrosOpen] = useState(false);
  const [modalAjudaAberto, setModalAjudaAberto] = useState(false);
  const [totalExibidosGrade, setTotalExibidosGrade] = useState(0);
  const incoherenceFullRowsRef = useRef<Pedido[] | null>(null);
  const [incoherenceHasIssue, setIncoherenceHasIssue] = useState(false);
  const [incoherenceScanBusy, setIncoherenceScanBusy] = useState(false);
  const [incoherenceGrupos, setIncoherenceGrupos] = useState<GrupoInconsistenciaQtdePendente[]>([]);
  const [incoherenceViewRows, setIncoherenceViewRows] = useState<Pedido[] | null>(null);
  const [incoherenceClickBusy, setIncoherenceClickBusy] = useState(false);
  /** Container na barra superior onde a grade injeta "Limpar filtros da grade" / "Colunas ocultas". */
  const [gradeToolbarExtrasEl, setGradeToolbarExtrasEl] = useState<HTMLDivElement | null>(null);

  const totalParaPaginacao = incoherenceViewRows ? incoherenceViewRows.length : totalExibidosGrade;
  const totalPages = Math.max(1, Math.ceil(totalParaPaginacao / PAGE_SIZE));
  const filtrosModalAtivos = countFiltrosModalAtivos(filtros);

  const incoherenceTooltip = useMemo(() => {
    let t = resumoTooltipInconsistencia(incoherenceGrupos);
    if (total > MAX_INCOHERENCE_PEDIDOS) {
      t += `\n\nAtenção: o filtro atual retorna mais de ${MAX_INCOHERENCE_PEDIDOS} registros; o farol usa apenas os primeiros ${MAX_INCOHERENCE_PEDIDOS} para análise. Para verificação completa, restrinja o filtro (ex.: por PD).`;
    }
    return t;
  }, [incoherenceGrupos, total]);

  const handleIncoherenceIconClick = useCallback(async () => {
    if (incoherenceViewRows) {
      setIncoherenceViewRows(null);
      return;
    }
    let rows = incoherenceFullRowsRef.current;
    if (!rows || rows.length === 0) {
      if (pedidos.length > 0) {
        rows = pedidos;
      } else if (total <= 0) {
        return;
      } else {
        setIncoherenceClickBusy(true);
        try {
          const r = await listarPedidosExport(buildFiltrosPedidosApi(filtros, sortLevelsPersonalizado));
          rows = Array.isArray(r?.data) ? r.data : [];
        } catch {
          rows = [];
        } finally {
          setIncoherenceClickBusy(false);
        }
      }
    }
    const { linhasAfetadas } = analisarInconsistenciaQtdePendenteReal(rows ?? []);
    if (linhasAfetadas.length > 0) {
      setIncoherenceViewRows(linhasAfetadas);
    }
  }, [incoherenceViewRows, total, pedidos, filtros, sortLevelsPersonalizado]);

  const carregarPedidos = useCallback(
    async (pagina: number = 1, filtrosOverride?: FiltrosPedidosState, sortLevelsOverride?: { id: string; dir: 'asc' | 'desc' }[]) => {
      const f = filtrosOverride ?? filtros;
      const sortLevelsToUse = sortLevelsOverride ?? sortLevelsPersonalizado;
      setLoading(true);
      setIncoherenceViewRows(null);
      setIncoherenceScanBusy(true);
      try {
        const result = await listarPedidosExport(buildFiltrosPedidosApi(f, sortLevelsToUse));
        const allRows = Array.isArray(result?.data) ? result.data : [];
        const totalCount = typeof result?.total === 'number' ? result.total : allRows.length;
        setPedidos(allRows);
        setTotal(totalCount);
        setTotalExibidosGrade(totalCount);
        const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        setPage(Math.min(Math.max(1, pagina), maxPage));
        setErroConexaoErp(result?.erroConexao ?? null);

        let gruposScan: GrupoInconsistenciaQtdePendente[] = [];
        if (totalCount === 0) {
          incoherenceFullRowsRef.current = null;
          gruposScan = [];
        } else if (totalCount <= MAX_INCOHERENCE_PEDIDOS) {
          incoherenceFullRowsRef.current = allRows;
          gruposScan = analisarInconsistenciaQtdePendenteReal(allRows).grupos;
        } else {
          incoherenceFullRowsRef.current = null;
          gruposScan = analisarInconsistenciaQtdePendenteReal(allRows.slice(0, PAGE_SIZE)).grupos;
        }
        setIncoherenceGrupos(gruposScan);
        setIncoherenceHasIssue(gruposScan.length > 0);
      } catch {
        setPedidos([]);
        setTotal(0);
        setErroConexaoErp(null);
        incoherenceFullRowsRef.current = null;
        setIncoherenceGrupos([]);
        setIncoherenceHasIssue(false);
      } finally {
        setLoading(false);
        setIncoherenceScanBusy(false);
      }
    },
    [filtros, sortLevelsPersonalizado]
  );

  useEffect(() => {
    carregarPedidos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => carregarPedidos(1);
    window.addEventListener('sincronizado', handler);
    return () => window.removeEventListener('sincronizado', handler);
  }, [carregarPedidos]);

  const handleSortLevelsChange = useCallback(
    (levels: { id: string; dir: 'asc' | 'desc' }[]) => {
      setSortLevelsPersonalizado(levels);
      carregarPedidos(1, undefined, levels);
    },
    [carregarPedidos]
  );

  useEffect(() => {
    saveFiltrosPedidos(filtros);
  }, [filtros]);

  const aplicarFiltros = () => {
    setPage(1);
    carregarPedidos(1);
  };

  const limparFiltros = () => {
    const sortPadrao = [...SORT_LEVELS_DEFAULT];
    setFiltros(filtrosIniciais);
    setSortLevelsPersonalizado(sortPadrao);
    saveFiltrosPedidos(filtrosIniciais);
    carregarPedidos(1, filtrosIniciais, sortPadrao);
  };

  const mergePedidosAposAjuste = (prev: Pedido[], atualizado: Pedido, meta?: AjustePrevisaoSuccessMeta): Pedido[] => {
    const lista = meta?.atualizadosMesmaCarrada;
    if (lista && lista.length > 0) {
      const mapById = new Map(lista.map((p) => [String(p.id_pedido ?? '').trim(), p]));
      return prev.map((p) => {
        const id = String(p.id_pedido ?? '').trim();
        return mapById.get(id) ?? p;
      });
    }
    return prev.map((p) => (p.id_pedido === atualizado.id_pedido ? atualizado : p));
  };

  const handleAjusteSuccess = (atualizado: Pedido, meta?: AjustePrevisaoSuccessMeta) => {
    setPedidos((prev) => mergePedidosAposAjuste(prev, atualizado, meta));
    setIncoherenceViewRows((prev) => (prev && prev.length > 0 ? mergePedidosAposAjuste(prev, atualizado, meta) : prev));
    setToast(meta?.atualizadosMesmaCarrada?.length ? 'Previsão replicada na carrada e grade atualizada.' : 'Previsão atualizada com sucesso.');
    setTimeout(() => setToast(null), 3000);
  };

  const exportarXlsx = useCallback(async () => {
    setExportLoading(true);
    try {
      const [result, motivos] = await Promise.all([
        listarPedidosExport({
          cliente: filtros.cliente || undefined,
          observacoes: filtros.observacoes || undefined,
          pd: filtros.pd || undefined,
          cod: filtros.cod || undefined,
          data_emissao_ini: filtros.data_emissao_ini || undefined,
          data_emissao_fim: filtros.data_emissao_fim || undefined,
          data_entrega_ini: filtros.data_entrega_ini || undefined,
          data_entrega_fim: filtros.data_entrega_fim || undefined,
          data_previsao_anterior_ini: filtros.data_previsao_anterior_ini || undefined,
          data_previsao_anterior_fim: filtros.data_previsao_anterior_fim || undefined,
          data_ini: filtros.data_previsao_ini || undefined,
          data_fim: filtros.data_previsao_fim || undefined,
          atrasados: filtros.atrasados || undefined,
          grupo_produto: filtros.grupo_produto || undefined,
          setor_producao: filtros.setor_producao || undefined,
          uf: filtros.uf || undefined,
          municipio_entrega: filtros.municipio_entrega || undefined,
          motivo: filtros.motivo || undefined,
          vendedor: filtros.vendedor || undefined,
          tipo_f: filtros.tipo_f || undefined,
          status: filtros.status || undefined,
          metodo: filtros.metodo || undefined,
        }),
        listarMotivosSugestao().catch(() => []),
      ]);
      const data = Array.isArray(result?.data) ? result.data : [];
      const motivosDescricoes = Array.isArray(motivos) ? motivos.map((m) => m.descricao) : [];
      await downloadPedidosXlsx(data, `pedidos_${new Date().toISOString().slice(0, 10)}.xlsx`, motivosDescricoes);
      setToast(`Exportados ${data.length} pedidos.`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Erro ao exportar.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setExportLoading(false);
    }
  }, [filtros]);

  const exportarGrade = useCallback(async () => {
    setExportGradeLoading(true);
    try {
      const data = pedidosGradeExportRef.current;
      if (data.length === 0) {
        setToast('Nenhuma linha na grade para exportar. Ajuste os filtros ou carregue os pedidos.');
        setTimeout(() => setToast(null), 4000);
        return;
      }
      await downloadPedidosGradeXlsx(data, `pedidos_grade_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setToast(`Grade exportada: ${data.length} pedido(s) (conforme exibido na tela).`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Erro ao exportar grade.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setExportGradeLoading(false);
    }
  }, []);

  const executarImportacao = useCallback(
    async (linhas: LinhaImportacao[]) => {
      const dataValida = (s: string) => {
        const t = (s ?? '').trim();
        if (!t) return false;
        const d = new Date(t);
        return !Number.isNaN(d.getTime());
      };
      const comPrevisao = linhas.filter((l) => dataValida(l.nova_previsao));
      const total = comPrevisao.length;
      let ok = 0;
      const errosLista: string[] = [];
      const TAMANHO_LOTE = 1000;
      setImportStatus('importando');
      setImportProgresso(0);
      setImportResultado(null);
      setImportMensagemErro(undefined);
      for (let inicio = 0; inicio < comPrevisao.length; inicio += TAMANHO_LOTE) {
        const lote = comPrevisao.slice(inicio, inicio + TAMANHO_LOTE);
        const ajustes = lote.map((linha) => {
          const rotaNorm = (linha.rota ?? '').trim();
          return {
            id_pedido: linha.id_pedido,
            previsao_nova: linha.nova_previsao,
            motivo: linha.motivo,
            observacao: linha.observacao || undefined,
            previsao_atual: linha.previsao_atual || undefined,
            rota: rotaNorm || undefined,
            /** Com rota na planilha, grava override naquela rota para atualizar a Previsão atual da linha. */
            apply_rota: rotaNorm.length > 0 ? true : undefined,
            igual: linha.igual,
            previsao_confiavel: linha.previsao_confiavel !== false,
          };
        });
        const resultado = await ajustarPrevisaoLote(ajustes);
        ok += resultado.ok;
        resultado.erros.forEach((e) => errosLista.push(`Pedido ${e.id_pedido}: ${e.erro}`));
        const processados = Math.min(inicio + TAMANHO_LOTE, total);
        setImportProgresso(total > 0 ? Math.round((processados / total) * 100) : 100);
      }
      setImportStatus(errosLista.length > 0 ? 'erro' : 'sucesso');
      setImportResultado({
        ok,
        erros: errosLista.length,
        errosLista: errosLista.length > 0 ? errosLista : undefined,
      });
      carregarPedidos(1);
    },
    [carregarPedidos]
  );

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setImportLoading(true);
      setModalImportOpen(true);
      setImportStatus('importando');
      setImportProgresso(0);
      setImportResultado(null);
      setImportMensagemErro(undefined);
      setImportBloqueio(null);
      try {
        const linhas = await parsePedidosXlsxForImport(file);
        const idPedidosUnicos = [...new Set(linhas.map((l) => l.id_pedido).filter(Boolean))];
        if (idPedidosUnicos.length > 0) {
          try {
            const { pd_em_sycro } = await checkPedidosEmSycro(idPedidosUnicos);
            if (pd_em_sycro.length > 0) {
              setImportStatus('erro');
              setImportBloqueio(bloqueioImportacaoSycro(pd_em_sycro));
              setImportMensagemErro(undefined);
              setImportResultado(null);
              setImportLoading(false);
              return;
            }
          } catch {
            // Se a verificação falhar (ex.: rede), permitir seguir; o backend pode validar depois se necessário
          }
        }
        const dataValida = (s: string) => {
          const t = s.trim();
          if (!t) return false;
          const d = new Date(t);
          return !Number.isNaN(d.getTime());
        };
        const mesmaData = (a: string, b: string) => dataValida(a) && dataValida(b) && new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
        const linhasComIndex = linhas.map((l, i) => ({ l, linha: i + 2 }));

        // Regra: não pode importar com Nova previsão sem data (vazia ou inválida)
        const linhasPrevisaoAtualSemData = linhasComIndex.filter(({ l }) => !dataValida(l.nova_previsao));
        // Regra 1: aceitar apenas se TODAS as linhas tiverem Nova previsão diferente da Previsão atual
        const linhasComIgualVerdadeiro = linhasComIndex.filter(({ l }) => l.igual === true);
        const linhasComDataIgual = linhasComIndex.filter(
          ({ l }) => dataValida(l.nova_previsao) && dataValida(l.previsao_atual) && mesmaData(l.nova_previsao, l.previsao_atual)
        );
        // Regra 2: não aceitar importação com motivo vazio
        const linhasComMotivoVazio = linhasComIndex.filter(({ l }) => !String(l.motivo ?? '').trim());

        if (
          linhasPrevisaoAtualSemData.length > 0 ||
          linhasComIgualVerdadeiro.length > 0 ||
          linhasComDataIgual.length > 0 ||
          linhasComMotivoVazio.length > 0
        ) {
          setImportStatus('erro');
          const partes: string[] = [];
          if (linhasPrevisaoAtualSemData.length > 0) {
            partes.push(
              `Nova previsão sem data ou inválida (linhas: ${linhasPrevisaoAtualSemData.map((x) => x.linha).join(', ')})`
            );
          }
          if (linhasComIgualVerdadeiro.length > 0) {
            partes.push(
              `Coluna Igual? = Verdadeiro — a Nova previsão deve ser diferente da Previsão atual (linhas: ${linhasComIgualVerdadeiro.map((x) => x.linha).join(', ')})`
            );
          } else if (linhasComDataIgual.length > 0) {
            partes.push(
              `Nova previsão igual à Previsão atual (linhas: ${linhasComDataIgual.map((x) => x.linha).join(', ')})`
            );
          }
          if (linhasComMotivoVazio.length > 0) {
            partes.push(`Motivo vazio (linhas: ${linhasComMotivoVazio.map((x) => x.linha).join(', ')})`);
          }
          setImportBloqueio(bloqueioImportacaoValidacao(partes));
          setImportMensagemErro(undefined);
          setImportResultado(null);
          setImportLoading(false);
          return;
        }

        const isRotaExcluida = (rota: string) => {
          const r = (rota ?? '').toLowerCase();
          return (
            r.includes('grande teresina') ||
            r.includes('requisição') || r.includes('requisicao') ||
            r.includes('retirada') ||
            r.includes('inserir romaneio') || r.includes('inserir em romaneio')
          );
        };
        const porCarrada = new Map<string, Set<string>>();
        linhas.forEach((l, idx) => {
          if (!dataValida(l.nova_previsao)) return;
          const rota = (l.rota ?? '').trim();
          if (!rota || isRotaExcluida(rota)) return;
          const dataStr = new Date(l.nova_previsao).toISOString().slice(0, 10);
          const cur = porCarrada.get(rota);
          if (cur) cur.add(dataStr);
          else porCarrada.set(rota, new Set([dataStr]));
        });
        const carradasComDatasDivergentes = [...porCarrada.entries()].filter(([, datas]) => datas.size > 1);
        if (carradasComDatasDivergentes.length > 0) {
          setImportStatus('erro');
          setImportBloqueio(
            bloqueioImportacaoCarrada(carradasComDatasDivergentes.map(([rota]) => rota))
          );
          setImportMensagemErro(undefined);
          setImportResultado(null);
          setImportLoading(false);
          return;
        }

        // Bloqueio: Nova previsão diferente da Previsão atual e data anterior a hoje — não permitir importação (só inferior a hoje; igual a hoje é permitido)
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataPrevisaoAntesDeHoje = (dataStr: string) => {
          const raw = dataStr.trim();
          const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + 'T12:00:00') : new Date(raw);
          if (Number.isNaN(d.getTime())) return false;
          const diaPrevisao = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          return diaPrevisao.getTime() < hoje.getTime();
        };
        const linhasPrevisaoAnteriorHoje = linhasComIndex.filter(
          ({ l }) =>
            dataValida(l.nova_previsao) &&
            !mesmaData(l.nova_previsao, l.previsao_atual) &&
            dataPrevisaoAntesDeHoje(l.nova_previsao)
        );
        if (linhasPrevisaoAnteriorHoje.length > 0) {
          setImportStatus('erro');
          setImportBloqueio(
            bloqueioImportacaoDataAnteriorHoje(linhasPrevisaoAnteriorHoje.map((x) => x.linha))
          );
          setImportMensagemErro(undefined);
          setImportResultado(null);
          setImportLoading(false);
          return;
        }

        await executarImportacao(linhas);
      } catch (err) {
        setImportStatus('erro');
        const msg = err instanceof Error ? err.message : '';
        const matchConfiavel = msg.match(/Previsão Confiável.*linhas:\s*([\d,\s]+)/i);
        if (matchConfiavel) {
          const linhas = matchConfiavel[1]!
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n));
          setImportBloqueio(bloqueioImportacaoPrevisaoConfiavel(linhas));
          setImportMensagemErro(undefined);
        } else {
          setImportBloqueio(null);
          setImportMensagemErro(
            msg || 'Não foi possível ler o arquivo ou processar a importação. Verifique o formato e tente novamente.'
          );
        }
        setImportResultado(null);
      } finally {
        setImportLoading(false);
      }
    },
    [carregarPedidos, executarImportacao]
  );

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="flex flex-wrap items-center gap-2 gap-y-2">
        <h2 className="shrink-0 text-lg font-semibold text-slate-800 dark:text-slate-200">Gestão de Pedidos</h2>
        <button
          type="button"
          onClick={() => setModalAjudaAberto(true)}
          title="Como ler o Gerenciador — categorias, status e regras de previsão"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
            />
          </svg>
          Como ler
        </button>
        <button
          type="button"
          onClick={() => setModalMaisFiltrosOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          Mais Filtros
          {filtrosModalAtivos > 0 && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
              {filtrosModalAtivos}
            </span>
          )}
        </button>
        {(podeExportarXlsx || podeExportarGrade || podeImportarXlsx || podeAjustarPrevisao) && (
          <>
            {podeExportarXlsx && (
              <button
                type="button"
                onClick={exportarXlsx}
                disabled={exportLoading}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                {exportLoading ? 'Exportando...' : 'Exportar XLSX'}
              </button>
            )}
            {podeExportarGrade && (
              <button
                type="button"
                onClick={exportarGrade}
                disabled={exportGradeLoading}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                {exportGradeLoading ? 'Exportando...' : 'Exportar Grade'}
              </button>
            )}
            {podeImportarXlsx && (
              <>
                <button
                  type="button"
                  onClick={() => inputImportRef.current?.click()}
                  disabled={importLoading}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50"
                >
                  {importLoading ? 'Importando...' : 'Importar XLSX'}
                </button>
                <input
                  ref={inputImportRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </>
            )}
          </>
        )}
        <FiltroDatasPopover
          filtros={filtros}
          onChange={(updates) => setFiltros((prev) => ({ ...prev, ...updates }))}
        />
        <button
          type="button"
          onClick={() => setModalClassificarOpen(true)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
        >
          Classificação personalizada
        </button>
        <button
          type="button"
          onClick={() => void handleIncoherenceIconClick()}
          title={incoherenceTooltip}
          disabled={loading || incoherenceScanBusy || incoherenceClickBusy}
          aria-label={
            incoherenceScanBusy || incoherenceClickBusy
              ? 'Verificando quantidades pendentes'
              : incoherenceHasIssue
                ? 'Inconsistência: soma das quantidades pendentes reais por rota maior que a pendente do item. Clique para filtrar as linhas.'
                : 'Coerência OK entre soma por rota e quantidade pendente do item.'
          }
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900 ${
            incoherenceScanBusy || incoherenceClickBusy
              ? 'border-slate-300 bg-white text-slate-400 hover:bg-slate-50 focus-visible:ring-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-500 dark:hover:bg-slate-600'
              : incoherenceHasIssue
                ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-400 dark:border-amber-600/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50'
                : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-400 dark:border-emerald-600/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50'
          }`}
        >
          {incoherenceScanBusy || incoherenceClickBusy ? (
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : incoherenceHasIssue ? (
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        {podeAjustarPrevisao && selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => setModalLoteOpen(true)}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-medium text-white"
          >
            Reprogramar em lote ({selectedIds.size} selecionado(s))
          </button>
        )}
        <div ref={setGradeToolbarExtrasEl} className="ml-auto flex flex-wrap items-center gap-2 empty:hidden" />
      </div>
      {!loading && total === 0 && erroConexaoErp && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Nenhum dado exibido.</p>
          <p className="mt-1">Falha na conexão com o ERP (Nomus):</p>
          <p className="mt-0.5 font-mono text-xs bg-amber-100 dark:bg-amber-900/50 px-2 py-1.5 rounded break-all">{erroConexaoErp}</p>
          <p className="mt-2 text-xs">
            Verifique <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">NOMUS_DB_URL</code> no .env do backend, rede/firewall até o servidor MySQL e a página <Link to="/situacao-api" className="underline font-medium">Situação da API</Link>.
          </p>
        </div>
      )}
      <div data-main-content className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden" style={{ width: '100%', minWidth: 0 }}>
        {incoherenceViewRows && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100">
            <p>
              Exibindo <strong>{incoherenceViewRows.length}</strong> linha(s) em que a soma de <strong>Qtde Pendente Real</strong> por
              pedido+código ultrapassa a coluna <strong>Pendente</strong> do item (faturamento parcial sem vínculo por rota no ERP).
            </p>
            <button
              type="button"
              onClick={() => setIncoherenceViewRows(null)}
              className="shrink-0 rounded-md border border-amber-700/40 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-slate-800 dark:text-amber-100 dark:hover:bg-slate-700"
            >
              Voltar à grade completa
            </button>
          </div>
        )}
        <TabelaPedidos
          pedidos={incoherenceViewRows ?? pedidos}
          loading={loading}
          onAjustar={podeAjustarPrevisao ? setModalPedido : undefined}
          selectedIds={podeAjustarPrevisao ? selectedIds : undefined}
          onSelectionChange={podeAjustarPrevisao ? setSelectedIds : undefined}
          sortLevels={sortLevelsPersonalizado}
          onSortLevelsChange={handleSortLevelsChange}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          onExibidosCountChange={setTotalExibidosGrade}
          onGradeRowsForExport={syncPedidosGradeExport}
          paginateLocally={!incoherenceViewRows}
          toolbarExtrasContainer={gradeToolbarExtrasEl}
          fillHeight
        />
      </div>
      {totalParaPaginacao > 0 && !incoherenceViewRows && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          <span>
            Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalParaPaginacao)} de{' '}
            {totalParaPaginacao} registros
            {totalExibidosGrade < total && totalExibidosGrade > 0 && (
              <span className="text-slate-500 dark:text-slate-400"> (filtros do cabeçalho ativos)</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-slate-500 dark:text-slate-400">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <PedidosAjudaModal aberto={modalAjudaAberto} onClose={() => setModalAjudaAberto(false)} />

      <ModalMaisFiltrosPedidos
        open={modalMaisFiltrosOpen}
        onClose={() => setModalMaisFiltrosOpen(false)}
        filtros={filtros}
        onChange={setFiltros}
        onAplicar={aplicarFiltros}
        onLimpar={limparFiltros}
      />

      {modalPedido && (
        <ModalAjustePrevisao
          pedido={modalPedido}
          onClose={() => setModalPedido(null)}
          onSuccess={handleAjusteSuccess}
          onError={(msg) => setToast(msg)}
        />
      )}

      {modalLoteOpen && (
        <ModalReprogramacaoLote
          linhas={Array.from(selectedIds).map((id) => {
            const p = pedidos.find((x) => x.id_pedido === id) as Record<string, unknown> | undefined;
            const rota = p
              ? String(p['Observacoes'] ?? p['Observações'] ?? p['rota'] ?? '').trim()
              : '';
            return { id_pedido: id, rota: rota || undefined };
          })}
          onClose={() => setModalLoteOpen(false)}
          onSuccess={(resultado) => {
            setSelectedIds(new Set());
            setModalLoteOpen(false);
            const msg =
              resultado.erros.length > 0
                ? `${resultado.ok} pedido(s) reprogramado(s). ${resultado.erros.length} erro(s): ${resultado.erros.map((e) => e.id_pedido).join(', ')}`
                : `${resultado.ok} pedido(s) reprogramado(s) com sucesso.`;
            setToast(msg);
            setTimeout(() => setToast(null), 5000);
            carregarPedidos(page);
          }}
          onError={(msg) => setToast(msg)}
        />
      )}

      <ModalClassificarPedidos
        open={modalClassificarOpen}
        onClose={() => setModalClassificarOpen(false)}
        initialLevels={sortLevelsPersonalizado}
        onApply={handleSortLevelsChange}
      />

      <ModalImportacao
        open={modalImportOpen}
        progresso={importProgresso}
        status={importStatus}
        resultado={importResultado}
        mensagemErro={importMensagemErro}
        bloqueio={importBloqueio}
        onClose={() => {
          setModalImportOpen(false);
          setImportBloqueio(null);
        }}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-2 text-slate-800 dark:text-slate-100 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
