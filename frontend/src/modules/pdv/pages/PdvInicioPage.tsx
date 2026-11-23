import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { logout } from '@/api/auth';
import { abrirPropostaPdf, pdvJson } from '@pdv/pdvApi';

type ModoOperacao = 'pedido' | 'orcamento' | 'ambos';
type DestinoVenda = 'pedido' | 'orcamento';

type Sessao = {
  operador: string;
  podeConfigurar: boolean;
  idEmpresa: number | null;
  empresa: string;
  uf: string;
  crt: string;
  configurado: boolean;
  ignorarEstoque: boolean;
  modoOperacao: ModoOperacao;
  exigeAberturaCaixa?: boolean;
  idTipoMovimentacao?: number | null;
  idCondicaoPagamento?: number | null;
  idFormaPagamento?: number | null;
  idPessoaVendedor?: number | null;
  certificado: {
    cnpj: string;
    titular: string;
    validoAte: string | null;
    ambiente: string;
    temCsc: boolean;
  } | null;
  caixa: { id: number; fundoTroco: number; movimentos: { tipo: string; valor: number; observacao: string }[] } | null;
};

type Produto = {
  id: number;
  codigo: string;
  descricao: string;
  ncm: string;
  origem: string;
  gtin: string;
  idUnidadeMedida: number | null;
  sigla: string;
  preco: number;
  descontoMaximo: number;
  saldo: number;
  vinculado: boolean;
};

type ItemCarrinho = Produto & {
  quantidade: number;
  descontoPercentual: number;
  atributosItem?: Record<string, string>;
};

type Forma = { id: number; nome: string };
type Condicao = { id: number; nome: string };
type TipoMov = { id: number; nome: string };
type Contato = { id: number; nome: string; email?: string; telefone?: string };
type Endereco = { id: number; rotulo: string; tipoEndereco?: string };
type AtributoOpcao = {
  nome: string;
  obrigatorio: boolean;
  formato: 'texto' | 'data' | 'lista';
  opcoes: string[];
  escopo?: 'cabecalho' | 'item';
};
type Cliente = { id: number; nome: string; cpf?: string; cnpj?: string };
type Vendedor = { id: number; nome: string };

function rotuloItemCarrinho(item: { codigo?: string; descricao?: string; quantidade: number }) {
  const cod = String(item.codigo ?? '').trim();
  const desc = String(item.descricao ?? '').trim();
  const nome = cod && desc ? `${cod} — ${desc}` : desc || cod || 'Item';
  return `${item.quantidade} × ${nome}`;
}

function dataIsoMaisDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type FormClienteNovo = {
  tipoPessoa: 1 | 2;
  nome: string;
  razaoSocial: string;
  documento: string;
  tipoContribuinteICMS: 1 | 2 | 3;
  inscricaoEstadual: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
};

const formClienteVazio: FormClienteNovo = {
  tipoPessoa: 2,
  nome: '',
  razaoSocial: '',
  documento: '',
  tipoContribuinteICMS: 3,
  inscricaoEstadual: '',
  telefone: '',
  email: '',
  cep: '',
  endereco: '',
  numero: '',
  bairro: '',
  municipio: '',
  uf: '',
};
type Pagamento = { idFormaPagamento: number; valor: number };

type VendaResposta = {
  id: number;
  total: number;
  troco: number;
  status: string;
  destinoNomus?: DestinoVenda | string;
  idPedidoNomus: number | null;
  idPropostaNomus?: number | null;
  idDocumentoNomus: number | null;
  aliquotaIpiMedia: number;
  chave: string;
  protocolo: string;
  statusFiscal: string;
  motivoFiscal: string;
  qrCode: string;
  clienteNome: string;
  itens: {
    idProduto: number;
    codigo: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    descontoPercentual: number;
    aliquotaIpi: number;
    ncm: string;
    origem: string;
    idUnidadeMedida: number | null;
  }[];
  pagamentos: { nomeForma: string; valor: number }[];
};

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function liquido(item: ItemCarrinho): number {
  return item.quantidade * item.preco * (1 - item.descontoPercentual / 100);
}

export default function PdvInicioPage({ onSair }: { onSair?: () => void }) {
  const buscaRef = useRef<HTMLInputElement>(null);
  const clienteRef = useRef<HTMLInputElement>(null);
  const vendedorRef = useRef<HTMLInputElement>(null);
  const pagamentoRef = useRef<HTMLInputElement>(null);
  const fundoRef = useRef<HTMLInputElement>(null);

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [erroSessao, setErroSessao] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [paginaProdutos, setPaginaProdutos] = useState(1);
  const [, setTemMaisProdutos] = useState(false);
  const [carregandoBusca, setCarregandoBusca] = useState(false);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [selecionado, setSelecionado] = useState(0);
  const [formas, setFormas] = useState<Forma[]>([]);
  const [condicoes, setCondicoes] = useState<Condicao[]>([]);
  const [tiposMov, setTiposMov] = useState<TipoMov[]>([]);
  const [atributosOpcoes, setAtributosOpcoes] = useState<AtributoOpcao[]>([]);
  const [idCondicaoPagamento, setIdCondicaoPagamento] = useState(0);
  const [idTipoMovimentacao, setIdTipoMovimentacao] = useState(0);
  const [idContato, setIdContato] = useState(0);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [dataValidade, setDataValidade] = useState(() => dataIsoMaisDias(30));
  const [observacao, setObservacao] = useState('');
  const [atributosValores, setAtributosValores] = useState<Record<string, string>>({});
  const [localRetiradaDif, setLocalRetiradaDif] = useState(false);
  const [idEnderecoRetirada, setIdEnderecoRetirada] = useState(0);
  const [localEntregaDif, setLocalEntregaDif] = useState(false);
  const [idEnderecoEntrega, setIdEnderecoEntrega] = useState(0);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([{ idFormaPagamento: 0, valor: 0 }]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteBusca, setClienteBusca] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [documento, setDocumento] = useState('');
  const [contribuinte, setContribuinte] = useState(false);
  const [ie, setIe] = useState('');
  const [ufCliente, setUfCliente] = useState('');
  const [fiscal, setFiscal] = useState<'nenhuma' | 'nfce' | 'nfe'>('nenhuma');
  const [destino, setDestino] = useState<DestinoVenda>('pedido');
  const [enviando, setEnviando] = useState(false);
  const [comprovante, setComprovante] = useState<VendaResposta | null>(null);
  /** Pedido já gravado no Nomus — escolher NFC-e / NF-e / sem nota. */
  const [modalFiscal, setModalFiscal] = useState<VendaResposta | null>(null);
  const [emitindoFiscal, setEmitindoFiscal] = useState(false);
  const [esperas, setEsperas] = useState<VendaResposta[]>([]);
  const [orcamentos, setOrcamentos] = useState<VendaResposta[]>([]);
  const [painelEspera, setPainelEspera] = useState(false);
  const [painelOrcamentos, setPainelOrcamentos] = useState(false);
  const [fundo, setFundo] = useState('0');
  const [movimentoValor, setMovimentoValor] = useState('');
  const [movimentoTipo, setMovimentoTipo] = useState<'suprimento' | 'sangria'>('suprimento');
  const [painelOperacoes, setPainelOperacoes] = useState(false);
  const [operacaoForm, setOperacaoForm] = useState<null | 'sangria' | 'suprimento' | 'fechamento' | 'devolucao'>(null);
  const movimentoValorRef = useRef<HTMLInputElement>(null);
  const [mostrarCliente, setMostrarCliente] = useState(false);
  const [mostrarVendedor, setMostrarVendedor] = useState(false);
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [vendedorBusca, setVendedorBusca] = useState('');
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [modalCliente, setModalCliente] = useState(false);
  const [formCliente, setFormCliente] = useState<FormClienteNovo>(formClienteVazio);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [claro, setClaro] = useState(() => localStorage.getItem('pdv_tema') !== 'escuro');
  const tema = claro ? 'pdv-shell pdv-claro' : 'pdv-shell';
  const [etapa, setEtapa] = useState<'balcao' | 'fechamento'>('balcao');
  const [rascunho, setRascunho] = useState<Produto | null>(null);
  const [rascunhoQtd, setRascunhoQtd] = useState('1');
  const [rascunhoDesc, setRascunhoDesc] = useState('');
  const [modalAtributosItem, setModalAtributosItem] = useState(false);
  const [atributosItemDraft, setAtributosItemDraft] = useState<Record<string, string>>({});
  const [formaReceberId, setFormaReceberId] = useState(0);
  const [valorReceber, setValorReceber] = useState('');
  const [pagamentosLista, setPagamentosLista] = useState<Pagamento[]>([]);

  function selecionarCliente(c: Cliente) {
    setCliente(c);
    setClienteBusca(c.nome);
    setClientes([]);
    setMostrarCliente(true);
    const doc = (c.cpf || c.cnpj || '').trim();
    if (doc) setDocumento(doc);
  }

  async function salvarClienteNovo() {
    if (!formCliente.nome.trim()) {
      setAviso('Informe o nome do cliente.');
      return;
    }
    if (!formCliente.documento.trim()) {
      setAviso(formCliente.tipoPessoa === 1 ? 'Informe o CNPJ.' : 'Informe o CPF.');
      return;
    }
    setSalvandoCliente(true);
    setAviso('');
    try {
      const body = {
        tipoPessoa: formCliente.tipoPessoa,
        nome: formCliente.nome.trim(),
        razaoSocial: (formCliente.razaoSocial || formCliente.nome).trim(),
        cpf: formCliente.tipoPessoa === 2 ? formCliente.documento.trim() : '',
        cnpj: formCliente.tipoPessoa === 1 ? formCliente.documento.trim() : '',
        tipoContribuinteICMS: formCliente.tipoContribuinteICMS,
        inscricaoEstadual: formCliente.inscricaoEstadual.trim(),
        telefone: formCliente.telefone.trim(),
        email: formCliente.email.trim(),
        cep: formCliente.cep.trim(),
        endereco: formCliente.endereco.trim(),
        numero: formCliente.numero.trim(),
        bairro: formCliente.bairro.trim(),
        municipio: formCliente.municipio.trim(),
        uf: formCliente.uf.trim().toUpperCase(),
      };
      const data = await pdvJson<{ cliente: Cliente }>('/api/pdv/clientes', { method: 'POST', body });
      selecionarCliente(data.cliente);
      setDocumento(formCliente.documento.trim());
      setContribuinte(formCliente.tipoContribuinteICMS === 1);
      setIe(formCliente.inscricaoEstadual.trim());
      setUfCliente(formCliente.uf.trim().toUpperCase());
      setModalCliente(false);
      setFormCliente(formClienteVazio);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível cadastrar o cliente.');
    } finally {
      setSalvandoCliente(false);
    }
  }

  function alternarTema() {
    setClaro((atual) => {
      const proximo = !atual;
      localStorage.setItem('pdv_tema', proximo ? 'claro' : 'escuro');
      return proximo;
    });
  }

  const recarregarSessao = useCallback(() => {
    pdvJson<Sessao>('/api/pdv/sessao')
      .then((data) => {
        setSessao(data);
        setErroSessao('');
      })
      .catch((e: unknown) => setErroSessao(e instanceof Error ? e.message : 'Falha ao abrir o PDV.'));
  }, []);

  useEffect(() => {
    recarregarSessao();
    pdvJson<{
      formas: Forma[];
      condicoes: Condicao[];
      tipos: TipoMov[];
      atributos: AtributoOpcao[];
      padrao: { idTipoMovimentacao: number | null; idCondicaoPagamento: number | null; idFormaPagamento: number | null };
    }>('/api/pdv/orcamento/opcoes')
      .then((data) => {
        setFormas(data.formas);
        setCondicoes(data.condicoes);
        setTiposMov(data.tipos);
        setAtributosOpcoes(data.atributos ?? []);
        const formaPadrao =
          data.formas.find((f) => f.id === data.padrao?.idFormaPagamento) || ordenarFormas(data.formas)[0];
        if (formaPadrao) {
          setFormaReceberId(formaPadrao.id);
          setPagamentos([{ idFormaPagamento: formaPadrao.id, valor: 0 }]);
        }
        if (data.padrao?.idCondicaoPagamento) setIdCondicaoPagamento(data.padrao.idCondicaoPagamento);
        else if (data.condicoes[0]) setIdCondicaoPagamento(data.condicoes[0].id);
        if (data.padrao?.idTipoMovimentacao) setIdTipoMovimentacao(data.padrao.idTipoMovimentacao);
        else if (data.tipos[0]) setIdTipoMovimentacao(data.tipos[0].id);
      })
      .catch(() => {
        pdvJson<{ formas: Forma[]; condicoes: Condicao[] }>('/api/pdv/formas')
          .then((data) => {
            setFormas(data.formas);
            setCondicoes(data.condicoes ?? []);
            const primeira = ordenarFormas(data.formas)[0];
            if (primeira) {
              setFormaReceberId(primeira.id);
              setPagamentos([{ idFormaPagamento: primeira.id, valor: 0 }]);
            }
          })
          .catch(() => setFormas([]));
      });
  }, [recarregarSessao]);

  useEffect(() => {
    if (!sessao?.idEmpresa) return;
    const idPadrao = sessao.idPessoaVendedor || 0;
    const qs = idPadrao ? `?id=${idPadrao}` : '';
    pdvJson<{ vendedores: Vendedor[] }>(`/api/pdv/vendedores${qs}`)
      .then((data) => {
        const lista = data.vendedores ?? [];
        setVendedores(lista);
        setVendedor((atual) => {
          if (atual) return atual;
          const padrao = lista.find((v) => v.id === idPadrao) || lista[0] || null;
          if (padrao) setVendedorBusca(padrao.nome);
          return padrao;
        });
      })
      .catch(() => {
        /* lista opcional */
      });
  }, [sessao?.idEmpresa, sessao?.idPessoaVendedor]);

  useEffect(() => {
    if (!mostrarVendedor) return;
    const t = window.setTimeout(() => {
      const q = vendedorBusca.trim();
      // Evita refetch com nome completo já selecionado (Nomus às vezes responde 503).
      if (vendedor && q === vendedor.nome) return;
      const qs = new URLSearchParams();
      if (q.length >= 2) qs.set('q', q);
      else if (vendedor?.id) qs.set('id', String(vendedor.id));
      pdvJson<{ vendedores: Vendedor[] }>(`/api/pdv/vendedores?${qs}`)
        .then((data) => setVendedores(data.vendedores ?? []))
        .catch(() => setVendedores([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [mostrarVendedor, vendedor, vendedorBusca]);

  useEffect(() => {
    if (!cliente?.id) {
      setContatos([]);
      setEnderecos([]);
      setIdContato(0);
      setIdEnderecoRetirada(0);
      setIdEnderecoEntrega(0);
      return;
    }
    pdvJson<{ contatos: Contato[] }>(`/api/pdv/clientes/${cliente.id}/contatos`)
      .then((data) => {
        setContatos(data.contatos);
        setIdContato((atual) => atual || data.contatos[0]?.id || 0);
      })
      .catch(() => setContatos([]));
    pdvJson<{ enderecos: Endereco[] }>(`/api/pdv/clientes/${cliente.id}/enderecos`)
      .then((data) => setEnderecos(data.enderecos))
      .catch(() => setEnderecos([]));
  }, [cliente?.id]);

  useEffect(() => {
    setPaginaProdutos(1);
  }, [busca]);

  useEffect(() => {
    if (!sessao?.idEmpresa || !sessao.configurado) return;
    const t = window.setTimeout(() => {
      setCarregandoBusca(true);
      const qs = new URLSearchParams({
        q: busca,
        pagina: String(paginaProdutos),
        tamanho: '24',
      });
      pdvJson<{ produtos: Produto[]; pagina: number; temMais: boolean }>(`/api/pdv/produtos?${qs}`)
        .then((data) => {
          setProdutos(data.produtos);
          setTemMaisProdutos(Boolean(data.temMais));
        })
        .catch((e: unknown) => setAviso(e instanceof Error ? e.message : 'Falha na busca.'))
        .finally(() => setCarregandoBusca(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [busca, paginaProdutos, sessao?.idEmpresa, sessao?.configurado]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (clienteBusca.trim().length < 2) {
        setClientes([]);
        return;
      }
      pdvJson<{ clientes: Cliente[] }>(`/api/pdv/clientes?q=${encodeURIComponent(clienteBusca)}`)
        .then((data) => setClientes(data.clientes))
        .catch(() => setClientes([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [clienteBusca]);

  const total = useMemo(() => carrinho.reduce((s, item) => s + liquido(item), 0), [carrinho]);
  const formasVisiveis = useMemo(() => ordenarFormas(formas), [formas]);
  const pagoTotal = useMemo(
    () => round2(pagamentosLista.reduce((s, p) => s + (Number(p.valor) || 0), 0)),
    [pagamentosLista],
  );
  const faltaPagar = Math.max(0, round2(total - pagoTotal));
  const formaAtualId = pagamentosLista[0]?.idFormaPagamento || formaReceberId || pagamentos[0]?.idFormaPagamento || 0;

  useEffect(() => {
    if (etapa === 'fechamento' && !valorReceber) {
      setValorReceber(faltaPagar > 0 ? String(faltaPagar) : String(total || ''));
    }
  }, [etapa, faltaPagar, total, valorReceber]);

  const atributosPrincipais = useMemo(
    () =>
      atributosOpcoes.filter(
        (a) =>
          (a.escopo ?? 'cabecalho') === 'cabecalho' &&
          [
            'Data de entrega',
            'Método de entrega',
            'Montagem',
            'Primeiro contato efetivado através de:',
            'Projeto',
            'Tipo de venda',
          ].includes(a.nome),
      ),
    [atributosOpcoes],
  );
  const atributosItem = useMemo(() => {
    const fromApi = atributosOpcoes.filter(
      (a) => a.escopo === 'item' || a.nome === 'Produto Montado ?',
    );
    // Fallback fixo: Nomus exige este LIPROP; se a API não listar, o modal ainda abre.
    const fixos: AtributoOpcao[] = [
      {
        nome: 'Produto Montado ?',
        obrigatorio: true,
        formato: 'lista',
        opcoes: ['Sim', 'Não'],
        escopo: 'item',
      },
    ];
    const nomes = new Set(fromApi.map((a) => a.nome));
    return [...fromApi, ...fixos.filter((a) => !nomes.has(a.nome))];
  }, [atributosOpcoes]);
  const atributoOutrasInfo = useMemo(
    () => atributosOpcoes.find((a) => a.nome === 'FRETE' && (a.escopo ?? 'cabecalho') === 'cabecalho') ?? null,
    [atributosOpcoes],
  );

  const ignorarEstoque = Boolean(sessao?.ignorarEstoque);

  function confirmarPagamentoRecebido() {
    const idForma = formaReceberId || formasVisiveis[0]?.id || 0;
    const valor = Number(String(valorReceber).replace(',', '.')) || 0;
    if (!idForma) {
      setAviso('Selecione a forma de pagamento.');
      return;
    }
    if (valor <= 0) {
      setAviso('Informe o valor recebido.');
      return;
    }
    setPagamentosLista((atual) => {
      const nova = [...atual, { idFormaPagamento: idForma, valor: round2(valor) }];
      setPagamentos(nova);
      return nova;
    });
    setValorReceber('');
    setAviso('');
  }

  function escolherProdutoRascunho(produto: Produto) {
    if (!ignorarEstoque && (!produto.vinculado || produto.saldo <= 0)) {
      setAviso(`${produto.codigo || produto.descricao} está sem estoque nesta empresa.`);
      return;
    }
    setRascunho(produto);
    setRascunhoQtd('1');
    setRascunhoDesc('');
    setAviso('');
    // Fecha a lista de resultados — o produto já está no formulário abaixo.
    setBusca('');
    setProdutos([]);
    setPaginaProdutos(1);
    setTemMaisProdutos(false);
  }

  function chaveAtributosItem(attrs?: Record<string, string>) {
    return Object.entries(attrs ?? {})
      .filter(([, v]) => String(v ?? '').trim())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v).trim()}`)
      .join('|');
  }

  function abrirModalOuAdicionar() {
    if (!rascunho) {
      setAviso('Localize e selecione um produto.');
      return;
    }
    const qtd = Number(String(rascunhoQtd).replace(',', '.')) || 0;
    if (qtd <= 0) {
      setAviso('Informe a quantidade.');
      return;
    }
    if (!ignorarEstoque && qtd > rascunho.saldo + 0.0001) {
      setAviso(`Só há ${rascunho.saldo} em estoque.`);
      return;
    }
    if (atributosItem.length > 0) {
      const draft: Record<string, string> = {};
      for (const atr of atributosItem) draft[atr.nome] = '';
      setAtributosItemDraft(draft);
      setModalAtributosItem(true);
      setAviso('');
      return;
    }
    confirmarAdicionarProduto({});
  }

  function confirmarAdicionarProduto(attrs: Record<string, string>) {
    if (!rascunho) return;
    const qtd = Number(String(rascunhoQtd).replace(',', '.')) || 0;
    const desc = Math.min(
      Math.max(Number(String(rascunhoDesc).replace(',', '.')) || 0, 0),
      rascunho.descontoMaximo || 100,
    );
    const attrsLimpos: Record<string, string> = {};
    for (const [k, v] of Object.entries(attrs)) {
      const valor = String(v ?? '').trim();
      if (valor) attrsLimpos[k] = valor;
    }
    for (const atr of atributosItem) {
      if (atr.obrigatorio && !attrsLimpos[atr.nome]) {
        setAviso(`Preencha o atributo: ${atr.nome}`);
        return;
      }
    }
    const chaveAttrs = chaveAtributosItem(attrsLimpos);
    setCarrinho((atual) => {
      const idx = atual.findIndex(
        (i) =>
          i.id === rascunho.id &&
          i.descontoPercentual === desc &&
          chaveAtributosItem(i.atributosItem) === chaveAttrs,
      );
      if (idx >= 0) {
        const copia = [...atual];
        const novaQtd = copia[idx].quantidade + qtd;
        if (!ignorarEstoque && novaQtd > rascunho.saldo + 0.0001) {
          setAviso(`Só há ${rascunho.saldo} em estoque.`);
          return atual;
        }
        copia[idx] = { ...copia[idx], quantidade: novaQtd, saldo: rascunho.saldo };
        return copia;
      }
      return [
        ...atual,
        {
          ...rascunho,
          quantidade: qtd,
          descontoPercentual: desc,
          atributosItem: Object.keys(attrsLimpos).length ? attrsLimpos : undefined,
        },
      ];
    });
    setModalAtributosItem(false);
    setAtributosItemDraft({});
    setRascunho(null);
    setRascunhoQtd('1');
    setRascunhoDesc('');
    setBusca('');
    setAviso('');
    window.setTimeout(() => buscaRef.current?.focus(), 0);
  }

  function adicionarRascunho() {
    abrirModalOuAdicionar();
  }

  function irParaFechamento() {
    if (!carrinho.length) {
      setAviso('Inclua ao menos um produto.');
      return;
    }
    setPagamentosLista([]);
    setFormaReceberId((id) => id || formasVisiveis[0]?.id || 0);
    setValorReceber(String(round2(total)));
    setEtapa('fechamento');
    setAviso('');
  }

  function ajustarQtd(index: number, delta: number) {
    setCarrinho((atual) =>
      atual.flatMap((row, i) => {
        if (i !== index) return [row];
        const quantidade = row.quantidade + delta;
        if (quantidade < 1) return [];
        if (!ignorarEstoque && quantidade > row.saldo) {
          setAviso(`Só há ${row.saldo} em estoque.`);
          return [row];
        }
        setAviso('');
        return [{ ...row, quantidade }];
      }),
    );
  }

  const modo = sessao?.modoOperacao === 'orcamento' || sessao?.modoOperacao === 'ambos' ? sessao.modoOperacao : 'pedido';
  const destinoEfetivo: DestinoVenda = modo === 'orcamento' ? 'orcamento' : modo === 'pedido' ? 'pedido' : destino;
  const exigeCaixa = sessao?.exigeAberturaCaixa !== false;
  const caixaOk = !exigeCaixa || Boolean(sessao?.caixa);
  /** Tela de abertura só no modo pedido; em "ambos" o balcão segue e o pedido fica bloqueado até abrir. */
  const bloqueiaPorCaixa = exigeCaixa && !sessao?.caixa && modo === 'pedido';

  useEffect(() => {
    if (modo === 'orcamento') setDestino('orcamento');
    else if (modo === 'pedido') setDestino('pedido');
  }, [modo]);

  const confirmar = useCallback(
    async (espera: boolean, destinoEscolhido: DestinoVenda = destinoEfetivo) => {
      if (!carrinho.length) {
        setAviso('Inclua ao menos um produto.');
        return;
      }
      if (!espera) {
        if (destinoEscolhido === 'orcamento') {
          if (!dataValidade) {
            setAviso('Informe a data de validade da proposta.');
            return;
          }
          if (!idCondicaoPagamento) {
            setAviso('Selecione a condição de pagamento.');
            return;
          }
          if (!idTipoMovimentacao) {
            setAviso('Selecione o tipo de movimentação.');
            return;
          }
          for (const atr of atributosPrincipais) {
            if (atr.obrigatorio && !String(atributosValores[atr.nome] ?? '').trim()) {
              setAviso(`Preencha o atributo: ${atr.nome}`);
              return;
            }
          }
          for (const item of carrinho) {
            for (const atr of atributosItem) {
              if (atr.obrigatorio && !String(item.atributosItem?.[atr.nome] ?? '').trim()) {
                setAviso(`Preencha "${atr.nome}" no item ${item.codigo || item.descricao}.`);
                return;
              }
            }
          }
        }
        const idForma =
          formaAtualId ||
          formaReceberId ||
          pagamentosLista[0]?.idFormaPagamento ||
          0;
        if (!idForma) {
          setAviso('Selecione a forma de pagamento.');
          return;
        }
        if (destinoEscolhido === 'pedido' && pagamentosLista.length === 0) {
          setAviso('Confirme ao menos um pagamento recebido.');
          return;
        }
      }
      setEnviando(true);
      setAviso('');
      try {
        const atributosProposta = Object.entries(atributosValores)
          .map(([nomeAtributo, valorBruto]) => {
            const meta = atributosOpcoes.find((a) => a.nome === nomeAtributo);
            if ((meta?.escopo ?? 'cabecalho') === 'item') return null;
            let valorAtributo = String(valorBruto ?? '').trim();
            if (meta?.formato === 'data') {
              const m = valorAtributo.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (m) valorAtributo = `${m[3]}/${m[2]}/${m[1]}`;
            }
            return { nomeAtributo, valorAtributo };
          })
          .filter((a): a is { nomeAtributo: string; valorAtributo: string } =>
            Boolean(a && a.nomeAtributo && a.valorAtributo),
          );
        const idFormaFinal =
          pagamentosLista[0]?.idFormaPagamento || formaReceberId || formaAtualId || null;
        const pags =
          espera || destinoEscolhido === 'orcamento'
            ? []
            : pagamentosLista.length
              ? pagamentosLista
              : idFormaFinal
                ? [{ idFormaPagamento: idFormaFinal, valor: total }]
                : [];
        const venda = await pdvJson<VendaResposta>('/api/pdv/vendas', {
          method: 'POST',
          body: {
            espera,
            destino: destinoEscolhido,
            // Nota fiscal: modal pós-gravação do pedido (não emite aqui).
            fiscal: 'nenhuma',
            itens: carrinho.map((item) => ({
              idProduto: item.id,
              codigo: item.codigo,
              descricao: item.descricao,
              quantidade: item.quantidade,
              valorUnitario: item.preco,
              descontoPercentual: item.descontoPercentual,
              ncm: item.ncm,
              origem: item.origem,
              idUnidadeMedida: item.idUnidadeMedida,
              atributosItem: Object.entries(item.atributosItem ?? {})
                .map(([nomeAtributo, valorAtributo]) => ({
                  nomeAtributo,
                  valorAtributo: String(valorAtributo ?? '').trim(),
                }))
                .filter((a) => a.nomeAtributo && a.valorAtributo),
            })),
            pagamentos: pags,
            idPessoaCliente: cliente?.id ?? null,
            clienteNome: cliente?.nome ?? '',
            clienteDocumento: documento,
            clienteContribuinte: contribuinte,
            clienteIe: ie,
            clienteUf: ufCliente,
            observacao,
            idFormaPagamento: idFormaFinal,
            idCondicaoPagamento: idCondicaoPagamento || null,
            idTipoMovimentacao: idTipoMovimentacao || null,
            idContato: idContato || null,
            idPessoaVendedor: vendedor?.id || null,
            dataValidade: destinoEscolhido === 'orcamento' ? dataValidade : undefined,
            atributosProposta:
              destinoEscolhido === 'orcamento' || destinoEscolhido === 'pedido' ? atributosProposta : [],
            localRetiradaDifEnderecoRemetente: localRetiradaDif,
            idEnderecoLocalRetirada: localRetiradaDif ? idEnderecoRetirada || null : null,
            localEntregaDifEnderecoDestinatario: localEntregaDif,
            idEnderecoLocalEntrega: localEntregaDif ? idEnderecoEntrega || null : null,
          },
        });
        if (espera) {
          setAviso(`Venda ${venda.id} ficou em espera.`);
          setEtapa('balcao');
        } else if (destinoEscolhido === 'pedido' && venda.idPedidoNomus) {
          setFiscal('nenhuma');
          setModalFiscal(venda);
          setEtapa('balcao');
        } else {
          setComprovante(venda);
          setEtapa('balcao');
          if (venda.status === 'orcamento' && venda.idPropostaNomus) {
            try {
              await abrirPropostaPdf(venda.id, true);
            } catch (e) {
              setAviso(e instanceof Error ? e.message : 'Orçamento gravado, mas o PDF não abriu.');
            }
          }
        }
        setCarrinho([]);
        setPagamentosLista([]);
        setPagamentos((atual) => atual.map((p) => ({ ...p, valor: 0 })));
        setObservacao('');
        setRascunho(null);
        recarregarSessao();
      } catch (e) {
        setAviso(e instanceof Error ? e.message : 'Não foi possível concluir a venda.');
      } finally {
        setEnviando(false);
      }
    },
    [
      atributosItem,
      atributosOpcoes,
      atributosPrincipais,
      atributosValores,
      carrinho,
      cliente,
      contribuinte,
      dataValidade,
      destinoEfetivo,
      documento,
      formaAtualId,
      formaReceberId,
      idCondicaoPagamento,
      idContato,
      idEnderecoEntrega,
      idEnderecoRetirada,
      idTipoMovimentacao,
      ie,
      localEntregaDif,
      localRetiradaDif,
      observacao,
      pagamentosLista,
      recarregarSessao,
      total,
      ufCliente,
      vendedor,
    ],
  );

  function abrirOperacoes(form: null | 'sangria' | 'suprimento' | 'fechamento' | 'devolucao' = null) {
    setPainelOperacoes(true);
    setOperacaoForm(form);
    setMovimentoValor('');
    if (form === 'sangria' || form === 'suprimento') {
      setMovimentoTipo(form);
      window.setTimeout(() => movimentoValorRef.current?.focus(), 0);
    }
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (painelOperacoes && ev.shiftKey && !ev.ctrlKey && !ev.altKey) {
        const k = ev.key.toLowerCase();
        if (k === 's') {
          ev.preventDefault();
          abrirOperacoes('sangria');
          return;
        }
        if (k === 'r') {
          ev.preventDefault();
          abrirOperacoes('suprimento');
          return;
        }
        if (k === 'd') {
          ev.preventDefault();
          abrirOperacoes('devolucao');
          return;
        }
        if (k === 'f') {
          ev.preventDefault();
          abrirOperacoes('fechamento');
          return;
        }
      }
      if (ev.key === 'Escape' && painelOperacoes) {
        ev.preventDefault();
        if (operacaoForm) setOperacaoForm(null);
        else setPainelOperacoes(false);
        return;
      }
      if (ev.shiftKey && !ev.ctrlKey && !ev.altKey && ev.key.toLowerCase() === 'v' && !painelOperacoes) {
        ev.preventDefault();
        setMostrarVendedor(true);
        setMostrarCliente(false);
        window.setTimeout(() => vendedorRef.current?.focus(), 0);
        return;
      }
      if (ev.shiftKey && !ev.ctrlKey && !ev.altKey && ev.key.toLowerCase() === 'c' && !painelOperacoes) {
        ev.preventDefault();
        setMostrarCliente(true);
        setMostrarVendedor(false);
        window.setTimeout(() => clienteRef.current?.focus(), 0);
        return;
      }
      if (ev.key === 'F2') {
        ev.preventDefault();
        if (bloqueiaPorCaixa) fundoRef.current?.focus();
        else if (etapa === 'fechamento') pagamentoRef.current?.focus();
        else buscaRef.current?.focus();
      } else if (ev.key === 'F3' && etapa === 'fechamento' && destinoEfetivo === 'pedido') {
        ev.preventDefault();
        confirmarPagamentoRecebido();
      } else if (ev.key === 'F4') {
        ev.preventDefault();
        if (etapa === 'balcao') adicionarRascunho();
        else {
          setMostrarCliente(true);
          window.setTimeout(() => clienteRef.current?.focus(), 0);
        }
      } else if (ev.key === 'F6') {
        ev.preventDefault();
        if (etapa === 'balcao') irParaFechamento();
        else void confirmar(false, destinoEfetivo);
      } else if (ev.key === 'F8') {
        ev.preventDefault();
        if (etapa === 'fechamento') setEtapa('balcao');
      } else if (ev.key === 'Delete' && document.activeElement?.tagName !== 'INPUT') {
        setCarrinho((atual) => atual.filter((_, i) => i !== selecionado));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bloqueiaPorCaixa, confirmar, destinoEfetivo, etapa, operacaoForm, painelOperacoes, selecionado]);

  async function abrirCaixa() {
    try {
      await pdvJson('/api/pdv/caixa/abrir', { method: 'POST', body: { fundoTroco: Number(fundo.replace(',', '.')) || 0 } });
      recarregarSessao();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível abrir o caixa.');
    }
  }

  async function movimentar() {
    const valor = Number(movimentoValor.replace(',', '.')) || 0;
    if (valor <= 0) {
      setAviso('Informe o valor do movimento.');
      return;
    }
    try {
      await pdvJson('/api/pdv/caixa/movimento', {
        method: 'POST',
        body: { tipo: movimentoTipo, valor },
      });
      setMovimentoValor('');
      setOperacaoForm(null);
      setPainelOperacoes(false);
      setAviso('');
      recarregarSessao();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível registrar o movimento.');
    }
  }

  async function fecharCaixa() {
    try {
      await pdvJson('/api/pdv/caixa/fechar', { method: 'POST', body: {} });
      setOperacaoForm(null);
      setPainelOperacoes(false);
      setAviso('');
      recarregarSessao();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível fechar o caixa.');
    }
  }

  async function abrirEsperas() {
    setPainelEspera(true);
    try {
      const data = await pdvJson<{ vendas: VendaResposta[] }>('/api/pdv/vendas/espera');
      setEsperas(data.vendas);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Falha ao listar vendas em espera.');
    }
  }

  async function abrirOrcamentos() {
    setPainelOrcamentos(true);
    try {
      const data = await pdvJson<{ vendas: VendaResposta[] }>('/api/pdv/vendas/orcamentos');
      setOrcamentos(data.vendas);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Falha ao listar orçamentos.');
    }
  }

  async function transformar(id: number) {
    setEnviando(true);
    setAviso('');
    try {
      const venda = await pdvJson<VendaResposta>(`/api/pdv/vendas/${id}/transformar`, {
        method: 'POST',
        body: {
          // Nota fiscal: modal pós-gravação do pedido (não emite aqui).
          fiscal: 'nenhuma',
          pagamentos: pagamentos.filter((p) => p.valor > 0 && p.idFormaPagamento),
          clienteDocumento: documento,
          clienteContribuinte: contribuinte,
          clienteIe: ie,
          clienteUf: ufCliente,
        },
      });
      setPainelOrcamentos(false);
      if (venda.idPedidoNomus) {
        setFiscal('nenhuma');
        setModalFiscal(venda);
      } else {
        setComprovante(venda);
      }
      recarregarSessao();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível transformar o orçamento.');
    } finally {
      setEnviando(false);
    }
  }

  function fecharModalFiscalSemNota() {
    if (!modalFiscal || emitindoFiscal) return;
    setComprovante(modalFiscal);
    setModalFiscal(null);
    setFiscal('nenhuma');
  }

  async function confirmarEmissaoFiscal() {
    if (!modalFiscal || fiscal === 'nenhuma') {
      fecharModalFiscalSemNota();
      return;
    }
    setEmitindoFiscal(true);
    setAviso('');
    try {
      const venda = await pdvJson<VendaResposta>(`/api/pdv/vendas/${modalFiscal.id}/emitir-fiscal`, {
        method: 'POST',
        body: {
          fiscal,
          clienteDocumento: documento,
          clienteContribuinte: contribuinte,
          clienteIe: ie,
          clienteUf: ufCliente,
        },
      });
      setModalFiscal(null);
      setComprovante(venda);
      setFiscal('nenhuma');
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível emitir a nota.');
    } finally {
      setEmitindoFiscal(false);
    }
  }

  async function retomar(id: number) {
    try {
      const venda = await pdvJson<VendaResposta>(`/api/pdv/vendas/${id}/retomar`, { method: 'POST', body: {} });
      setCarrinho(
        venda.itens.map((item) => ({
          id: item.idProduto,
          codigo: item.codigo,
          descricao: item.descricao,
          ncm: item.ncm,
          origem: item.origem,
          gtin: '',
          idUnidadeMedida: item.idUnidadeMedida,
          sigla: '',
          preco: item.valorUnitario,
          descontoMaximo: 100,
          saldo: 999999,
          vinculado: true,
          quantidade: item.quantidade,
          descontoPercentual: item.descontoPercentual,
        })),
      );
      setPainelEspera(false);
      setAviso('Venda retomada no carrinho. Confira o estoque antes de concluir.');
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível retomar.');
    }
  }

  if (erroSessao && !sessao) {
    return <TelaMensagem tema={tema} titulo="Não foi possível abrir o PDV" texto={erroSessao} />;
  }
  if (!sessao) return <TelaMensagem tema={tema} titulo="Abrindo o PDV…" texto="Carregando a empresa do operador." />;

  const operadorAtual = sessao.operador;

  async function sair() {
    try {
      await logout(operadorAtual);
    } catch {
      /* a tela de login volta mesmo se o servidor não confirmar */
    }
    onSair?.();
  }

  if (!sessao.idEmpresa) {
    return (
      <TelaMensagem tema={tema}
        titulo="Usuário sem empresa"
        texto={`${sessao.operador} entrou no PDV, mas ainda não está vinculado a uma empresa. O vínculo é feito em PDV → Configuração.`}
      >
        {sessao.podeConfigurar ? (
          <Link to="/pdv/configuracao" className="rounded-lg bg-[#1E22AA] px-4 py-2 text-sm font-medium text-white">
            Abrir configuração
          </Link>
        ) : null}
        <button type="button" onClick={() => void sair()} className="rounded-lg border border-[var(--pdv-line)] px-4 py-2 text-sm">
          Sair
        </button>
      </TelaMensagem>
    );
  }

  const certOk = Boolean(sessao.certificado?.cnpj && sessao.certificado.validoAte && new Date(sessao.certificado.validoAte) > new Date());

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${tema}`}>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#FFAD00]/25 px-5 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="text-xl font-extrabold tracking-tight">
            <span className="text-[#FFAD00]">SÓ </span>
            <span>AÇO</span>
          </div>
          <div className="h-9 w-px bg-[var(--pdv-line)]" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{sessao.empresa || `Empresa ${sessao.idEmpresa}`}</h1>
            <p className="truncate text-xs text-[var(--pdv-muted)]">
              {sessao.operador}
              {sessao.uf ? ` · ${sessao.uf}` : ''}
              {exigeCaixa
                ? sessao.caixa
                  ? ' · Caixa aberto'
                  : ' · Caixa fechado'
                : ' · Força de vendas'}
              {modo === 'orcamento' ? ' · só orçamento' : modo === 'ambos' ? ' · orçamento e pedido' : ' · pedido direto'}
              {sessao.ignorarEstoque ? ' · sem checagem de estoque' : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={alternarTema} className={botaoContorno}>
            {claro ? 'Modo escuro' : 'Modo claro'}
          </button>
          <button type="button" onClick={() => void abrirEsperas()} className={botaoContorno}>
            Em espera
          </button>
          {modo === 'ambos' ? (
            <button type="button" onClick={() => void abrirOrcamentos()} className={botaoContorno}>
              Orçamentos
            </button>
          ) : null}
          {sessao.podeConfigurar ? (
            <Link to="/pdv/configuracao" className={botaoContorno}>
              Configuração
            </Link>
          ) : null}
          <button type="button" onClick={() => void sair()} className={botaoContorno}>
            Sair
          </button>
        </div>
      </header>

      {!sessao.configurado ? (
        <p className="mx-5 mt-3 rounded-lg border border-[#FFAD00]/40 bg-[#FFAD00]/10 px-3 py-2 text-sm text-[#FFAD00]">
          A empresa ainda não tem tabela de preço e setor de saída. A venda fica indisponível até a configuração.
        </p>
      ) : null}
      {aviso ? (
        <p className="mx-5 mt-3 rounded-lg border border-red-400/40 bg-red-950/60 px-3 py-2 text-sm text-red-100">{aviso}</p>
      ) : null}

      {exigeCaixa && !sessao.caixa && !bloqueiaPorCaixa && modo === 'ambos' ? (
        <section className="mx-5 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#FFAD00]/30 bg-[var(--pdv-field)] px-3 py-2 text-sm">
          <span className="text-xs text-[var(--pdv-muted)]">
            Caixa fechado. Orçamento liberado; pedido e transformação exigem abertura.
          </span>
          <input ref={fundoRef} value={fundo} onChange={(e) => setFundo(e.target.value)} placeholder="0,00" className={`${campo} w-28`} />
          <button type="button" onClick={() => void abrirCaixa()} className="rounded-lg bg-[#1E22AA] px-3 py-2 text-sm font-medium text-white">
            Abrir caixa
          </button>
        </section>
      ) : null}

      {bloqueiaPorCaixa ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] p-6 shadow-xl">
            <div className="mb-1 flex items-center gap-2 text-base font-semibold">
              <span aria-hidden className="text-lg">🖥️</span>
              Abra o caixa para começar a vender
            </div>
            <p className="mb-5 text-sm text-[var(--pdv-muted)]">
              Informe o dinheiro disponível no caixa antes da primeira venda.
              {sessao.modoOperacao === 'ambos' ? ' Orçamento pode ser gerado sem abrir o caixa.' : ''}
            </p>
            <label className="block text-sm text-[var(--pdv-muted)]">
              Valor da abertura
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--pdv-text)]">R$</span>
                <input
                  ref={fundoRef}
                  value={fundo}
                  onChange={(e) => setFundo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void abrirCaixa();
                    }
                  }}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`${campo} w-full`}
                  autoFocus
                />
              </div>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void sair()}
                className={botaoContorno}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void abrirCaixa()}
                className="rounded-xl bg-[#1E22AA] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Abrir caixa
              </button>
            </div>
            <p className="mt-4 text-[11px] text-[var(--pdv-faint)]">
              F2 foca o valor · Enter confirma a abertura
            </p>
          </div>
        </div>
      ) : etapa === 'balcao' ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#eef1f4]">
        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Localize um produto ou serviço</h2>
                <p className="text-xs text-slate-500">Digite o código ou o nome, ou passe o leitor de código de barras.</p>
              </div>
              <button type="button" className={botaoContorno} onClick={() => abrirOperacoes()}>
                Operações
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="relative">
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && produtos[0]) {
                      e.preventDefault();
                      escolherProdutoRascunho(produtos[0]);
                    }
                  }}
                  placeholder="Digite o código ou o nome"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-12 text-sm outline-none focus:border-[#1E22AA]"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  F2
                </span>
              </div>
              {carregandoBusca ? <p className="text-xs text-slate-500">Buscando…</p> : null}
              {busca.trim() && !carregandoBusca && produtos.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum produto nesta busca.</p>
              ) : null}
              {busca.trim() && produtos.length > 0 ? (
                <ul className="max-h-36 overflow-auto rounded-lg border border-slate-200 text-sm">
                  {produtos.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => escolherProdutoRascunho(p)}
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-slate-800">{p.codigo}</span>
                          <span className="text-slate-500"> · {p.descricao}</span>
                        </span>
                        <span className="shrink-0 text-slate-700">{brl(p.preco)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
                <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                  Sem imagem
                </div>
                <div className="grid gap-2">
                  <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 text-xs text-slate-600">
                    Código
                    <input readOnly value={rascunho?.codigo ?? ''} className={`${campoClaro} w-full`} />
                  </label>
                  <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 text-xs text-slate-600">
                    Quantidade
                    <input
                      value={rascunhoQtd}
                      onChange={(e) => setRascunhoQtd(e.target.value)}
                      className={`${campoClaro} w-full`}
                      inputMode="decimal"
                    />
                  </label>
                  <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 text-xs text-slate-600">
                    Valor unitário
                    <input readOnly value={rascunho ? brl(rascunho.preco) : ''} className={`${campoClaro} w-full`} />
                  </label>
                  <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 text-xs text-slate-600">
                    Desconto %
                    <input
                      value={rascunhoDesc}
                      onChange={(e) => setRascunhoDesc(e.target.value)}
                      placeholder="0"
                      className={`${campoClaro} w-full`}
                      inputMode="decimal"
                    />
                  </label>
                  <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 text-xs text-slate-600">
                    Valor total
                    <input
                      readOnly
                      value={
                        rascunho
                          ? brl(
                              (Number(String(rascunhoQtd).replace(',', '.')) || 0) *
                                rascunho.preco *
                                (1 - (Number(String(rascunhoDesc).replace(',', '.')) || 0) / 100),
                            )
                          : ''
                      }
                      className={`${campoClaro} w-full bg-slate-50`}
                    />
                  </label>
                </div>
              </div>
              {rascunho ? (
                <p className="truncate text-xs text-slate-500">{rascunho.descricao}</p>
              ) : null}
              <button
                type="button"
                onClick={() => adicionarRascunho()}
                disabled={!rascunho}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3d4654] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                + Adicionar produto
                <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px]">F4</span>
              </button>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:border-[#1E22AA]/50"
                onClick={() => {
                  setMostrarCliente(true);
                  window.setTimeout(() => clienteRef.current?.focus(), 0);
                }}
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Cliente · Shift C</div>
                <div className="truncate font-medium text-slate-800">{cliente?.nome || 'Ao consumidor'}</div>
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:border-[#1E22AA]/50"
                onClick={() => {
                  setMostrarVendedor(true);
                  setMostrarCliente(false);
                  window.setTimeout(() => vendedorRef.current?.focus(), 0);
                }}
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Vendedor · Shift V</div>
                <div className="truncate font-medium text-slate-800">{vendedor?.nome || sessao.operador}</div>
              </button>
            </div>
            {mostrarCliente ? (
              <div className="relative border-b border-slate-100 px-3 py-2">
                <input
                  ref={clienteRef}
                  value={clienteBusca}
                  onChange={(e) => {
                    setClienteBusca(e.target.value);
                    if (cliente && e.target.value !== cliente.nome) setCliente(null);
                  }}
                  placeholder="Buscar cliente"
                  className={`${campoClaro} w-full`}
                />
                <div className="mt-1 flex gap-2">
                  <button type="button" className="text-xs text-[#1E22AA]" onClick={() => { setFormCliente(formClienteVazio); setModalCliente(true); }}>
                    Novo
                  </button>
                  <button type="button" className="text-xs text-slate-500" onClick={() => setMostrarCliente(false)}>
                    Fechar
                  </button>
                </div>
                {clientes.length > 0 ? (
                  <ul className="absolute z-10 mt-1 max-h-40 w-[calc(100%-1.5rem)] overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow">
                    {clientes.map((c) => (
                      <li key={c.id}>
                        <button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => { selecionarCliente(c); setMostrarCliente(false); }}>
                          {c.nome}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {mostrarVendedor ? (
              <div className="relative border-b border-slate-100 px-3 py-2">
                <input
                  ref={vendedorRef}
                  value={vendedorBusca}
                  onChange={(e) => {
                    setVendedorBusca(e.target.value);
                    if (vendedor && e.target.value !== vendedor.nome) setVendedor(null);
                  }}
                  placeholder="Buscar vendedor"
                  className={`${campoClaro} w-full`}
                />
                <div className="mt-1 flex gap-2">
                  <button type="button" className="text-xs text-slate-500" onClick={() => setMostrarVendedor(false)}>
                    Fechar
                  </button>
                </div>
                {vendedores.length > 0 ? (
                  <ul className="absolute z-10 mt-1 max-h-40 w-[calc(100%-1.5rem)] overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow">
                    {vendedores.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => {
                            setVendedor(v);
                            setVendedorBusca(v.nome);
                            setMostrarVendedor(false);
                          }}
                        >
                          {v.nome}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">Digite ao menos 2 letras para buscar.</p>
                )}
              </div>
            ) : null}
            <ul className="min-h-0 flex-1 space-y-1 overflow-auto px-3 py-2">
              {carrinho.length === 0 ? (
                <li className="flex h-full min-h-[10rem] flex-col items-center justify-center text-center text-sm text-slate-400">
                  Nenhum item na venda. Busque um produto ao lado para começar.
                </li>
              ) : (
                carrinho.map((item, index) => (
                  <li key={`${item.id}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-2 text-sm">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelecionado(index)}>
                      <div className="truncate text-slate-800" title={rotuloItemCarrinho(item)}>
                        {rotuloItemCarrinho(item)}
                      </div>
                      {item.atributosItem && Object.keys(item.atributosItem).length ? (
                        <div className="truncate text-[11px] text-slate-500">
                          {Object.entries(item.atributosItem)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </div>
                      ) : null}
                      <div className="text-xs text-slate-500">{brl(liquido(item))}</div>
                    </button>
                    <div className="flex items-center gap-1">
                      <button type="button" className={passo} onClick={() => ajustarQtd(index, -1)}>−</button>
                      <button type="button" className={passo} onClick={() => ajustarQtd(index, 1)}>+</button>
                      <button type="button" className="px-1 text-slate-400 hover:text-red-500" onClick={() => setCarrinho((a) => a.filter((_, i) => i !== index))}>✕</button>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <div className="border-t border-slate-100 px-4 py-3">
              <div className="mb-3 flex items-end justify-between">
                <span className="text-sm text-slate-500">
                  Total do pedido · {carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'}
                </span>
                <span className="text-2xl font-bold text-slate-900">{brl(total)}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={enviando || carrinho.length === 0} onClick={() => void confirmar(true)} className={`${botaoContorno} disabled:opacity-40`}>
                  Espera
                </button>
                <button
                  type="button"
                  disabled={enviando || carrinho.length === 0 || !sessao.configurado}
                  onClick={() => irParaFechamento()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3d4654] px-3 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  ✓ Finalizar venda
                  <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px]">F6</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
        <footer className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
          <span><b>F1</b> Atalhos</span>
          <span><b>F2</b> Nova busca</span>
          <span><b>F4</b> Adicionar produto</span>
          <span><b>F6</b> Finalizar venda</span>
          <span><b>Shift+C</b> Cliente</span>
          <span><b>Shift+V</b> Vendedor</span>
        </footer>
      </div>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#eef1f4]">
        <div className="grid min-h-0 flex-1 items-stretch gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <section className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">
                    {destinoEfetivo === 'orcamento' ? 'Pagamento da proposta' : 'Receber'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {destinoEfetivo === 'orcamento'
                      ? 'Informe a forma e a condição de pagamento do orçamento.'
                      : 'Escolha a forma e confirme o valor recebido.'}
                  </p>
                </div>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">F2</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs text-slate-600 sm:col-span-2">
                  Forma de pagamento
                  <select
                    value={formaReceberId || ''}
                    onChange={(e) => setFormaReceberId(Number(e.target.value) || 0)}
                    className={`${campoClaro} mt-1 w-full`}
                  >
                    <option value="">Selecione</option>
                    {formasVisiveis.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </label>
                {destinoEfetivo === 'orcamento' ? (
                  <label className="block text-xs text-slate-600 sm:col-span-2">
                    Condição de pagamento
                    <select
                      value={idCondicaoPagamento || ''}
                      onChange={(e) => setIdCondicaoPagamento(Number(e.target.value) || 0)}
                      className={`${campoClaro} mt-1 w-full`}
                    >
                      <option value="">Selecione…</option>
                      {condicoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </label>
                ) : (
                  <>
                    <label className="block text-xs text-slate-600">
                      Valor recebido
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-slate-500">R$</span>
                        <input
                          ref={pagamentoRef}
                          value={valorReceber}
                          onChange={(e) => setValorReceber(e.target.value)}
                          className={`${campoClaro} w-full`}
                          inputMode="decimal"
                        />
                      </div>
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => confirmarPagamentoRecebido()}
                        className="w-full rounded-lg bg-[#3d4654] px-3 py-2.5 text-sm font-semibold text-white"
                      >
                        ✓ Confirmar <span className="ml-1 text-[10px] opacity-80">F3</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 shrink-0 text-sm font-semibold text-slate-800">Itens da venda</h2>
              <ul className="min-h-0 flex-1 space-y-1 overflow-auto text-sm">
                {carrinho.map((item, i) => (
                  <li key={`${item.id}-${i}`} className="flex justify-between gap-2 border-b border-slate-100 py-2">
                    <span className="min-w-0 truncate text-slate-700" title={rotuloItemCarrinho(item)}>
                      {rotuloItemCarrinho(item)}
                    </span>
                    <span className="shrink-0 font-medium">{brl(liquido(item))}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="grid shrink-0 grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                <div className="text-[10px] uppercase text-slate-400">Cliente</div>
                <div className="truncate font-medium text-slate-800">{cliente?.nome || 'Ao consumidor'}</div>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs shadow-sm hover:border-[#1E22AA]/50"
                onClick={() => {
                  setMostrarVendedor(true);
                  setEtapa('balcao');
                  window.setTimeout(() => vendedorRef.current?.focus(), 0);
                }}
              >
                <div className="text-[10px] uppercase text-slate-400">Vendedor</div>
                <div className="truncate font-medium text-slate-800">{vendedor?.nome || sessao.operador}</div>
              </button>
            </div>

            {destinoEfetivo === 'pedido' ? (
              <section className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-slate-800">Pagamentos recebidos</h2>
                {pagamentosLista.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">Nenhum pagamento ainda. Confirme à esquerda.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {pagamentosLista.map((p, i) => (
                      <li key={i} className="flex justify-between border-b border-slate-100 py-1.5">
                        <span>{formas.find((f) => f.id === p.idFormaPagamento)?.nome || `Forma ${p.idFormaPagamento}`}</span>
                        <span className="font-medium">{brl(p.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            <section className="flex min-h-0 flex-1 flex-col space-y-2 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="shrink-0 text-sm font-semibold text-slate-800">Dados da proposta (Nomus)</h2>
              {modo === 'ambos' ? (
                <fieldset className="flex flex-wrap gap-3 text-xs text-slate-600">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={destino === 'orcamento'} onChange={() => setDestino('orcamento')} /> Orçamento
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={destino === 'pedido'} onChange={() => setDestino('pedido')} /> Pedido
                  </label>
                </fieldset>
              ) : null}
              {destinoEfetivo !== 'orcamento' ? (
                <label className="block text-xs text-slate-600">
                  Condição de pagamento
                  <select value={idCondicaoPagamento || ''} onChange={(e) => setIdCondicaoPagamento(Number(e.target.value) || 0)} className={`${campoClaro} mt-1 w-full`}>
                    <option value="">Selecione…</option>
                    {condicoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </label>
              ) : null}
              {cliente && contatos.length > 0 ? (
                <label className="block text-xs text-slate-600">
                  Contato
                  <select value={idContato || ''} onChange={(e) => setIdContato(Number(e.target.value) || 0)} className={`${campoClaro} mt-1 w-full`}>
                    {contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </label>
              ) : (
                <p className="text-xs text-slate-400">Selecione um cliente para listar contatos.</p>
              )}
              <label className="block text-xs text-slate-600">
                Tipo de movimentação
                <select value={idTipoMovimentacao || ''} onChange={(e) => setIdTipoMovimentacao(Number(e.target.value) || 0)} className={`${campoClaro} mt-1 w-full`}>
                  <option value="">Selecione…</option>
                  {tiposMov.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </label>
              <label className="block text-xs text-slate-600">
                Validade da proposta
                <input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} className={`${campoClaro} mt-1 w-full`} />
              </label>
              <label className="flex min-h-[4.5rem] flex-1 flex-col text-xs text-slate-600">
                Observação
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={3}
                  className={`${campoClaro} mt-1 min-h-[4.5rem] w-full flex-1 resize-y`}
                />
              </label>
              {atributosPrincipais.map((atr) => (
                <label key={atr.nome} className="block text-xs text-slate-600">
                  {atr.nome}{atr.obrigatorio ? ' *' : ''}
                  {atr.formato === 'lista' ? (
                    <select
                      value={atributosValores[atr.nome] ?? ''}
                      onChange={(e) => setAtributosValores((a) => ({ ...a, [atr.nome]: e.target.value }))}
                      className={`${campoClaro} mt-1 w-full`}
                    >
                      <option value="">Selecione…</option>
                      {atr.opcoes.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  ) : (
                    <input
                      type={atr.formato === 'data' ? 'date' : 'text'}
                      value={atributosValores[atr.nome] ?? ''}
                      onChange={(e) => setAtributosValores((a) => ({ ...a, [atr.nome]: e.target.value }))}
                      className={`${campoClaro} mt-1 w-full`}
                    />
                  )}
                </label>
              ))}
              {atributoOutrasInfo ? (
                <label className="block text-xs text-slate-600">
                  Outras informações ({atributoOutrasInfo.nome})
                  <select
                    value={atributosValores[atributoOutrasInfo.nome] ?? ''}
                    onChange={(e) => setAtributosValores((a) => ({ ...a, [atributoOutrasInfo.nome]: e.target.value }))}
                    className={`${campoClaro} mt-1 w-full`}
                  >
                    <option value="">Selecione…</option>
                    {atributoOutrasInfo.opcoes.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={localRetiradaDif} onChange={(e) => setLocalRetiradaDif(e.target.checked)} />
                Local de retirada diferente do remetente
              </label>
              {localRetiradaDif ? (
                <select value={idEnderecoRetirada || ''} onChange={(e) => setIdEnderecoRetirada(Number(e.target.value) || 0)} className={`${campoClaro} w-full`}>
                  <option value="">Selecione o endereço…</option>
                  {enderecos.map((e) => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
                </select>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={localEntregaDif} onChange={(e) => setLocalEntregaDif(e.target.checked)} />
                Local de entrega diferente do destinatário
              </label>
              {localEntregaDif ? (
                <select value={idEnderecoEntrega || ''} onChange={(e) => setIdEnderecoEntrega(Number(e.target.value) || 0)} className={`${campoClaro} w-full`}>
                  <option value="">Selecione o endereço…</option>
                  {enderecos.map((e) => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
                </select>
              ) : null}
              {destinoEfetivo === 'pedido' ? (
                <p className="text-xs text-slate-500">
                  Após gravar o pedido, você poderá escolher Sem nota, NFC-e ou NF-e.
                </p>
              ) : null}
            </section>

            <section className="mt-auto shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-slate-400">Subtotal</div>
                  <div className="font-semibold text-slate-800">{brl(total)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-slate-400">Pagamentos</div>
                  <div className="font-semibold text-slate-800">{brl(pagoTotal)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-slate-400">Falta</div>
                  <div className="font-semibold text-slate-800">{brl(faltaPagar)}</div>
                </div>
              </div>
              <div className="mb-3 flex items-end justify-between">
                <span className="text-sm text-slate-500">Total a pagar</span>
                <span className="text-2xl font-bold text-slate-900">{brl(total)}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEtapa('balcao')} className="rounded-lg border border-red-300 px-3 py-3 text-sm font-medium text-red-600">
                  Cancelar <span className="text-[10px]">F8</span>
                </button>
                <button
                  type="button"
                  disabled={enviando || carrinho.length === 0 || (destinoEfetivo === 'pedido' && !caixaOk)}
                  onClick={() => void confirmar(false, destinoEfetivo)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3d4654] px-3 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {enviando
                    ? 'Gravando no Nomus…'
                    : destinoEfetivo === 'orcamento'
                      ? '✓ Finalizar orçamento'
                      : '✓ Finalizar venda'}
                  <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px]">F6</span>
                </button>
              </div>
            </section>
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
          <span><b>F2</b> Forma de pagamento</span>
          {destinoEfetivo === 'pedido' ? <span><b>F3</b> Confirmar pagamento</span> : null}
          <span><b>F6</b> Finalizar (Nomus)</span>
          <span><b>F8</b> Cancelar</span>
        </footer>
      </div>

      )}

      {modalAtributosItem && rascunho ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalAtributosItem(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">Atributos do item</h2>
              <p className="mt-1 truncate text-xs text-slate-500">
                {rascunho.codigo} — {rascunho.descricao}
              </p>
            </div>
            <div className="space-y-3 p-5">
              {atributosItem.map((atr) => (
                <label key={atr.nome} className="block text-xs text-slate-600">
                  {atr.nome}{atr.obrigatorio ? ' *' : ''}
                  {atr.formato === 'lista' ? (
                    <select
                      value={atributosItemDraft[atr.nome] ?? ''}
                      onChange={(e) => setAtributosItemDraft((a) => ({ ...a, [atr.nome]: e.target.value }))}
                      className={`${campoClaro} mt-1 w-full`}
                      autoFocus={atr.obrigatorio}
                    >
                      <option value="">Selecione…</option>
                      {atr.opcoes.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={atr.formato === 'data' ? 'date' : 'text'}
                      value={atributosItemDraft[atr.nome] ?? ''}
                      onChange={(e) => setAtributosItemDraft((a) => ({ ...a, [atr.nome]: e.target.value }))}
                      className={`${campoClaro} mt-1 w-full`}
                      autoFocus={atr.obrigatorio}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button type="button" className={botaoContorno} onClick={() => setModalAtributosItem(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#3d4654] px-4 py-2 text-sm font-semibold text-white"
                onClick={() => confirmarAdicionarProduto(atributosItemDraft)}
              >
                Adicionar ao carrinho
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {painelOperacoes ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={() => { setPainelOperacoes(false); setOperacaoForm(null); }}>
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden>▦</span>
                <h2 className="text-base font-semibold text-slate-800">Operações do PDV</h2>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => { setPainelOperacoes(false); setOperacaoForm(null); }}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {operacaoForm === 'sangria' || operacaoForm === 'suprimento' ? (
              <div className="space-y-4 p-5">
                <button type="button" className="text-xs font-medium text-[#1E22AA]" onClick={() => setOperacaoForm(null)}>
                  ← Voltar
                </button>
                <h3 className="text-sm font-semibold text-slate-800">
                  {operacaoForm === 'sangria' ? 'Realizar sangria' : 'Realizar reforço'}
                </h3>
                {!sessao.caixa ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Abra o caixa antes de registrar movimentos.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      Fundo atual: {brl(sessao.caixa.fundoTroco)}
                    </p>
                    <label className="block text-xs text-slate-600">
                      Valor
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-slate-500">R$</span>
                        <input
                          ref={movimentoValorRef}
                          value={movimentoValor}
                          onChange={(e) => setMovimentoValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void movimentar();
                            }
                          }}
                          inputMode="decimal"
                          placeholder="0,00"
                          className={`${campoClaro} w-full`}
                        />
                      </div>
                    </label>
                    <div className="flex justify-end gap-2">
                      <button type="button" className={botaoContorno} onClick={() => setOperacaoForm(null)}>Cancelar</button>
                      <button
                        type="button"
                        className="rounded-lg bg-[#3d4654] px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => void movimentar()}
                      >
                        Confirmar
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : operacaoForm === 'fechamento' ? (
              <div className="space-y-4 p-5">
                <button type="button" className="text-xs font-medium text-[#1E22AA]" onClick={() => setOperacaoForm(null)}>
                  ← Voltar
                </button>
                <h3 className="text-sm font-semibold text-slate-800">Fechar caixa</h3>
                {!sessao.caixa ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Não há caixa aberto neste momento.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">
                      Confira os valores da gaveta com os registros de entradas e saídas antes de encerrar.
                      Fundo registrado: <strong>{brl(sessao.caixa.fundoTroco)}</strong>.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button type="button" className={botaoContorno} onClick={() => setOperacaoForm(null)}>Cancelar</button>
                      <button
                        type="button"
                        className="rounded-lg bg-[#1E22AA] px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => void fecharCaixa()}
                      >
                        Confirmar fechamento
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : operacaoForm === 'devolucao' ? (
              <div className="space-y-4 p-5">
                <button type="button" className="text-xs font-medium text-[#1E22AA]" onClick={() => setOperacaoForm(null)}>
                  ← Voltar
                </button>
                <h3 className="text-sm font-semibold text-slate-800">Troca ou devolução</h3>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  Esta operação ainda não está disponível neste PDV. Use o fluxo de vendas/orçamentos no Nomus para devoluções.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <article className="rounded-xl border border-slate-100 p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-lg text-pink-600" aria-hidden>↗</div>
                    <h3 className="text-sm font-semibold text-slate-800">Sangria</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      A sangria caracteriza-se pela retirada de valor do caixa, ou seja, você retira um determinado valor da gaveta do operador para guardar em outro local mais seguro.
                    </p>
                    <button type="button" className="mt-3 text-xs font-semibold text-[#1E22AA]" onClick={() => abrirOperacoes('sangria')}>
                      Realizar sangria (Shift + S) ›
                    </button>
                  </article>
                  <article className="rounded-xl border border-slate-100 p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-600" aria-hidden>↘</div>
                    <h3 className="text-sm font-semibold text-slate-800">Reforço</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      O reforço consiste em incluir valor no seu caixa, sempre que necessário. Esta transação ocorre normalmente quando é adicionado troco na gaveta do operador.
                    </p>
                    <button type="button" className="mt-3 text-xs font-semibold text-[#1E22AA]" onClick={() => abrirOperacoes('suprimento')}>
                      Realizar reforço (Shift + R) ›
                    </button>
                  </article>
                  <article className="rounded-xl border border-slate-100 p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-lg text-orange-600" aria-hidden>↩</div>
                    <h3 className="text-sm font-semibold text-slate-800">Troca ou devolução</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      A troca ou devolução ocorre quando o cliente desistir de uma compra ou o produto apresenta algum defeito. O produto é trocado ou volta para o estoque.
                    </p>
                    <button type="button" className="mt-3 text-xs font-semibold text-[#1E22AA]" onClick={() => abrirOperacoes('devolucao')}>
                      Realizar devolução (Shift + D) ›
                    </button>
                  </article>
                  <article className="rounded-xl border border-slate-100 p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-lg text-sky-600" aria-hidden>$</div>
                    <h3 className="text-sm font-semibold text-slate-800">Fechamento</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      O fechamento de caixa envolve um trabalho cuidadoso de conferência e checagem dos valores que estão no caixa com o saldo dos registros de entradas e saídas.
                    </p>
                    <button type="button" className="mt-3 text-xs font-semibold text-[#1E22AA]" onClick={() => abrirOperacoes('fechamento')}>
                      Fechar caixa (Shift + F) ›
                    </button>
                  </article>
                </div>
                <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm" aria-hidden>🖥</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-700">Se a internet cair, este computador para de vender</div>
                    <div className="text-xs text-slate-500">Venda offline ainda não está disponível neste PDV.</div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 opacity-60"
                    title="Indisponível"
                    aria-label="Venda offline indisponível"
                  >
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {painelEspera ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] p-4 text-sm">
            <div className="mb-3 flex items-center justify-between">
              <strong>Em espera</strong>
              <button type="button" onClick={() => setPainelEspera(false)} className={botaoContorno}>Fechar</button>
            </div>
            {esperas.length === 0 ? <p className="text-[var(--pdv-faint)]">Nenhuma venda em espera.</p> : null}
            <ul>
              {esperas.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 border-t border-[var(--pdv-line)] py-2">
                  <span>#{v.id} · {brl(v.total)} · {v.clienteNome || 'Consumidor'}</span>
                  <button type="button" className={botaoContorno} onClick={() => void retomar(v.id)}>Retomar</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {painelOrcamentos ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] p-4 text-sm">
            <div className="mb-3 flex items-center justify-between">
              <strong>Orçamentos para transformar</strong>
              <button type="button" onClick={() => setPainelOrcamentos(false)} className={botaoContorno}>Fechar</button>
            </div>
            <p className="mb-2 text-xs text-[var(--pdv-muted)]">
              {exigeCaixa
                ? 'Informe o pagamento no painel lateral e abra o caixa antes de transformar em pedido.'
                : 'Informe o pagamento no painel lateral e transforme o orçamento em pedido.'}
            </p>
            {orcamentos.length === 0 ? <p className="text-[var(--pdv-faint)]">Nenhum orçamento pendente.</p> : null}
            <ul>
              {orcamentos.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 border-t border-[var(--pdv-line)] py-2">
                  <span>
                    #{v.id} · proposta {v.idPropostaNomus ?? '—'} · {brl(v.total)} · {v.clienteNome || 'Consumidor'}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={botaoContorno}
                      disabled={!v.idPropostaNomus}
                      onClick={() => {
                        void abrirPropostaPdf(v.id, true).catch((e) =>
                          setAviso(e instanceof Error ? e.message : 'Falha ao reimprimir.'),
                        );
                      }}
                    >
                      Reimprimir
                    </button>
                    <button
                      type="button"
                      className={botaoContorno}
                      disabled={enviando || !caixaOk}
                      onClick={() => void transformar(v.id)}
                    >
                      Transformar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {modalCliente ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={() => !salvandoCliente && setModalCliente(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdv-cliente-titulo"
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] p-5 text-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="pdv-cliente-titulo" className="text-base font-semibold">Cadastrar cliente</h3>
                <p className="mt-1 text-xs text-[var(--pdv-muted)]">
                  Obrigatórios: nome, CPF/CNPJ e tipo de contribuinte ICMS. Demais campos são opcionais.
                </p>
              </div>
              <button type="button" className={botaoContorno} disabled={salvandoCliente} onClick={() => setModalCliente(false)}>
                Fechar
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs text-[var(--pdv-muted)] sm:col-span-2">
                Tipo de pessoa
                <select
                  value={formCliente.tipoPessoa}
                  onChange={(e) =>
                    setFormCliente((f) => ({ ...f, tipoPessoa: Number(e.target.value) === 1 ? 1 : 2 }))
                  }
                  className={`${campo} mt-1 w-full`}
                >
                  <option value={2}>Pessoa física</option>
                  <option value={1}>Pessoa jurídica</option>
                </select>
              </label>
              <label className="block text-xs text-[var(--pdv-muted)] sm:col-span-2">
                Nome *
                <input
                  value={formCliente.nome}
                  onChange={(e) => setFormCliente((f) => ({ ...f, nome: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)] sm:col-span-2">
                Razão social
                <input
                  value={formCliente.razaoSocial}
                  onChange={(e) => setFormCliente((f) => ({ ...f, razaoSocial: e.target.value }))}
                  placeholder="Se vazio, usa o nome"
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)]">
                {formCliente.tipoPessoa === 1 ? 'CNPJ *' : 'CPF *'}
                <input
                  value={formCliente.documento}
                  onChange={(e) => setFormCliente((f) => ({ ...f, documento: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)]">
                Contribuinte ICMS *
                <select
                  value={formCliente.tipoContribuinteICMS}
                  onChange={(e) =>
                    setFormCliente((f) => ({
                      ...f,
                      tipoContribuinteICMS: ([1, 2, 3].includes(Number(e.target.value))
                        ? Number(e.target.value)
                        : 3) as 1 | 2 | 3,
                    }))
                  }
                  className={`${campo} mt-1 w-full`}
                >
                  <option value={3}>Não contribuinte</option>
                  <option value={1}>Contribuinte</option>
                  <option value={2}>Isento</option>
                </select>
              </label>
              <label className="block text-xs text-[var(--pdv-muted)]">
                IE
                <input
                  value={formCliente.inscricaoEstadual}
                  onChange={(e) => setFormCliente((f) => ({ ...f, inscricaoEstadual: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)]">
                Telefone
                <input
                  value={formCliente.telefone}
                  onChange={(e) => setFormCliente((f) => ({ ...f, telefone: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)] sm:col-span-2">
                E-mail
                <input
                  value={formCliente.email}
                  onChange={(e) => setFormCliente((f) => ({ ...f, email: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)]">
                CEP
                <input
                  value={formCliente.cep}
                  onChange={(e) => setFormCliente((f) => ({ ...f, cep: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)]">
                UF
                <input
                  value={formCliente.uf}
                  onChange={(e) => setFormCliente((f) => ({ ...f, uf: e.target.value.toUpperCase() }))}
                  maxLength={2}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)] sm:col-span-2">
                Endereço
                <input
                  value={formCliente.endereco}
                  onChange={(e) => setFormCliente((f) => ({ ...f, endereco: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)]">
                Número
                <input
                  value={formCliente.numero}
                  onChange={(e) => setFormCliente((f) => ({ ...f, numero: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)]">
                Bairro
                <input
                  value={formCliente.bairro}
                  onChange={(e) => setFormCliente((f) => ({ ...f, bairro: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-[var(--pdv-muted)] sm:col-span-2">
                Município
                <input
                  value={formCliente.municipio}
                  onChange={(e) => setFormCliente((f) => ({ ...f, municipio: e.target.value }))}
                  className={`${campo} mt-1 w-full`}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={botaoContorno} disabled={salvandoCliente} onClick={() => setModalCliente(false)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoCliente}
                onClick={() => void salvarClienteNovo()}
                className="rounded-xl bg-[#1E22AA] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {salvandoCliente ? 'Salvando…' : 'Salvar no Nomus'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalFiscal ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] p-5 text-sm text-[var(--pdv-text)] shadow-xl">
            <h2 className="text-base font-semibold">Pedido gravado · emitir nota?</h2>
            <p className="mt-2 text-xs text-[var(--pdv-muted)]">
              Pedido Nomus {modalFiscal.idPedidoNomus ?? '—'} · venda {modalFiscal.id} · {brl(modalFiscal.total)}
            </p>
            <fieldset className="mt-4 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="modal-fiscal"
                  checked={fiscal === 'nenhuma'}
                  onChange={() => setFiscal('nenhuma')}
                  disabled={emitindoFiscal}
                />
                Sem nota
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="modal-fiscal"
                  checked={fiscal === 'nfce'}
                  onChange={() => setFiscal('nfce')}
                  disabled={emitindoFiscal || !certOk || !sessao.certificado?.temCsc}
                />
                NFC-e
                {!certOk || !sessao.certificado?.temCsc ? (
                  <span className="text-xs text-[var(--pdv-muted)]">(certificado/CSC)</span>
                ) : null}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="modal-fiscal"
                  checked={fiscal === 'nfe'}
                  onChange={() => setFiscal('nfe')}
                  disabled={emitindoFiscal || !certOk}
                />
                NF-e
                {!certOk ? <span className="text-xs text-[var(--pdv-muted)]">(certificado)</span> : null}
              </label>
            </fieldset>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={botaoContorno}
                disabled={emitindoFiscal}
                onClick={fecharModalFiscalSemNota}
              >
                Sem nota
              </button>
              <button
                type="button"
                disabled={emitindoFiscal || (fiscal !== 'nenhuma' && !certOk) || (fiscal === 'nfce' && !sessao.certificado?.temCsc)}
                onClick={() => void confirmarEmissaoFiscal()}
                className="rounded-xl bg-[#1E22AA] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {emitindoFiscal ? 'Emitindo…' : fiscal === 'nenhuma' ? 'Continuar' : fiscal === 'nfce' ? 'Emitir NFC-e' : 'Emitir NF-e'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {comprovante ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 print:static print:bg-white print:p-0">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] p-5 text-sm print:max-h-none print:border-0 print:bg-white print:text-black">
            <div className="mb-3 flex items-start justify-between gap-3">
              <strong>
                {comprovante.status === 'orcamento'
                  ? `Orçamento ${comprovante.id}`
                  : comprovante.qrCode
                    ? `Cupom NFC-e da venda ${comprovante.id}`
                    : comprovante.chave
                      ? `DANFE da venda ${comprovante.id}`
                      : `Comprovante da venda ${comprovante.id}`}
              </strong>
              <div className="flex gap-2 print:hidden">
                {comprovante.idPropostaNomus ? (
                  <button
                    type="button"
                    onClick={() => {
                      void abrirPropostaPdf(comprovante.id, true).catch((e) =>
                        setAviso(e instanceof Error ? e.message : 'Falha ao reimprimir.'),
                      );
                    }}
                    className={botaoContorno}
                  >
                    Reimprimir PDF
                  </button>
                ) : null}
                <button type="button" onClick={() => window.print()} className={botaoContorno}>
                  Imprimir
                </button>
              </div>
            </div>
            <p>
              Proposta Nomus: {comprovante.idPropostaNomus ?? '—'}
              {' · '}
              Pedido Nomus: {comprovante.idPedidoNomus ?? '—'}
              {' · '}
              Documento: {comprovante.idDocumentoNomus ?? '—'}
            </p>
            <p>IPI médio lido do Nomus: {comprovante.aliquotaIpiMedia}%</p>
            <ul className="my-3 space-y-1">
              {comprovante.itens.map((item, i) => (
                <li key={i}>
                  {item.codigo} {item.descricao} · {item.quantidade} × {brl(item.valorUnitario)} · IPI {item.aliquotaIpi}% · NCM {item.ncm || '—'}
                </li>
              ))}
            </ul>
            <p>Total {brl(comprovante.total)}</p>
            {comprovante.statusFiscal ? (
              <p className="mt-2">
                {comprovante.statusFiscal}: {comprovante.motivoFiscal}
                {comprovante.chave ? ` · chave ${comprovante.chave}` : ''}
                {comprovante.protocolo ? ` · protocolo ${comprovante.protocolo}` : ''}
              </p>
            ) : null}
            {comprovante.qrCode ? <img src={comprovante.qrCode} alt="QR Code da NFC-e" className="mt-3 h-36 w-36" /> : null}
            <button type="button" className={`${botaoContorno} mt-4 print:hidden`} onClick={() => setComprovante(null)}>Fechar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const botaoContorno = 'inline-flex items-center rounded-lg border border-[var(--pdv-line)] px-3 py-2 text-xs font-medium text-[var(--pdv-text)] hover:border-[#FFAD00]/70';
const campo = 'rounded-lg border border-[var(--pdv-line)] bg-[var(--pdv-field)] px-2 py-2 text-sm text-[var(--pdv-text)] outline-none placeholder:text-[var(--pdv-faint)]';
const campoClaro = 'rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400';
const passo = 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-sm';

function ordenarFormas(lista: Forma[]) {
  const peso = (nome: string) => {
    const n = nome.toLowerCase();
    if (n.includes('dinheiro') || n.includes('espécie') || n.includes('especie')) return 0;
    if (n.includes('pix')) return 1;
    if (n.includes('cart')) return 2;
    return 3;
  };
  return [...lista].sort((a, b) => peso(a.nome) - peso(b.nome) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function TelaMensagem({ tema, titulo, texto, children }: { tema: string; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${tema}`}>
      <div className="text-2xl font-extrabold tracking-tight">
        <span className="text-[#FFAD00]">SÓ </span>AÇO
      </div>
      <h1 className="text-lg font-semibold">{titulo}</h1>
      <p className="max-w-md text-sm text-[var(--pdv-muted)]">{texto}</p>
      {children ? <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}
