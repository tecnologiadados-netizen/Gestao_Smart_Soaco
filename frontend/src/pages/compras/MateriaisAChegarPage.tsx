import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  podeAcessarMateriaisAChegar,
  podeAlterarDatasEntrega,
  podeVerDatasEntregaAtualizar,
} from '../../utils/materiaisAChegarPermissoes';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import { fmtQtde } from '../../components/pcp/ModalConsultaEstoqueDetalhe';
import {
  listarDatasEntregaAtualizar,
  obterPipelineAcompanhamento,
  type DetalheAcompanhamento,
  type DocumentoAcompanhamento,
  type EtapaAcompanhamento,
  type LinhaAcompanhamento,
  type PedidoDataEntregaAtualizar,
  type TipoDocumentoAcompanhamento,
} from '../../api/acompanhamentoSolicitacao';
import MateriaisAChegarDocumentoModal, { type AlvoDocumento } from './MateriaisAChegarDocumentoModal';
import DatasEntregaAtualizarPainel from './DatasEntregaAtualizarPainel';
import MateriaisAChegarAjudaModal from './MateriaisAChegarAjudaModal';
import MateriaisAChegarDetalheModal from './MateriaisAChegarDetalheModal';

type FiltroEtapa = 'todas' | EtapaAcompanhamento;

const ETAPAS: {
  id: EtapaAcompanhamento;
  titulo: string;
  apoio: string;
  campo: keyof Pick<LinhaAcompanhamento, 'qtdeSolicitado' | 'qtdePreCompra' | 'qtdeComprado' | 'qtdePreEntrada'>;
  ativo: string;
  anel: string;
}[] = [
  {
    id: 'solicitado',
    titulo: 'Solicitado',
    apoio: 'Liberada, sem pedido',
    campo: 'qtdeSolicitado',
    ativo: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-50',
    anel: 'bg-sky-500',
  },
  {
    id: 'pre_compra',
    titulo: 'Pré-compra',
    apoio: 'Cotação vinculada, sem pedido',
    campo: 'qtdePreCompra',
    ativo: 'border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-50',
    anel: 'bg-teal-500',
  },
  {
    id: 'comprado',
    titulo: 'Comprado',
    apoio: 'Pedido em aberto',
    campo: 'qtdeComprado',
    ativo: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50',
    anel: 'bg-amber-500',
  },
  {
    id: 'pre_entrada',
    titulo: 'Pré-entrada',
    apoio: 'Pedido encerrado, documento 173',
    campo: 'qtdePreEntrada',
    ativo: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-50',
    anel: 'bg-violet-500',
  },
];

function qtdeDaEtapa(linha: LinhaAcompanhamento, etapa: EtapaAcompanhamento): number {
  if (etapa === 'solicitado') return linha.qtdeSolicitado;
  if (etapa === 'pre_compra') return linha.qtdePreCompra;
  if (etapa === 'comprado') return linha.qtdeComprado;
  return linha.qtdePreEntrada;
}

type ColunaDataId = 'emissaoSc' | 'necessidadeSc' | 'emissaoPreCompra' | 'emissaoPc' | 'emissaoPre';
type OrdemDir = 'asc' | 'desc';
type FiltroData = { de: string; ate: string };

const FILTROS_DATA: { id: ColunaDataId; label: string }[] = [
  { id: 'emissaoSc', label: 'Emissão da solicitação' },
  { id: 'necessidadeSc', label: 'Necessidade da solicitação' },
  { id: 'emissaoPreCompra', label: 'Emissão da pré-compra' },
  { id: 'emissaoPc', label: 'Emissão do pedido' },
  { id: 'emissaoPre', label: 'Emissão da NF' },
];

function fmtData(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function dataDaLinha(linha: LinhaAcompanhamento, id: ColunaDataId): string | null {
  if (id === 'emissaoSc') return linha.emissaoSolicitacao;
  if (id === 'necessidadeSc') return linha.necessidadeSolicitacao;
  if (id === 'emissaoPreCompra') return linha.emissaoPreCompra;
  if (id === 'emissaoPc') return linha.emissaoPedido;
  return linha.emissaoPreEntrada;
}

function passaPeriodo(ymd: string | null, filtro: FiltroData | undefined): boolean {
  if (!filtro?.de && !filtro?.ate) return true;
  if (!ymd) return false;
  let de = filtro.de;
  let ate = filtro.ate;
  if (de && ate && de > ate) {
    const tmp = de;
    de = ate;
    ate = tmp;
  }
  if (de && ymd < de) return false;
  if (ate && ymd > ate) return false;
  return true;
}

function compararCodigo(a: LinhaAcompanhamento, b: LinhaAcompanhamento): number {
  return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

/** Separa itens marcados no valor do filtro. Códigos e números não usam este caractere. */
const SEP_FILTRO = '|';

function tokensCampo(campo: string | null | undefined): string[] {
  if (!campo?.trim()) return [];
  const vistos = new Set<string>();
  const tokens: string[] = [];
  for (const bruto of campo.split(/[\n,]+/)) {
    const token = bruto.trim();
    if (!token || vistos.has(token)) continue;
    vistos.add(token);
    tokens.push(token);
  }
  return tokens;
}

function selecionadosFiltro(valor: string): Set<string> {
  if (!valor.trim()) return new Set();
  return new Set(
    valor
      .split(SEP_FILTRO)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Lista vazia não restringe. Com marcas, basta um dos itens marcados estar na linha. */
function passaSelecao(selecionados: Set<string>, campo: string | null | undefined): boolean {
  if (selecionados.size === 0) return true;
  return tokensCampo(campo).some((token) => selecionados.has(token));
}

function ordenarTexto(valores: Iterable<string>): string[] {
  return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
}

const CLASSE_ROTULO_FILTRO = 'mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400';
const CLASSE_FILTRO =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

export default function MateriaisAChegarPage() {
  const { hasPermission, profileLoaded } = useAuth();
  const podeVer = podeAcessarMateriaisAChegar(hasPermission);
  const podeVerDatas = podeVerDatasEntregaAtualizar(hasPermission);
  const podeAlterarData = podeAlterarDatasEntrega(hasPermission);

  const [visaoEscolhida, setVisao] = useState<'produtos' | 'datas'>('produtos');
  const visao = podeVerDatas ? visaoEscolhida : 'produtos';
  const [pedidosData, setPedidosData] = useState<PedidoDataEntregaAtualizar[]>([]);
  const [carregandoDatas, setCarregandoDatas] = useState(podeVerDatas);
  const [erroDatas, setErroDatas] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaAcompanhamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroProduto, setFiltroProduto] = useState('');
  const [filtroSolicitacao, setFiltroSolicitacao] = useState('');
  const [filtroPreCompra, setFiltroPreCompra] = useState('');
  const [filtroPedido, setFiltroPedido] = useState('');
  const [filtroDocumento, setFiltroDocumento] = useState('');
  const [filtrosData, setFiltrosData] = useState<Partial<Record<ColunaDataId, FiltroData>>>({});
  const [ordemData, setOrdemData] = useState<{ id: ColunaDataId; dir: OrdemDir } | null>(null);
  const [modalDataId, setModalDataId] = useState<ColunaDataId | null>(null);
  const [etapaFiltro, setEtapaFiltro] = useState<FiltroEtapa>('todas');
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [alvo, setAlvo] = useState<{
    idProduto: number;
    etapa: EtapaAcompanhamento;
    codigo: string;
    descricao: string;
    qtdeGrade: number;
  } | null>(null);
  const cacheRef = useRef(new Map<string, DetalheAcompanhamento>());
  const [pilhaDocumentos, setPilhaDocumentos] = useState<AlvoDocumento[]>([]);
  const documentoCacheRef = useRef(new Map<string, DocumentoAcompanhamento>());

  const abrirDocumento = useCallback((doc: AlvoDocumento) => {
    setPilhaDocumentos((pilha) => {
      const topo = pilha[pilha.length - 1];
      if (topo && topo.tipo === doc.tipo && topo.id === doc.id) return pilha;
      return [...pilha, doc];
    });
  }, []);

  const fecharTudo = useCallback(() => {
    setPilhaDocumentos([]);
    setAlvo(null);
  }, []);

  const verNaGrade = useCallback(
    (codigo: string) => {
      fecharTudo();
      setVisao('produtos');
      setFiltroProduto(codigo);
      setFiltroSolicitacao('');
      setFiltroPreCompra('');
      setFiltroPedido('');
      setFiltroDocumento('');
      setEtapaFiltro('todas');
    },
    [fecharTudo]
  );

  const filtrarGradePorDocumento = useCallback(
    (tipo: TipoDocumentoAcompanhamento, numero: string) => {
      fecharTudo();
      setVisao('produtos');
      setFiltroProduto('');
      setFiltroSolicitacao('');
      setFiltroPreCompra('');
      setFiltroPedido(tipo === 'pedido' ? numero : '');
      setFiltroDocumento(tipo === 'pre_entrada' ? numero : '');
      setEtapaFiltro('todas');
    },
    [fecharTudo]
  );

  const carregarDatas = useCallback(async () => {
    if (!podeVerDatas) return;
    setCarregandoDatas(true);
    setErroDatas(null);
    const r = await listarDatasEntregaAtualizar();
    if (r.error) {
      setPedidosData([]);
      setErroDatas(r.error);
    } else {
      setPedidosData(r.pedidos);
    }
    setCarregandoDatas(false);
  }, [podeVerDatas]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    cacheRef.current.clear();
    documentoCacheRef.current.clear();
    void carregarDatas();
    const r = await obterPipelineAcompanhamento();
    if (r.error) {
      setLinhas([]);
      setErro(r.error);
    } else {
      setLinhas(r.linhas);
    }
    setCarregando(false);
  }, [carregarDatas]);

  useEffect(() => {
    if (podeVer) void carregar();
  }, [podeVer, carregar]);

  const temFiltroData = useMemo(
    () => FILTROS_DATA.some((c) => filtrosData[c.id]?.de || filtrosData[c.id]?.ate) || ordemData != null,
    [filtrosData, ordemData]
  );

  const opcoesLista = useMemo(() => {
    const produtos: string[] = [];
    const rotuloProduto: Record<string, string> = {};
    const solicitacoes = new Set<string>();
    const preCompras = new Set<string>();
    const pedidos = new Set<string>();
    const documentos = new Set<string>();
    for (const linha of linhas) {
      if (rotuloProduto[linha.codigo] == null) {
        produtos.push(linha.codigo);
        const descricao = linha.descricao?.trim();
        rotuloProduto[linha.codigo] = descricao ? `${linha.codigo} ${descricao}` : linha.codigo;
      }
      for (const token of tokensCampo(linha.solicitacoes)) solicitacoes.add(token);
      for (const token of tokensCampo(linha.preCompras)) preCompras.add(token);
      for (const token of tokensCampo(linha.pedidos)) pedidos.add(token);
      for (const token of tokensCampo(linha.documentos)) documentos.add(token);
    }
    produtos.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    return {
      produtos,
      rotuloProduto,
      solicitacoes: ordenarTexto(solicitacoes),
      preCompras: ordenarTexto(preCompras),
      pedidos: ordenarTexto(pedidos),
      documentos: ordenarTexto(documentos),
    };
  }, [linhas]);

  const visiveis = useMemo(() => {
    const produtos = selecionadosFiltro(filtroProduto);
    const solicitacoes = selecionadosFiltro(filtroSolicitacao);
    const preCompras = selecionadosFiltro(filtroPreCompra);
    const pedidos = selecionadosFiltro(filtroPedido);
    const documentos = selecionadosFiltro(filtroDocumento);
    const lista = linhas.filter((l) => {
      if (produtos.size > 0 && !produtos.has(l.codigo)) return false;
      if (!passaSelecao(solicitacoes, l.solicitacoes)) return false;
      if (!passaSelecao(preCompras, l.preCompras)) return false;
      if (!passaSelecao(pedidos, l.pedidos)) return false;
      if (!passaSelecao(documentos, l.documentos)) return false;
      for (const col of FILTROS_DATA) {
        if (!passaPeriodo(dataDaLinha(l, col.id), filtrosData[col.id])) return false;
      }
      if (etapaFiltro !== 'todas' && qtdeDaEtapa(l, etapaFiltro) <= 0) return false;
      return true;
    });
    lista.sort((a, b) => {
      if (!ordemData) return compararCodigo(a, b);
      const av = dataDaLinha(a, ordemData.id) ?? '';
      const bv = dataDaLinha(b, ordemData.id) ?? '';
      if (!av && !bv) return compararCodigo(a, b);
      if (!av) return 1;
      if (!bv) return -1;
      const cmp = av.localeCompare(bv);
      if (cmp !== 0) return ordemData.dir === 'asc' ? cmp : -cmp;
      return compararCodigo(a, b);
    });
    return lista;
  }, [linhas, filtroProduto, filtroSolicitacao, filtroPreCompra, filtroPedido, filtroDocumento, filtrosData, etapaFiltro, ordemData]);

  const limparFiltrosData = useCallback(() => {
    setFiltrosData({});
    setOrdemData(null);
    setModalDataId(null);
  }, []);

  const resumo = useMemo(() => {
    return ETAPAS.map((etapa) => {
      let produtos = 0;
      let qtde = 0;
      for (const l of visiveis) {
        const q = qtdeDaEtapa(l, etapa.id);
        if (q > 0) {
          produtos += 1;
          qtde += q;
        }
      }
      return { ...etapa, produtos, qtde: Math.round(qtde * 100) / 100 };
    });
  }, [visiveis]);

  if (!profileLoaded) return null;
  if (!podeVer) return <Navigate to="/sem-acesso" replace />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 md:p-5">
      <CarregandoInformacoesOverlay
        show={carregando}
        mensagem="Lendo solicitações, pedidos e pré-entradas…"
        mode="contained"
      />

      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Materiais a chegar
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              O que ainda está a caminho: da solicitação liberada até a pré-entrada.
            </p>
          </div>
          <ComoLerBtn
            onClick={() => setAjudaAberta(true)}
            title="Como ler Materiais a chegar"
          />
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Atualizar
        </button>
      </div>

      {podeVerDatas ? (
      <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/60" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={visao === 'produtos'}
          onClick={() => setVisao('produtos')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            visao === 'produtos'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50'
          }`}
        >
          Materiais por produto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={visao === 'datas'}
          onClick={() => setVisao('datas')}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            visao === 'datas'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50'
          }`}
          title="Pedidos com data de entrega atrasada, vazia ou vencendo em até 7 dias"
        >
          Datas de entrega a atualizar
          <span
            className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums ${
              pedidosData.length > 0 ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-100'
            }`}
          >
            {carregandoDatas ? '…' : pedidosData.length}
          </span>
        </button>
      </div>
      ) : null}

      {visao === 'datas' ? (
        <DatasEntregaAtualizarPainel
          pedidos={pedidosData}
          carregando={carregandoDatas}
          erro={erroDatas}
          onAbrirPedido={(p) =>
            abrirDocumento({
              tipo: 'pedido',
              id: p.idPedido,
              numero: p.pedido,
              escopo: 'datas_entrega',
            })
          }
        />
      ) : (
      <>
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {resumo.map((etapa) => (
          <button
            key={etapa.id}
            type="button"
            onClick={() => setEtapaFiltro((atual) => (atual === etapa.id ? 'todas' : etapa.id))}
            className={`rounded-xl border px-4 py-3.5 text-left shadow-sm transition ${
              etapaFiltro === etapa.id ? `${etapa.ativo} ring-2 ring-offset-1 ring-slate-400` : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
            }`}
            aria-pressed={etapaFiltro === etapa.id}
            title={etapa.apoio}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${etapa.anel}`} />
              <span className="text-sm font-semibold">{etapa.titulo}</span>
            </div>
            <p className="mt-1 pl-5 text-xs leading-snug text-slate-500 dark:text-slate-400">{etapa.apoio}</p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="mr-1.5 text-2xl font-semibold tabular-nums leading-none text-slate-900 dark:text-slate-50">
                {etapa.produtos}
              </span>
              {etapa.produtos === 1 ? 'produto' : 'produtos'}
              <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
              {fmtQtde(etapa.qtde)}
            </p>
          </button>
        ))}
      </div>

      <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="min-w-0">
          <MultiSelectWithSearch
            label="Código ou descrição"
            placeholder="Todos"
            options={opcoesLista.produtos}
            value={filtroProduto}
            onChange={setFiltroProduto}
            labelClass={CLASSE_ROTULO_FILTRO}
            inputClass={CLASSE_FILTRO}
            optionLabel="produtos"
            labelByValue={opcoesLista.rotuloProduto}
            valueSeparator={SEP_FILTRO}
            fillContainer
            minWidth="0px"
            dropdownPortal
            dropdownZIndex={70}
            dropdownMinWidthPx={480}
            dropdownMaxHeight="320px"
          />
        </div>
        <div className="min-w-0">
          <MultiSelectWithSearch
            label="Solicitação"
            placeholder="Todas"
            options={opcoesLista.solicitacoes}
            value={filtroSolicitacao}
            onChange={setFiltroSolicitacao}
            labelClass={CLASSE_ROTULO_FILTRO}
            inputClass={CLASSE_FILTRO}
            optionLabel="solicitações"
            valueSeparator={SEP_FILTRO}
            fillContainer
            minWidth="0px"
            dropdownPortal
            dropdownZIndex={70}
          />
        </div>
        <div className="min-w-0">
          <MultiSelectWithSearch
            label="Pré-compra"
            placeholder="Todas"
            options={opcoesLista.preCompras}
            value={filtroPreCompra}
            onChange={setFiltroPreCompra}
            labelClass={CLASSE_ROTULO_FILTRO}
            inputClass={CLASSE_FILTRO}
            optionLabel="pré-compras"
            valueSeparator={SEP_FILTRO}
            fillContainer
            minWidth="0px"
            dropdownPortal
            dropdownZIndex={70}
            dropdownMinWidthPx={280}
          />
        </div>
        <div className="min-w-0">
          <MultiSelectWithSearch
            label="Pedido de compra"
            placeholder="Todos"
            options={opcoesLista.pedidos}
            value={filtroPedido}
            onChange={setFiltroPedido}
            labelClass={CLASSE_ROTULO_FILTRO}
            inputClass={CLASSE_FILTRO}
            optionLabel="pedidos"
            valueSeparator={SEP_FILTRO}
            fillContainer
            minWidth="0px"
            dropdownPortal
            dropdownZIndex={70}
            dropdownMinWidthPx={280}
          />
        </div>
        <div className="min-w-0">
          <MultiSelectWithSearch
            label="Documento"
            placeholder="Todos"
            options={opcoesLista.documentos}
            value={filtroDocumento}
            onChange={setFiltroDocumento}
            labelClass={CLASSE_ROTULO_FILTRO}
            inputClass={CLASSE_FILTRO}
            optionLabel="documentos"
            valueSeparator={SEP_FILTRO}
            fillContainer
            minWidth="0px"
            dropdownPortal
            dropdownZIndex={70}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {FILTROS_DATA.map((col) => {
          const periodo = filtrosData[col.id];
          const ativo = Boolean(periodo?.de || periodo?.ate || ordemData?.id === col.id);
          const seta = ordemData?.id === col.id ? (ordemData.dir === 'asc' ? ' ↑' : ' ↓') : '';
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setModalDataId(col.id)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                ativo
                  ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-500 dark:bg-primary-500/25 dark:text-primary-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
              title={col.label}
            >
              {col.label}
              {seta}
            </button>
          );
        })}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {visiveis.length} {visiveis.length === 1 ? 'produto' : 'produtos'}
        </span>
        {temFiltroData ? (
          <button
            type="button"
            onClick={limparFiltrosData}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            Limpar datas
          </button>
        ) : null}
      </div>
      </div>

      {erro ? (
        <p className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      ) : null}

      <div className="shrink-0 space-y-3 pb-4">
        {!carregando && visiveis.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
            Nenhum produto nesta etapa do caminho.
          </p>
        ) : (
          visiveis.map((linha) => (
            <article
              key={linha.idProduto}
              className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5"
            >
              <header className="min-w-0" title={linha.descricao}>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-semibold text-slate-900 dark:text-slate-50">{linha.codigo}</span>
                  {linha.unidadeMedida ? (
                    <span className="text-xs text-slate-400">{linha.unidadeMedida}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-300">
                  {linha.descricao}
                </p>
              </header>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {ETAPAS.map((etapa) => {
                  const qtde = qtdeDaEtapa(linha, etapa.id);
                  const preenchida = qtde > 0;
                  return (
                      <button
                        key={etapa.id}
                        type="button"
                        disabled={!preenchida}
                        onClick={() =>
                          setAlvo({
                            idProduto: linha.idProduto,
                            etapa: etapa.id,
                            codigo: linha.codigo,
                            descricao: linha.descricao,
                            qtdeGrade: qtde,
                          })
                        }
                        className={`min-h-[5.5rem] rounded-lg px-3 py-3 text-left ${
                          preenchida
                            ? `border ${etapa.ativo} hover:brightness-[0.98]`
                            : 'cursor-default bg-slate-50 text-slate-400 dark:bg-slate-900/50'
                        }`}
                        title={preenchida ? `Ver detalhe de ${etapa.titulo}` : `${etapa.titulo}: sem quantidade`}
                      >
                        <span className="block text-xs font-semibold">{etapa.titulo}</span>
                        <span className="mt-1.5 block text-xl font-semibold tabular-nums leading-tight">
                          {preenchida ? fmtQtde(qtde) : '—'}
                        </span>
                        {etapa.id === 'solicitado' && preenchida ? (
                          <span className="mt-1 block text-[11px] font-normal leading-snug opacity-80">
                            Emissão {fmtData(linha.emissaoSolicitacao)}
                            <br />
                            Necessidade {fmtData(linha.necessidadeSolicitacao)}
                          </span>
                        ) : null}
                        {etapa.id === 'pre_compra' && preenchida ? (
                          <span className="mt-1 block text-[11px] font-normal leading-snug opacity-80">
                            Emissão {fmtData(linha.emissaoPreCompra)}
                          </span>
                        ) : null}
                        {etapa.id === 'comprado' && preenchida ? (
                          <span className="mt-1 block text-[11px] font-normal leading-snug opacity-80">
                            Emissão {fmtData(linha.emissaoPedido)}
                          </span>
                        ) : null}
                        {etapa.id === 'pre_entrada' && preenchida ? (
                          <span className="mt-1 block text-[11px] font-normal leading-snug opacity-80">
                            Emissão da NF {fmtData(linha.emissaoPreEntrada)}
                          </span>
                        ) : null}
                      </button>
                  );
                })}
              </div>
            </article>
          ))
        )}
      </div>
      </>
      )}

      <FiltroDataModal
        colunaId={modalDataId}
        filtro={modalDataId ? filtrosData[modalDataId] : undefined}
        ordem={ordemData}
        onClose={() => setModalDataId(null)}
        onAplicar={(id, periodo, dir) => {
          setFiltrosData((prev) => {
            const next = { ...prev };
            if (!periodo.de && !periodo.ate) delete next[id];
            else next[id] = periodo;
            return next;
          });
          setOrdemData((atual) => {
            if (dir) return { id, dir };
            if (atual?.id === id) return null;
            return atual;
          });
          setModalDataId(null);
        }}
        onLimpar={(id) => {
          setFiltrosData((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setOrdemData((atual) => (atual?.id === id ? null : atual));
          setModalDataId(null);
        }}
      />

      <MateriaisAChegarAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
      <MateriaisAChegarDetalheModal
        alvo={alvo}
        cacheRef={cacheRef}
        onAbrirDocumento={abrirDocumento}
        onClose={() => setAlvo(null)}
      />
      <MateriaisAChegarDocumentoModal
        alvo={pilhaDocumentos[pilhaDocumentos.length - 1] ?? null}
        anterior={pilhaDocumentos[pilhaDocumentos.length - 2] ?? null}
        cacheRef={documentoCacheRef}
        podeAlterarData={podeAlterarData}
        onVoltar={() => setPilhaDocumentos((pilha) => pilha.slice(0, -1))}
        onAbrirDocumento={abrirDocumento}
        onVerNaGrade={verNaGrade}
        onFiltrarGrade={filtrarGradePorDocumento}
        onDataEntregaAlterada={() => void carregarDatas()}
        onClose={() => setPilhaDocumentos([])}
      />
    </div>
  );
}

function FiltroDataModal({
  colunaId,
  filtro,
  ordem,
  onClose,
  onAplicar,
  onLimpar,
}: {
  colunaId: ColunaDataId | null;
  filtro: FiltroData | undefined;
  ordem: { id: ColunaDataId; dir: OrdemDir } | null;
  onClose: () => void;
  onAplicar: (id: ColunaDataId, periodo: FiltroData, dir: OrdemDir | null) => void;
  onLimpar: (id: ColunaDataId) => void;
}) {
  const coluna = FILTROS_DATA.find((c) => c.id === colunaId) ?? null;
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [dir, setDir] = useState<OrdemDir | null>(null);

  useEffect(() => {
    if (!colunaId) return;
    setDe(filtro?.de ?? '');
    setAte(filtro?.ate ?? '');
    setDir(ordem?.id === colunaId ? ordem.dir : null);
  }, [colunaId, filtro, ordem]);

  useEffect(() => {
    if (!colunaId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [colunaId, onClose]);

  if (!coluna || !colunaId) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filtro-data-titulo"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="filtro-data-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {coluna.label}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Período e ordem desta data. Produto sem data nesta etapa fica de fora do período.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Data início
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Data fim
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-slate-600 dark:text-slate-300">Ordem</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDir('asc')}
              className={`rounded-lg border px-3 py-2 text-sm ${
                dir === 'asc'
                  ? 'border-primary-600 bg-primary-50 font-medium text-primary-800 dark:border-primary-500 dark:bg-primary-500/25 dark:text-primary-100'
                  : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'
              }`}
              aria-pressed={dir === 'asc'}
            >
              Crescente
            </button>
            <button
              type="button"
              onClick={() => setDir('desc')}
              className={`rounded-lg border px-3 py-2 text-sm ${
                dir === 'desc'
                  ? 'border-primary-600 bg-primary-50 font-medium text-primary-800 dark:border-primary-500 dark:bg-primary-500/25 dark:text-primary-100'
                  : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'
              }`}
              aria-pressed={dir === 'desc'}
            >
              Decrescente
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Crescente: da mais antiga para a mais recente. Decrescente: da mais recente para a mais antiga.
          </p>
        </fieldset>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onLimpar(colunaId)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onAplicar(colunaId, { de, ate }, dir)}
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
