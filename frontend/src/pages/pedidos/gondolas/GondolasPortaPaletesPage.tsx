import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Download, Printer, RefreshCw, Upload, Warehouse } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PERMISSOES, PERMISSOES_GONDOLAS, type CodigoPermissao } from '../../../config/permissoes';
import { ComoLerBtn } from '../../../components/AjudaTelaModal';
import CarregandoInformacoesOverlay from '../../../components/CarregandoInformacoesOverlay';
import CopiarTextoBtn from '../../../components/CopiarTextoBtn';
import GradeCelulaModalBtn from '../../../components/pcp/GradeCelulaModalBtn';
import GradeFiltroCabecalhoBtn from '../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../components/grade/GradeFiltroExcelPortal';
import { MensagemSemRegistros } from '../../../components/MensagemSemRegistros';
import { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../../utils/textoLivreBusca';
import {
  baixarPlanilhaModeloGondolas,
  detalharItemGondola,
  excluirOrdemGondola,
  gerarOrdemGondola,
  listarOrdensGondola,
  salvarEscolhasFichaGondola,
  type EscolhaFicha,
  type OrdemGondola,
  type TipoOrdemGondola,
  importarPlanilhaGondola,
  listarItensGondolas,
  type DadosPecaGondola,
  type DetalheItemGondola,
  type ItemCarteiraGondola,
  type ResumoPlanilhaGondola,
  type SetorGondola,
} from '../../../api/gondolasPortaPaletes';
import GondolasAjudaModal from './GondolasAjudaModal';
import ModalFichaItem from './ModalFichaItem';
import ModalGerarOrdem from './ModalGerarOrdem';
import { exportarCarteiraGondolasXlsx } from './exportarCarteiraGondolasXlsx';
import { exportarPpDoPedidoXlsx } from './exportarOrdemGondolasXlsx';
import { imprimirOrdemGondolas } from './imprimirOrdemGondolas';

function fmt(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function dataBr(iso: string): string {
  if (!iso || iso.length < 10) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

const painel = 'rounded-xl border border-soaco-gray/35 bg-white dark:bg-soaco-graphite';

const thGrade = 'px-2 py-2.5 text-left text-xs font-semibold whitespace-nowrap align-middle';

const COLUNAS = [
  { id: 'pedido', label: 'Pedido', alinhamento: 'left' },
  { id: 'cliente', label: 'Cliente', alinhamento: 'left' },
  { id: 'codigo', label: 'Código', alinhamento: 'left' },
  { id: 'descricao', label: 'Descrição', alinhamento: 'left' },
  { id: 'setor', label: 'Setor', alinhamento: 'left' },
  { id: 'entrega', label: 'Entrega', alinhamento: 'left' },
  { id: 'status', label: 'Status', alinhamento: 'left' },
  { id: 'pedida', label: 'Pedida', alinhamento: 'right' },
  { id: 'pendente', label: 'Pendente', alinhamento: 'right' },
  { id: 'pendenteReal', label: 'Pendente real', alinhamento: 'right' },
] as const;

const COLUNAS_NUMERO = new Set<string>(['pedida', 'pendente', 'pendenteReal']);

function textoCelula(item: ItemCarteiraGondola, coluna: string): string {
  switch (coluna) {
    case 'pedido':
      return item.pedido;
    case 'cliente':
      return item.cliente;
    case 'codigo':
      return item.codigo;
    case 'descricao':
      return item.descricao;
    case 'setor':
      return item.setor;
    case 'entrega':
      return dataBr(item.dataEntrega);
    case 'status':
      return item.status;
    case 'pedida':
      return fmt(item.qtdePedida);
    case 'pendente':
      return fmt(item.pendente);
    case 'pendenteReal':
      return fmt(item.qtdePendenteReal);
    default:
      return '';
  }
}

function valorOrdenacao(item: ItemCarteiraGondola, coluna: string): string | number {
  if (coluna === 'pedida') return item.qtdePedida;
  if (coluna === 'pendente') return item.pendente;
  if (coluna === 'pendenteReal') return item.qtdePendenteReal;
  if (coluna === 'entrega') return item.dataEntrega || '';
  return textoCelula(item, coluna);
}

type HistoricoPedido = {
  pedido: string;
  cliente: string;
  ordens: { ordem: OrdemGondola; pecas: number; produtos: [string, string][] }[];
  produtos: Map<string, string>;
  pecas: number;
};

function podeVerTela(hasPermission: (codigo: CodigoPermissao) => boolean): boolean {
  return hasPermission(PERMISSOES.PCP_TOTAL) || PERMISSOES_GONDOLAS.some((codigo) => hasPermission(codigo));
}

export default function GondolasPortaPaletesPage() {
  const { hasPermission } = useAuth();
  const total = hasPermission(PERMISSOES.PCP_TOTAL);
  const podeGerar = total || hasPermission(PERMISSOES.PCP_GONDOLAS_GERAR);
  const podeExcluirOrdem = total || hasPermission(PERMISSOES.PCP_GONDOLAS_EXCLUIR_ORDEM);
  const podeEditarMedidas = total || hasPermission(PERMISSOES.PCP_GONDOLAS_EDITAR_MEDIDAS);
  const podeImportar = total || hasPermission(PERMISSOES.PCP_GONDOLAS_IMPORTAR_PLANILHA);
  const podeEscolherFicha = total || hasPermission(PERMISSOES.PCP_GONDOLAS_ESCOLHER_FICHA);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemCarteiraGondola[]>([]);
  const [planilha, setPlanilha] = useState<ResumoPlanilhaGondola | null>(null);
  const [consultou, setConsultou] = useState(false);
  const [setor, setSetor] = useState<'' | SetorGondola>('');
  const [ajuda, setAjuda] = useState(false);
  const [importando, setImportando] = useState<SetorGondola | null>(null);
  const [baixandoPlanilha, setBaixandoPlanilha] = useState(false);
  const [menuModelo, setMenuModelo] = useState(false);
  const [avisoImportacao, setAvisoImportacao] = useState<string | null>(null);

  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheItemGondola | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [ordemAberta, setOrdemAberta] = useState(false);
  const [gerandoOrdem, setGerandoOrdem] = useState(false);
  const [erroOrdem, setErroOrdem] = useState<string | null>(null);
  const [aba, setAba] = useState<'carteira' | 'historico'>('carteira');
  const [ordens, setOrdens] = useState<OrdemGondola[]>([]);
  const [carregandoOrdens, setCarregandoOrdens] = useState(false);
  const [erroOrdens, setErroOrdens] = useState<string | null>(null);
  const [excluindoOrdemId, setExcluindoOrdemId] = useState<number | null>(null);
  const [filtroHistorico, setFiltroHistorico] = useState({ pedido: '', cliente: '', produto: '' });
  const [pedidosAbertos, setPedidosAbertos] = useState<Set<string>>(new Set());
  const [exportandoPedido, setExportandoPedido] = useState<string | null>(null);
  const [exportandoCarteira, setExportandoCarteira] = useState(false);
  const gerouOrdemRef = useRef(false);
  const detalheCacheRef = useRef(new Map<number, DetalheItemGondola>());

  const historicoPorPedido = useMemo(() => {
    const porPedido = new Map<string, HistoricoPedido>();
    for (const ordem of ordens) {
      const doPedidoNaOrdem = new Map<string, DetalheItemGondola[]>();
      for (const detalhe of ordem.detalhes) {
        const lista = doPedidoNaOrdem.get(detalhe.item.pedido) ?? [];
        lista.push(detalhe);
        doPedidoNaOrdem.set(detalhe.item.pedido, lista);
      }
      for (const [pedido, detalhes] of doPedidoNaOrdem) {
        let grupo = porPedido.get(pedido);
        if (!grupo) {
          grupo = { pedido, cliente: detalhes[0]?.item.cliente ?? '', ordens: [], produtos: new Map(), pecas: 0 };
          porPedido.set(pedido, grupo);
        }
        const pecas = detalhes.reduce(
          (soma, detalhe) => soma + detalhe.componentes.reduce((s, componente) => s + componente.quantidadeTotal, 0),
          0
        );
        const produtos = [...new Map(detalhes.map((d) => [d.item.codigo, d.item.descricao])).entries()];
        for (const [codigo, descricao] of produtos) grupo.produtos.set(codigo, descricao);
        grupo.pecas += pecas;
        grupo.ordens.push({ ordem, pecas, produtos });
      }
    }
    const matchPedido = criarMatcherTextoLivre(filtroHistorico.pedido);
    const matchCliente = criarMatcherTextoLivre(filtroHistorico.cliente);
    const matchProduto = criarMatcherTextoLivre(filtroHistorico.produto);
    return [...porPedido.values()]
      .filter(
        (grupo) =>
          matchPedido(grupo.pedido) &&
          matchCliente(grupo.cliente) &&
          [...grupo.produtos.entries()].some(([codigo, descricao]) => matchProduto(codigo) || matchProduto(descricao))
      )
      .sort((a, b) => (b.ordens[0]?.ordem.createdAt ?? '').localeCompare(a.ordens[0]?.ordem.createdAt ?? ''));
  }, [ordens, filtroHistorico]);

  function alternarPedidoHistorico(pedido: string) {
    setPedidosAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(pedido)) proximo.delete(pedido);
      else proximo.add(pedido);
      return proximo;
    });
  }

  const carregarOrdens = useCallback(async () => {
    setCarregandoOrdens(true);
    setErroOrdens(null);
    try {
      setOrdens(await listarOrdensGondola());
    } catch (e) {
      setErroOrdens(e instanceof Error ? e.message : 'Erro ao carregar o histórico.');
    } finally {
      setCarregandoOrdens(false);
    }
  }, []);

  const filtrar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setAvisoImportacao(null);
    detalheCacheRef.current.clear();
    setDetalheId(null);
    setDetalhe(null);
    try {
      const data = await listarItensGondolas();
      setItens(data.itens);
      setPlanilha(data.planilha);
      setConsultou(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar a carteira.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void filtrar();
  }, [filtrar]);

  useEffect(() => {
    if (aba === 'historico') void carregarOrdens();
  }, [aba, carregarOrdens]);

  const visiveis = useMemo(
    () => (setor ? itens.filter((item) => item.setor === setor) : itens),
    [itens, setor]
  );

  const grade = useGradeFiltrosExcel({
    rows: visiveis,
    columnIds: COLUNAS.map((coluna) => coluna.id),
    getCellText: textoCelula,
    valueForSort: valorOrdenacao,
    dateColumnIds: ['entrega'],
  });
  const linhas = grade.rowsExibidas;
  const colunaNumero = COLUNAS_NUMERO.has(grade.colunaFiltroAberta ?? '');
  const itensComFicha = useMemo(() => itens.filter((item) => item.temFicha), [itens]);

  const resumo = useMemo(() => {
    let gondolas = 0;
    let portaPaletes = 0;
    let pendenteReal = 0;
    for (const item of itens) {
      if (item.setor === 'Gôndolas') gondolas += 1;
      else portaPaletes += 1;
      pendenteReal += item.qtdePendenteReal;
    }
    return { gondolas, portaPaletes, pendenteReal };
  }, [itens]);

  const registrarMedidas = useCallback((codigo: string, dados: DadosPecaGondola) => {
    const alvo = codigo.toUpperCase().trim().replace(/\s+/g, ' ').split('.')[0]?.trim() ?? '';
    if (!alvo) return;
    for (const [id, detalhe] of detalheCacheRef.current) {
      if (detalhe.origem !== 'nomus') continue;
      detalheCacheRef.current.set(id, {
        ...detalhe,
        componentes: detalhe.componentes.map((componente) => {
          const chave = componente.codigo.toUpperCase().trim().replace(/\s+/g, ' ').split('.')[0]?.trim() ?? '';
          return chave === alvo ? { ...componente, ...dados } : componente;
        }),
      });
    }
  }, []);

  const carregarFicha = useCallback(async (item: ItemCarteiraGondola) => {
    const data = await detalharItemGondola(item.idItem);
    detalheCacheRef.current.set(item.idItem, data);
    return data;
  }, []);

  async function gerarOrdem(
    setorOrdem: SetorGondola,
    tipo: TipoOrdemGondola,
    detalhes: DetalheItemGondola[]
  ): Promise<string | null> {
    if (detalhes.length === 0) {
      setErroOrdem('Marque ao menos uma peça.');
      return null;
    }
    setGerandoOrdem(true);
    setErroOrdem(null);
    let ordem: OrdemGondola;
    try {
      ordem = await gerarOrdemGondola(setorOrdem, tipo, detalhes);
    } catch (e) {
      setErroOrdem(e instanceof Error ? e.message : 'Erro ao gravar a ordem.');
      setGerandoOrdem(false);
      return null;
    }
    gerouOrdemRef.current = true;
    try {
      await imprimirOrdemGondolas(ordem.detalhes, { numero: ordem.numero, emitidaEm: ordem.createdAt, tipo: ordem.tipo });
    } catch (e) {
      setErroOrdem(
        `Ordem ${ordem.numero} gravada, mas a impressão falhou: ${e instanceof Error ? e.message : 'erro'}. Reimprima pelo Histórico.`
      );
    } finally {
      setGerandoOrdem(false);
    }
    return ordem.numero;
  }

  function fecharModalOrdem() {
    setOrdemAberta(false);
    if (!gerouOrdemRef.current) return;
    gerouOrdemRef.current = false;
    void filtrar();
    void carregarOrdens();
  }

  async function excluirOrdem(ordem: OrdemGondola) {
    const pedidosDaOrdem = [...new Set(ordem.detalhes.map((detalhe) => detalhe.item.pedido))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
    if (
      !window.confirm(
        `Excluir a ordem ${ordem.numero}? A ordem inteira é excluída e as peças voltam a ficar disponíveis para ${
          pedidosDaOrdem.length === 1 ? 'o pedido' : 'os pedidos'
        } ${pedidosDaOrdem.join(', ')}.`
      )
    ) {
      return;
    }
    setExcluindoOrdemId(ordem.id);
    setErroOrdens(null);
    try {
      await excluirOrdemGondola(ordem.id);
      await Promise.all([carregarOrdens(), filtrar()]);
    } catch (e) {
      setErroOrdens(e instanceof Error ? e.message : 'Erro ao excluir a ordem.');
    } finally {
      setExcluindoOrdemId(null);
    }
  }

  async function escolherFichas(escolhas: { codigo: string; origem: EscolhaFicha }[]) {
    await salvarEscolhasFichaGondola(escolhas);
    const porCodigo = new Map(escolhas.map((escolha) => [escolha.codigo.trim().toUpperCase(), escolha.origem]));
    detalheCacheRef.current.clear();
    setItens((atual) =>
      atual.map((item) => {
        const origem = porCodigo.get(item.codigo.trim().toUpperCase());
        return origem && item.ambasFichas ? { ...item, escolhaFicha: origem, origem } : item;
      })
    );
  }

  async function trocarFichaDoItem(origem: EscolhaFicha) {
    if (!detalhe) return;
    setErroDetalhe(null);
    setCarregandoDetalhe(true);
    try {
      await escolherFichas([{ codigo: detalhe.item.codigo, origem }]);
      const data = await detalharItemGondola(detalhe.item.idItem);
      detalheCacheRef.current.set(detalhe.item.idItem, data);
      setDetalhe(data);
    } catch (e) {
      setErroDetalhe(e instanceof Error ? e.message : 'Erro ao trocar a ficha.');
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  async function exportarExcel(grupo: HistoricoPedido) {
    const detalhes = grupo.ordens.flatMap(({ ordem }) =>
      ordem.detalhes.filter((detalhe) => detalhe.item.pedido === grupo.pedido)
    );
    setExportandoPedido(grupo.pedido);
    setErroOrdens(null);
    try {
      const linhas = await exportarPpDoPedidoXlsx(grupo.pedido, detalhes);
      if (linhas === 0) setErroOrdens(`As ordens do ${grupo.pedido} só têm PI. Use o PDF de cada ordem.`);
    } catch (e) {
      setErroOrdens(e instanceof Error ? e.message : 'Erro ao exportar o Excel.');
    } finally {
      setExportandoPedido(null);
    }
  }

  async function exportarCarteira() {
    setExportandoCarteira(true);
    setErro(null);
    try {
      await exportarCarteiraGondolasXlsx(linhas, setor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao exportar o Excel.');
    } finally {
      setExportandoCarteira(false);
    }
  }

  function reimprimir(ordem: OrdemGondola) {
    void imprimirOrdemGondolas(ordem.detalhes, {
      numero: ordem.numero,
      emitidaEm: ordem.createdAt,
      tipo: ordem.tipo,
    }).catch((e: unknown) => setErroOrdens(e instanceof Error ? e.message : 'Erro ao imprimir.'));
  }

  async function abrirItem(item: ItemCarteiraGondola) {
    setDetalheId(item.idItem);
    setErroDetalhe(null);
    setDetalhe(null);
    setCarregandoDetalhe(true);
    try {
      const data = await detalharItemGondola(item.idItem);
      detalheCacheRef.current.set(item.idItem, data);
      setDetalhe(data);
    } catch (e) {
      setErroDetalhe(e instanceof Error ? e.message : 'Erro ao abrir a ficha.');
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  async function importar(setorArquivo: SetorGondola, arquivo: File | undefined) {
    if (!arquivo) return;
    setImportando(setorArquivo);
    setAvisoImportacao(null);
    setErro(null);
    try {
      const data = await importarPlanilhaGondola(setorArquivo, arquivo);
      const lista = await listarItensGondolas();
      setItens(lista.itens);
      setPlanilha(lista.planilha);
      detalheCacheRef.current.clear();
      setAvisoImportacao(`${setorArquivo}: ${data.importadas.toLocaleString('pt-BR')} linhas na planilha.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao importar a planilha.');
    } finally {
      setImportando(null);
    }
  }

  async function baixarPlanilha(setorModelo: SetorGondola) {
    setMenuModelo(false);
    setBaixandoPlanilha(true);
    setErro(null);
    try {
      await baixarPlanilhaModeloGondolas(setorModelo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao baixar a planilha.');
    } finally {
      setBaixandoPlanilha(false);
    }
  }

  if (!podeVerTela(hasPermission)) return <Navigate to="/sem-acesso" replace />;

  const cartoes: { id: '' | SetorGondola; titulo: string; valor: string; detalhe: string }[] = [
    {
      id: '',
      titulo: 'Carteira',
      valor: itens.length.toLocaleString('pt-BR'),
      detalhe: `${fmt(resumo.pendenteReal)} pendente real`,
    },
    {
      id: 'Gôndolas',
      titulo: 'Gôndolas',
      valor: resumo.gondolas.toLocaleString('pt-BR'),
      detalhe: 'itens em aberto',
    },
    {
      id: 'Porta Paletes',
      titulo: 'Porta-paletes',
      valor: resumo.portaPaletes.toLocaleString('pt-BR'),
      detalhe: 'itens em aberto',
    },
  ];

  return (
    <div className="relative space-y-5">
      <CarregandoInformacoesOverlay show={carregando} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">PCP</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Gôndolas e porta-paletes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Clique no item para abrir a ficha de produção. O detalhe vem do Nomus ou, se a ficha não existir, da planilha.
          </p>
        </div>
        <ComoLerBtn onClick={() => setAjuda(true)} title="Como ler gôndolas e porta-paletes" />
      </div>

      <div className="flex gap-1 border-b border-soaco-gray/35" role="tablist" aria-label="Gôndolas e porta-paletes">
        {(
          [
            ['carteira', 'Carteira'],
            ['historico', 'Histórico'],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              aba === id
                ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'historico' && (
        <section className={`${painel} tabela-pedidos-outer overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 border-b border-soaco-gray/35 px-4 py-2.5">
            <p className="text-sm text-slate-600 dark:text-slate-200">
              {historicoPorPedido.length.toLocaleString('pt-BR')} {historicoPorPedido.length === 1 ? 'pedido' : 'pedidos'} ·{' '}
              {ordens.length.toLocaleString('pt-BR')} {ordens.length === 1 ? 'ordem gerada' : 'ordens geradas'}
            </p>
            <button
              type="button"
              onClick={() => void carregarOrdens()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-soaco-navy/60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${carregandoOrdens ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
          <div className="grid gap-2 border-b border-soaco-gray/25 px-4 py-3 sm:grid-cols-3">
            {(
              [
                ['pedido', 'Pedido'],
                ['cliente', 'Cliente'],
                ['produto', 'Produto'],
              ] as const
            ).map(([campo, rotulo]) => (
              <label key={campo} className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">{rotulo}</span>
                <input
                  value={filtroHistorico[campo]}
                  onChange={(e) => setFiltroHistorico((atual) => ({ ...atual, [campo]: e.target.value }))}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                  aria-label={`Filtrar histórico por ${rotulo.toLowerCase()}`}
                  className="input-app h-9 w-full text-sm dark:bg-black"
                />
              </label>
            ))}
          </div>
          {erroOrdens && <p className="px-4 py-2 text-sm text-red-600 dark:text-red-300">{erroOrdens}</p>}
          {carregandoOrdens && ordens.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Carregando o histórico…</p>
          ) : ordens.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma ordem gerada ainda.</p>
          ) : historicoPorPedido.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum pedido neste filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela-pedidos-grade w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr>
                    <th className={thGrade}>Pedido</th>
                    <th className={thGrade}>Cliente</th>
                    <th className={thGrade}>Produtos</th>
                    <th className={`${thGrade} text-right`}>Ordens</th>
                    <th className={`${thGrade} text-right`}>Peças</th>
                    <th className={thGrade}>Última ordem</th>
                    <th className={thGrade} />
                  </tr>
                </thead>
                <tbody>
                  {historicoPorPedido.map((grupo) => {
                    const aberto = pedidosAbertos.has(grupo.pedido);
                    const codigos = [...grupo.produtos.keys()];
                    return (
                      <Fragment key={grupo.pedido}>
                        <tr className="cursor-pointer" onClick={() => alternarPedidoHistorico(grupo.pedido)}>
                          <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-white">
                            <span className="inline-flex items-center gap-1.5">
                              {aberto ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                              <button
                                type="button"
                                aria-expanded={aberto}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  alternarPedidoHistorico(grupo.pedido);
                                }}
                                className="hover:underline"
                              >
                                {grupo.pedido}
                              </button>
                            </span>
                          </td>
                          <td className="max-w-[240px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-200" title={grupo.cliente}>
                            {grupo.cliente || '—'}
                          </td>
                          <td
                            className="max-w-[260px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-200"
                            title={codigos.join(', ')}
                          >
                            {codigos.join(', ')}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                            {grupo.ordens.length.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-800 dark:text-white">
                            {fmt(grupo.pecas)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700 dark:text-slate-200">
                            {grupo.ordens[0] ? new Date(grupo.ordens[0].ordem.createdAt).toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            <button
                              type="button"
                              disabled={exportandoPedido === grupo.pedido}
                              onClick={(e) => {
                                e.stopPropagation();
                                void exportarExcel(grupo);
                              }}
                              title="Baixa um Excel com todos os PP e as peças da planilha das ordens deste pedido, nas colunas do PDF."
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {exportandoPedido === grupo.pedido ? 'Exportando…' : 'Excel PP'}
                            </button>
                          </td>
                        </tr>
                        {aberto && (
                          <tr>
                            <td colSpan={7} className="bg-black/30 px-3 py-3">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="text-slate-400">
                                    <th className="px-2 py-1.5 font-semibold">Data</th>
                                    <th className="px-2 py-1.5 font-semibold">Usuário</th>
                                    <th className="px-2 py-1.5 font-semibold">Ordem</th>
                                    <th className="px-2 py-1.5 font-semibold">Setor</th>
                                    <th className="px-2 py-1.5 font-semibold">Tipo</th>
                                    <th className="px-2 py-1.5 font-semibold">Produtos do pedido</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">Peças</th>
                                    <th className="px-2 py-1.5" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {grupo.ordens.map(({ ordem, pecas, produtos }) => {
                                    const outrosPedidos =
                                      new Set(ordem.detalhes.map((detalhe) => detalhe.item.pedido)).size - 1;
                                    return (
                                      <tr key={ordem.id} className="border-t border-soaco-gray/20">
                                        <td className="whitespace-nowrap px-2 py-2 tabular-nums text-slate-200">
                                          {new Date(ordem.createdAt).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-2 py-2 text-slate-200">{ordem.criadoPorLogin || '—'}</td>
                                        <td className="px-2 py-2 font-semibold text-white">
                                          {ordem.numero}
                                          {outrosPedidos > 0 && (
                                            <span className="ml-1.5 font-normal text-slate-400">
                                              (+{outrosPedidos} {outrosPedidos === 1 ? 'pedido' : 'pedidos'})
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-2 py-2 text-slate-200">
                                          {ordem.setor === 'Porta Paletes' ? 'Porta-paletes' : ordem.setor}
                                        </td>
                                        <td className="px-2 py-2 text-slate-200">
                                          {ordem.tipo === 'PLANILHA' ? 'Planilha' : ordem.tipo}
                                        </td>
                                        <td className="px-2 py-2 text-slate-200">
                                          {produtos.map(([codigo, descricao]) => (
                                            <div key={codigo} className="truncate" title={descricao}>
                                              <span className="font-medium text-white">{codigo}</span>
                                              {descricao ? <span className="text-slate-400"> · {descricao}</span> : null}
                                            </div>
                                          ))}
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums text-white">{fmt(pecas)}</td>
                                        <td className="whitespace-nowrap px-2 py-2 text-right">
                                          <button
                                            type="button"
                                            onClick={() => reimprimir(ordem)}
                                            className="mr-3 font-medium text-primary-300 hover:underline"
                                          >
                                            PDF
                                          </button>
                                          {podeExcluirOrdem && (
                                            <button
                                              type="button"
                                              disabled={excluindoOrdemId === ordem.id}
                                              onClick={() => void excluirOrdem(ordem)}
                                              className="font-medium text-red-400 hover:underline disabled:opacity-50"
                                            >
                                              {excluindoOrdemId === ordem.id ? 'Excluindo…' : 'Excluir'}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {aba === 'carteira' && (
      <>
      <div className="grid gap-3 sm:grid-cols-3">
        {cartoes.map((cartao) => {
          const ativo = setor === cartao.id;
          return (
            <button
              key={cartao.titulo}
              type="button"
              aria-pressed={ativo}
              onClick={() => setSetor(cartao.id)}
              className={`${painel} px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-soaco-navy/60 ${
                ativo ? 'ring-2 ring-primary-600 ring-offset-2 ring-offset-white dark:ring-offset-black' : ''
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {cartao.titulo}
              </p>
              <p className="mt-1.5 text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">
                {cartao.valor}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{cartao.detalhe}</p>
            </button>
          );
        })}
      </div>

      <div className={`${painel} flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
            onClick={() => void filtrar()}
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          {podeGerar && (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#FFAD00] px-4 text-sm font-semibold text-black shadow-sm transition hover:bg-[#E69C00]"
              onClick={() => {
                setErroOrdem(null);
                setOrdemAberta(true);
              }}
            >
              <Printer className="h-4 w-4" />
              Gerar ordem
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <p className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
            <Warehouse className="h-3.5 w-3.5 shrink-0" />
            <span>
              Planilha {planilha?.origem === 'importada' ? 'importada' : 'inicial'}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-100">
                {(planilha?.gondolas ?? 0).toLocaleString('pt-BR')}
              </span>{' '}
              gôndolas ·{' '}
              <span className="font-medium text-slate-700 dark:text-slate-100">
                {(planilha?.portaPaletes ?? 0).toLocaleString('pt-BR')}
              </span>{' '}
              porta-paletes
            </span>
          </p>
          <div className="relative">
            <button
              type="button"
              disabled={baixandoPlanilha}
              onClick={() => setMenuModelo((aberto) => !aberto)}
              aria-haspopup="menu"
              aria-expanded={menuModelo}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-soaco-gray/40 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:text-slate-100 dark:hover:bg-soaco-navy/60"
              title="Baixar a última planilha guardada no Gestão"
            >
              <Download className="h-3.5 w-3.5" />
              {baixandoPlanilha ? 'Baixando…' : 'Baixar modelo'}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {menuModelo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuModelo(false)} />
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-lg border border-soaco-gray/40 bg-white py-1 shadow-lg dark:bg-soaco-graphite"
                >
                  {(['Gôndolas', 'Porta Paletes'] as const).map((opcao) => (
                    <button
                      key={opcao}
                      type="button"
                      role="menuitem"
                      onClick={() => void baixarPlanilha(opcao)}
                      className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-soaco-navy/60"
                    >
                      {opcao === 'Gôndolas' ? 'Gôndolas' : 'Porta-paletes'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {podeImportar && (
          <>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-soaco-gray/40 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-soaco-navy/60">
            <Upload className="h-3.5 w-3.5" />
            {importando === 'Gôndolas' ? 'Importando…' : 'Importar gôndolas'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importando != null}
              onChange={(e) => {
                void importar('Gôndolas', e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-soaco-gray/40 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-soaco-navy/60">
            <Upload className="h-3.5 w-3.5" />
            {importando === 'Porta Paletes' ? 'Importando…' : 'Importar porta-paletes'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importando != null}
              onChange={(e) => {
                void importar('Porta Paletes', e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          </>
          )}
        </div>
      </div>

      {erro && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      )}
      {avisoImportacao && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {avisoImportacao}
        </p>
      )}

      <div className={`${painel} tabela-pedidos-outer overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-soaco-gray/35 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-200">
              {linhas.length.toLocaleString('pt-BR')} {linhas.length === 1 ? 'item' : 'itens'}
              {setor ? ` · ${setor}` : ''}
            </p>
            <button
              type="button"
              onClick={() => void exportarCarteira()}
              disabled={linhas.length === 0 || exportandoCarteira}
              title="Exporta as linhas da grade com o cartão e os filtros de coluna aplicados"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
            >
              <Download className="h-3.5 w-3.5" />
              {exportandoCarteira ? 'Exportando…' : 'Excel'}
            </button>
          </div>
          <p className="flex flex-wrap items-center justify-end gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Nomus
              </span>
              Ficha no Nomus
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded bg-[#FFAD00] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                Planilha
              </span>
              Ficha importada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
              Sem ficha
            </span>
          </p>
        </div>
        <div ref={grade.tableScrollRef} className="tabela-pedidos-scroll overflow-x-auto">
          <table className="tabela-pedidos-grade w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr>
                {COLUNAS.map((coluna) => (
                  <th key={coluna.id} className={`${thGrade} ${coluna.alinhamento === 'right' ? 'text-right' : ''}`}>
                    <div className={`flex min-w-0 items-center gap-1 ${coluna.alinhamento === 'right' ? 'justify-end' : 'justify-between'}`}>
                      <span>{coluna.label}</span>
                      <GradeFiltroCabecalhoBtn
                        ativo={grade.colunaComFiltroAtivo(coluna.id)}
                        onClick={(e) => grade.abrirFiltroExcel(coluna.id, e)}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((item) => (
                <tr key={item.idItem} className="cursor-pointer" onClick={() => void abrirItem(item)}>
                  <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{item.pedido}</td>
                  <td className="max-w-[190px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-200" title={item.cliente}>
                    {item.cliente}
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1.5">
                      <GradeCelulaModalBtn
                        align="left"
                        title={
                          item.origem === 'nomus'
                            ? `Ficha no Nomus · ${item.codigo}`
                            : item.origem === 'planilha'
                              ? `Ficha na planilha · ${item.codigo}`
                              : `${item.codigo} sem ficha no Nomus e na planilha`
                        }
                        className={
                          item.temFicha
                            ? 'inline-flex min-h-7 items-center justify-center rounded-md border border-emerald-600/40 bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60'
                            : 'inline-flex min-h-7 items-center justify-center rounded-md border border-red-600/40 bg-red-100 px-2.5 py-1 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-400/60'
                        }
                        onClick={() => void abrirItem(item)}
                      >
                        {item.codigo}
                      </GradeCelulaModalBtn>
                      <CopiarTextoBtn texto={item.codigo} title="Copiar código do produto" />
                      {item.origem === 'nomus' && (
                        <span className="rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Nomus
                        </span>
                      )}
                      {item.origem === 'planilha' && (
                        <span className="rounded bg-[#FFAD00] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                          Planilha
                        </span>
                      )}
                      {item.ambasFichas && (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            item.escolhaFicha
                              ? 'border-soaco-gray/50 text-slate-500 dark:text-slate-300'
                              : 'border-amber-500/70 text-amber-600 dark:text-amber-300'
                          }`}
                          title={
                            item.escolhaFicha
                              ? 'Tem ficha no Nomus e na planilha. A lista escolhida está ao lado.'
                              : 'Tem ficha no Nomus e na planilha. O Gerar ordem vai pedir qual lista permanece.'
                          }
                        >
                          {item.escolhaFicha ? '2 fichas' : 'Escolher ficha'}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-200" title={item.descricao}>
                    {item.descricao}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{item.setor}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700 dark:text-slate-200">
                    {dataBr(item.dataEntrega)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{item.status}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{fmt(item.qtdePedida)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{fmt(item.pendente)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-white">
                    {fmt(item.qtdePendenteReal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {consultou && linhas.length === 0 && <MensagemSemRegistros />}
      </div>
      </>
      )}

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          showNumericFilters={colunaNumero}
          showDateRangeFilters={grade.colunaFiltroAberta === 'entrega'}
          sortAscLabel={colunaNumero ? 'Menor para Maior' : undefined}
          sortDescLabel={colunaNumero ? 'Maior para Menor' : undefined}
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
        />
      )}

      {detalheId != null && (
        <ModalFichaItem
          detalhe={detalhe}
          carregando={carregandoDetalhe}
          erro={erroDetalhe}
          onTrocarFicha={podeEscolherFicha ? (origem) => void trocarFichaDoItem(origem) : undefined}
          onClose={() => {
            setDetalheId(null);
            setErroDetalhe(null);
          }}
        />
      )}
      <ModalGerarOrdem
        aberto={ordemAberta}
        itens={itensComFicha}
        gerando={gerandoOrdem}
        erro={erroOrdem}
        onClose={fecharModalOrdem}
        carregarFicha={carregarFicha}
        onMedidasSalvas={registrarMedidas}
        podeEditarMedidas={podeEditarMedidas}
        podeEscolherFicha={podeEscolherFicha}
        onEscolherFichas={escolherFichas}
        onGerar={gerarOrdem}
      />
      <GondolasAjudaModal aberto={ajuda} onClose={() => setAjuda(false)} />
    </div>
  );
}
