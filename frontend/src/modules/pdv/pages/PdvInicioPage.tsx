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

type ItemCarrinho = Produto & { quantidade: number; descontoPercentual: number };

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
};
type Cliente = { id: number; nome: string; cpf?: string; cnpj?: string };

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

function liquido(item: ItemCarrinho): number {
  return item.quantidade * item.preco * (1 - item.descontoPercentual / 100);
}

export default function PdvInicioPage({ onSair }: { onSair?: () => void }) {
  const buscaRef = useRef<HTMLInputElement>(null);
  const clienteRef = useRef<HTMLInputElement>(null);
  const pagamentoRef = useRef<HTMLInputElement>(null);
  const fundoRef = useRef<HTMLInputElement>(null);

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [erroSessao, setErroSessao] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [paginaProdutos, setPaginaProdutos] = useState(1);
  const [temMaisProdutos, setTemMaisProdutos] = useState(false);
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
  const [esperas, setEsperas] = useState<VendaResposta[]>([]);
  const [orcamentos, setOrcamentos] = useState<VendaResposta[]>([]);
  const [painelEspera, setPainelEspera] = useState(false);
  const [painelOrcamentos, setPainelOrcamentos] = useState(false);
  const [fundo, setFundo] = useState('0');
  const [movimentoValor, setMovimentoValor] = useState('');
  const [movimentoTipo, setMovimentoTipo] = useState<'suprimento' | 'sangria'>('suprimento');
  const [painelCaixa, setPainelCaixa] = useState(false);
  const [mostrarCliente, setMostrarCliente] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [formCliente, setFormCliente] = useState<FormClienteNovo>(formClienteVazio);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [claro, setClaro] = useState(() => localStorage.getItem('pdv_tema') === 'claro');
  const tema = claro ? 'pdv-shell pdv-claro' : 'pdv-shell';

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
          setPagamentos((atual) =>
            atual.map((p, i) => (i === 0 && !p.idFormaPagamento ? { ...p, idFormaPagamento: formaPadrao.id } : p)),
          );
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
              setPagamentos((atual) =>
                atual.map((p, i) => (i === 0 && !p.idFormaPagamento ? { ...p, idFormaPagamento: primeira.id } : p)),
              );
            }
          })
          .catch(() => setFormas([]));
      });
  }, [recarregarSessao]);

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
  const formaAtualId = pagamentos[0]?.idFormaPagamento ?? 0;

  function escolherForma(id: number) {
    setPagamentos([{ idFormaPagamento: id, valor: total }]);
    setAviso('');
  }

  useEffect(() => {
    if (!formaAtualId) return;
    setPagamentos((atual) => {
      if (atual.length !== 1 || atual[0].idFormaPagamento !== formaAtualId) return atual;
      if (Math.abs(atual[0].valor - total) < 0.009) return atual;
      return [{ idFormaPagamento: formaAtualId, valor: total }];
    });
  }, [formaAtualId, total]);

  const atributosPrincipais = useMemo(
    () =>
      atributosOpcoes.filter((a) =>
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
  const atributoOutrasInfo = useMemo(
    () => atributosOpcoes.find((a) => a.nome === 'FRETE') ?? null,
    [atributosOpcoes],
  );

  const ignorarEstoque = Boolean(sessao?.ignorarEstoque);

  const adicionar = (produto: Produto) => {
    if (!ignorarEstoque && (!produto.vinculado || produto.saldo <= 0)) {
      setAviso(`${produto.codigo || produto.descricao} está sem estoque nesta empresa.`);
      return;
    }
    setAviso('');
    setCarrinho((atual) => {
      const idx = atual.findIndex((i) => i.id === produto.id);
      if (idx >= 0) {
        const item = atual[idx];
        if (!ignorarEstoque && item.quantidade + 1 > produto.saldo) {
          setAviso(`Só há ${produto.saldo} em estoque.`);
          return atual;
        }
        const copia = [...atual];
        copia[idx] = { ...item, quantidade: item.quantidade + 1, saldo: produto.saldo };
        return copia;
      }
      return [...atual, { ...produto, quantidade: 1, descontoPercentual: 0 }];
    });
  };

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
      if (!espera && destinoEscolhido === 'orcamento') {
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
        if (!formaAtualId) {
          setAviso('Selecione a forma de pagamento.');
          return;
        }
        for (const atr of atributosPrincipais) {
          if (atr.obrigatorio && !String(atributosValores[atr.nome] ?? '').trim()) {
            setAviso(`Preencha o atributo: ${atr.nome}`);
            return;
          }
        }
      }
      setEnviando(true);
      setAviso('');
      try {
        const atributosProposta = Object.entries(atributosValores)
          .map(([nomeAtributo, valorBruto]) => {
            let valorAtributo = String(valorBruto ?? '').trim();
            const meta = atributosOpcoes.find((a) => a.nome === nomeAtributo);
            if (meta?.formato === 'data') {
              const m = valorAtributo.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (m) valorAtributo = `${m[3]}/${m[2]}/${m[1]}`;
            }
            return { nomeAtributo, valorAtributo };
          })
          .filter((a) => a.nomeAtributo && a.valorAtributo);
        const venda = await pdvJson<VendaResposta>('/api/pdv/vendas', {
          method: 'POST',
          body: {
            espera,
            destino: destinoEscolhido,
            fiscal: espera || destinoEscolhido === 'orcamento' ? 'nenhuma' : fiscal,
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
            })),
            pagamentos:
              espera || destinoEscolhido === 'orcamento'
                ? []
                : pagamentos.filter((p) => p.valor > 0 && p.idFormaPagamento),
            idPessoaCliente: cliente?.id ?? null,
            clienteNome: cliente?.nome ?? '',
            clienteDocumento: documento,
            clienteContribuinte: contribuinte,
            clienteIe: ie,
            clienteUf: ufCliente,
            observacao,
            idFormaPagamento: formaAtualId || null,
            idCondicaoPagamento: idCondicaoPagamento || null,
            idTipoMovimentacao: idTipoMovimentacao || null,
            idContato: idContato || null,
            dataValidade: destinoEscolhido === 'orcamento' ? dataValidade : undefined,
            atributosProposta: destinoEscolhido === 'orcamento' ? atributosProposta : [],
            localRetiradaDifEnderecoRemetente: localRetiradaDif,
            idEnderecoLocalRetirada: localRetiradaDif ? idEnderecoRetirada || null : null,
            localEntregaDifEnderecoDestinatario: localEntregaDif,
            idEnderecoLocalEntrega: localEntregaDif ? idEnderecoEntrega || null : null,
          },
        });
        if (espera) {
          setAviso(`Venda ${venda.id} ficou em espera.`);
        } else {
          setComprovante(venda);
          if (venda.status === 'orcamento' && venda.idPropostaNomus) {
            try {
              await abrirPropostaPdf(venda.id, true);
            } catch (e) {
              setAviso(e instanceof Error ? e.message : 'Orçamento gravado, mas o PDF não abriu.');
            }
          }
        }
        setCarrinho([]);
        setPagamentos((atual) => atual.map((p) => ({ ...p, valor: 0 })));
        setObservacao('');
        recarregarSessao();
      } catch (e) {
        setAviso(e instanceof Error ? e.message : 'Não foi possível concluir a venda.');
      } finally {
        setEnviando(false);
      }
    },
    [
      atributosOpcoes,
      atributosPrincipais,
      atributosValores,
      carrinho,
      cliente,
      contribuinte,
      dataValidade,
      destinoEfetivo,
      documento,
      fiscal,
      formaAtualId,
      idCondicaoPagamento,
      idContato,
      idEnderecoEntrega,
      idEnderecoRetirada,
      idTipoMovimentacao,
      ie,
      localEntregaDif,
      localRetiradaDif,
      observacao,
      pagamentos,
      recarregarSessao,
      ufCliente,
    ],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'F2') {
        ev.preventDefault();
        if (bloqueiaPorCaixa) fundoRef.current?.focus();
        else buscaRef.current?.focus();
      } else if (ev.key === 'F4') {
        ev.preventDefault();
        setMostrarCliente(true);
        window.setTimeout(() => clienteRef.current?.focus(), 0);
      } else if (ev.key === 'F8') {
        ev.preventDefault();
        pagamentoRef.current?.focus();
      } else if (ev.key === 'F9') {
        ev.preventDefault();
        void confirmar(false);
      } else if (ev.key === 'Delete' && document.activeElement?.tagName !== 'INPUT') {
        setCarrinho((atual) => atual.filter((_, i) => i !== selecionado));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bloqueiaPorCaixa, confirmar, selecionado]);

  async function abrirCaixa() {
    try {
      await pdvJson('/api/pdv/caixa/abrir', { method: 'POST', body: { fundoTroco: Number(fundo.replace(',', '.')) || 0 } });
      recarregarSessao();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível abrir o caixa.');
    }
  }

  async function movimentar() {
    try {
      await pdvJson('/api/pdv/caixa/movimento', {
        method: 'POST',
        body: { tipo: movimentoTipo, valor: Number(movimentoValor.replace(',', '.')) || 0 },
      });
      setMovimentoValor('');
      recarregarSessao();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível registrar o movimento.');
    }
  }

  async function fecharCaixa() {
    try {
      await pdvJson('/api/pdv/caixa/fechar', { method: 'POST', body: {} });
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
          fiscal,
          pagamentos: pagamentos.filter((p) => p.valor > 0 && p.idFormaPagamento),
          clienteDocumento: documento,
          clienteContribuinte: contribuinte,
          clienteIe: ie,
          clienteUf: ufCliente,
        },
      });
      setPainelOrcamentos(false);
      setComprovante(venda);
      recarregarSessao();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível transformar o orçamento.');
    } finally {
      setEnviando(false);
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

  async function sair() {
    try {
      await logout(sessao.operador);
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
  const clienteAberto = mostrarCliente || fiscal === 'nfe';

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
          {exigeCaixa ? (
            <button type="button" onClick={() => setPainelCaixa((v) => !v)} className={botaoContorno}>
              Caixa
            </button>
          ) : null}
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

      {exigeCaixa && painelCaixa && sessao.caixa ? (
        <section className="mx-5 mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] p-3 text-sm">
          <span className="text-xs text-[var(--pdv-muted)]">Fundo {brl(sessao.caixa.fundoTroco)}</span>
          <select value={movimentoTipo} onChange={(e) => setMovimentoTipo(e.target.value as 'suprimento' | 'sangria')} className={campo}>
            <option value="suprimento">Suprimento</option>
            <option value="sangria">Sangria</option>
          </select>
          <input value={movimentoValor} onChange={(e) => setMovimentoValor(e.target.value)} placeholder="Valor" className={`${campo} w-28`} />
          <button type="button" onClick={() => void movimentar()} className={botaoContorno}>Registrar</button>
          <button type="button" onClick={() => void fecharCaixa()} className={botaoContorno}>Fechar caixa</button>
        </section>
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
              {modo === 'ambos' ? ' Orçamento pode ser gerado sem abrir o caixa.' : ''}
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
      ) : (
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="flex min-h-0 flex-col gap-4 overflow-hidden p-5">
          <div className="flex flex-col gap-2">
            <input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, GTIN ou nome (ex.: SM 00852)."
              className="w-full rounded-xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] px-4 py-3 text-sm outline-none placeholder:text-[var(--pdv-faint)] focus:border-[#FFAD00]/60"
            />
            <div className="relative">
              <div className="flex items-center gap-2">
                <input
                  ref={clienteRef}
                  value={clienteBusca}
                  onChange={(e) => {
                    setClienteBusca(e.target.value);
                    setMostrarCliente(true);
                    if (cliente && e.target.value !== cliente.nome) setCliente(null);
                  }}
                  onFocus={() => setMostrarCliente(true)}
                  placeholder="Cliente cadastrado (F4) — nome, CPF ou CNPJ"
                  className="w-full rounded-xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--pdv-faint)] focus:border-[#FFAD00]/60"
                />
                {cliente ? (
                  <button
                    type="button"
                    className={botaoContorno}
                    title="Limpar cliente"
                    onClick={() => {
                      setCliente(null);
                      setClienteBusca('');
                      setDocumento('');
                    }}
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
              {mostrarCliente && clientes.length > 0 ? (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] text-sm shadow-lg">
                  {clientes.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-[var(--pdv-hover)]"
                        onClick={() => selecionarCliente(c)}
                      >
                        {c.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {cliente ? (
                <p className="mt-1 text-xs text-[var(--pdv-muted)]">Selecionado: {cliente.nome}</p>
              ) : null}
            </div>
          </div>
          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
            {carregandoBusca ? <p className="text-sm text-[var(--pdv-faint)]">Buscando…</p> : null}
            {!carregandoBusca && produtos.length === 0 ? (
              <p className="text-sm text-[var(--pdv-faint)]">Nenhum produto nesta busca.</p>
            ) : null}
            {produtos.map((produto) => {
              const semSaldo = !produto.vinculado || produto.saldo <= 0;
              const sem = semSaldo && !sessao.ignorarEstoque;
              return (
                <button
                  key={produto.id}
                  type="button"
                  disabled={sem}
                  onClick={() => adicionar(produto)}
                  className="flex min-h-[7.5rem] flex-col justify-between rounded-2xl border border-[var(--pdv-line)] bg-[var(--pdv-card)] p-4 text-left transition hover:border-[#FFAD00]/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div>
                    <div className="line-clamp-2 text-sm font-medium leading-snug">{produto.descricao || produto.codigo}</div>
                    {produto.codigo && produto.descricao ? (
                      <div className="mt-1 text-[11px] text-[var(--pdv-faint)]">{produto.codigo}</div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="text-base font-semibold">{brl(produto.preco)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${semSaldo ? 'bg-red-950 text-red-200' : 'bg-[#FFAD00] text-black'}`}>
                      {semSaldo ? 'sem saldo' : `saldo ${formatarSaldo(produto.saldo)}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 pt-1">
            <button
              type="button"
              className={`${botaoContorno} disabled:opacity-40`}
              disabled={carregandoBusca || paginaProdutos <= 1}
              onClick={() => setPaginaProdutos((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span className="text-xs text-[var(--pdv-muted)]">
              Página {paginaProdutos}
              {produtos.length > 0 ? ` · ${produtos.length} itens` : ''}
            </span>
            <button
              type="button"
              className={`${botaoContorno} disabled:opacity-40`}
              disabled={carregandoBusca || !temMaisProdutos}
              onClick={() => setPaginaProdutos((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden border-t border-[var(--pdv-line)] bg-[var(--pdv-panel)] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-5">
            <h2 className="text-lg font-semibold">Carrinho</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--pdv-faint)]">{carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'}</span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--pdv-line)] text-[var(--pdv-text)] hover:border-[#FFAD00]/70"
                title="Cadastrar cliente"
                aria-label="Cadastrar cliente"
                onClick={() => {
                  setFormCliente(formClienteVazio);
                  setModalCliente(true);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </button>
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-auto px-5 py-2">
            {carrinho.length === 0 ? <li className="py-8 text-center text-sm text-[var(--pdv-faint)]">Toque em um produto para incluir.</li> : null}
            {carrinho.map((item, index) => (
              <li key={`${item.id}-${index}`} className={`rounded-xl p-2 ${index === selecionado ? 'bg-[var(--pdv-hover)]' : ''}`}>
                <div className="flex items-start gap-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelecionado(index)}>
                    <div className="truncate text-sm font-medium">{item.descricao || item.codigo}</div>
                    <div className="text-xs text-[var(--pdv-faint)]">{brl(liquido(item))}</div>
                  </button>
                  <div className="flex items-center gap-1">
                    <button type="button" className={passo} onClick={() => ajustarQtd(index, -1)} aria-label="Diminuir">−</button>
                    <span className="w-6 text-center text-sm">{item.quantidade}</span>
                    <button type="button" className={passo} onClick={() => ajustarQtd(index, 1)} aria-label="Aumentar">+</button>
                    <button type="button" className="ml-1 px-1 text-[var(--pdv-faint)] hover:text-red-300" onClick={() => setCarrinho((atual) => atual.filter((_, i) => i !== index))} aria-label="Remover">
                      ✕
                    </button>
                  </div>
                </div>
                {item.descontoMaximo > 0 ? (
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--pdv-faint)]">
                    Desconto até {item.descontoMaximo}%
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.descontoPercentual === 0 ? '' : String(item.descontoPercentual)}
                      placeholder="0"
                      onChange={(e) => {
                        const raw = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
                        if (raw === '' || raw === '.') {
                          setCarrinho((atual) =>
                            atual.map((row, i) => (i === index ? { ...row, descontoPercentual: 0 } : row)),
                          );
                          return;
                        }
                        const desc = Math.min(Math.max(Number(raw) || 0, 0), item.descontoMaximo);
                        setCarrinho((atual) =>
                          atual.map((row, i) => (i === index ? { ...row, descontoPercentual: desc } : row)),
                        );
                      }}
                      className={`${campo} w-16 py-1`}
                    />
                  </label>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="max-h-[58%] shrink-0 space-y-3 overflow-y-auto border-t border-[var(--pdv-line)] px-5 py-3">
            <div className="flex items-end justify-between">
              <span className="text-sm text-[var(--pdv-muted)]">Total</span>
              <span className="text-3xl font-semibold tracking-tight">{brl(total)}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {formasVisiveis.map((forma) => {
                const ativa = forma.id === formaAtualId;
                return (
                  <button
                    key={forma.id}
                    type="button"
                    onClick={() => escolherForma(forma.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${ativa ? 'bg-[#FFAD00] text-black' : 'border border-[var(--pdv-line)] text-[var(--pdv-muted)]'}`}
                  >
                    {rotuloForma(forma.nome)}
                  </button>
                );
              })}
            </div>
            <input ref={pagamentoRef} className="sr-only" tabIndex={-1} readOnly aria-hidden value="" />

            <label className="block text-[11px] text-[var(--pdv-muted)]">
              Condição de pagamento
              <select
                value={idCondicaoPagamento || ''}
                onChange={(e) => setIdCondicaoPagamento(Number(e.target.value) || 0)}
                className={`${campo} mt-1 w-full`}
              >
                <option value="">Selecione…</option>
                {condicoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMostrarCliente((v) => !v)}
                className="text-left text-xs text-[var(--pdv-faint)] underline-offset-2 hover:text-[var(--pdv-text)]"
              >
                {cliente ? `Cliente: ${cliente.nome}` : 'Dados fiscais do cliente'}
              </button>
              <button
                type="button"
                className="text-xs text-[#1E22AA] underline-offset-2 hover:underline"
                onClick={() => {
                  setFormCliente(formClienteVazio);
                  setModalCliente(true);
                }}
              >
                Novo
              </button>
            </div>
            {clienteAberto ? (
              <div className="space-y-2">
                <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="CPF ou CNPJ" className={`${campo} w-full`} />
                <label className="flex items-center gap-2 text-xs text-[var(--pdv-muted)]">
                  <input type="checkbox" checked={contribuinte} onChange={(e) => setContribuinte(e.target.checked)} />
                  Contribuinte de ICMS
                </label>
                <div className="flex gap-2">
                  <input value={ie} onChange={(e) => setIe(e.target.value)} placeholder="IE" className={`${campo} w-full`} />
                  <input value={ufCliente} onChange={(e) => setUfCliente(e.target.value.toUpperCase())} placeholder="UF" className={`${campo} w-16`} />
                </div>
                {contatos.length > 0 ? (
                  <label className="block text-[11px] text-[var(--pdv-muted)]">
                    Contato do cliente
                    <select
                      value={idContato || ''}
                      onChange={(e) => setIdContato(Number(e.target.value) || 0)}
                      className={`${campo} mt-1 w-full`}
                    >
                      {contatos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}

            {destinoEfetivo === 'pedido' ? (
              <fieldset className="flex flex-wrap gap-3 text-xs text-[var(--pdv-muted)]">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={fiscal === 'nenhuma'} onChange={() => setFiscal('nenhuma')} /> Sem nota
                </label>
                <label className="flex items-center gap-1.5" title={certOk && sessao.certificado?.temCsc ? '' : 'Cadastre certificado e CSC'}>
                  <input type="radio" checked={fiscal === 'nfce'} onChange={() => setFiscal('nfce')} disabled={!certOk || !sessao.certificado?.temCsc} /> NFC-e
                </label>
                <label className="flex items-center gap-1.5" title={certOk ? '' : 'Cadastre o certificado'}>
                  <input type="radio" checked={fiscal === 'nfe'} onChange={() => setFiscal('nfe')} disabled={!certOk} /> NF-e
                </label>
              </fieldset>
            ) : (
              <div className="space-y-2 rounded-xl border border-[var(--pdv-line)] p-2">
                <p className="text-[11px] text-[var(--pdv-muted)]">Dados da proposta (Nomus)</p>
                {cliente && contatos.length > 0 ? (
                  <label className="block text-[11px] text-[var(--pdv-muted)]">
                    Contato
                    <select
                      value={idContato || ''}
                      onChange={(e) => setIdContato(Number(e.target.value) || 0)}
                      className={`${campo} mt-1 w-full`}
                    >
                      {contatos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-[11px] text-[var(--pdv-faint)]">Selecione um cliente para listar contatos.</p>
                )}
                <label className="block text-[11px] text-[var(--pdv-muted)]">
                  Tipo de movimentação
                  <select
                    value={idTipoMovimentacao || ''}
                    onChange={(e) => setIdTipoMovimentacao(Number(e.target.value) || 0)}
                    className={`${campo} mt-1 w-full`}
                  >
                    <option value="">Selecione…</option>
                    {tiposMov.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] text-[var(--pdv-muted)]">
                  Validade da proposta
                  <input
                    type="date"
                    value={dataValidade}
                    onChange={(e) => setDataValidade(e.target.value)}
                    className={`${campo} mt-1 w-full`}
                  />
                </label>
                <label className="block text-[11px] text-[var(--pdv-muted)]">
                  Observação
                  <textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={2}
                    className={`${campo} mt-1 w-full`}
                  />
                </label>
                {atributosPrincipais.map((atr) => (
                  <label key={atr.nome} className="block text-[11px] text-[var(--pdv-muted)]">
                    {atr.nome}
                    {atr.obrigatorio ? ' *' : ''}
                    {atr.formato === 'lista' ? (
                      <select
                        value={atributosValores[atr.nome] ?? ''}
                        onChange={(e) =>
                          setAtributosValores((atual) => ({ ...atual, [atr.nome]: e.target.value }))
                        }
                        className={`${campo} mt-1 w-full`}
                      >
                        <option value="">Selecione…</option>
                        {atr.opcoes.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={atr.formato === 'data' ? 'date' : 'text'}
                        value={atributosValores[atr.nome] ?? ''}
                        onChange={(e) =>
                          setAtributosValores((atual) => ({ ...atual, [atr.nome]: e.target.value }))
                        }
                        className={`${campo} mt-1 w-full`}
                      />
                    )}
                  </label>
                ))}
                {atributoOutrasInfo ? (
                  <label className="block text-[11px] text-[var(--pdv-muted)]">
                    Outras informações ({atributoOutrasInfo.nome})
                    <select
                      value={atributosValores[atributoOutrasInfo.nome] ?? ''}
                      onChange={(e) =>
                        setAtributosValores((atual) => ({
                          ...atual,
                          [atributoOutrasInfo.nome]: e.target.value,
                        }))
                      }
                      className={`${campo} mt-1 w-full`}
                    >
                      <option value="">Selecione…</option>
                      {atributoOutrasInfo.opcoes.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-[11px] text-[var(--pdv-muted)]">
                  <input
                    type="checkbox"
                    checked={localRetiradaDif}
                    onChange={(e) => setLocalRetiradaDif(e.target.checked)}
                  />
                  Local de retirada diferente do remetente
                </label>
                {localRetiradaDif ? (
                  <select
                    value={idEnderecoRetirada || ''}
                    onChange={(e) => setIdEnderecoRetirada(Number(e.target.value) || 0)}
                    className={`${campo} w-full`}
                  >
                    <option value="">Selecione o endereço…</option>
                    {enderecos.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.rotulo}
                      </option>
                    ))}
                  </select>
                ) : null}
                <label className="flex items-center gap-2 text-[11px] text-[var(--pdv-muted)]">
                  <input
                    type="checkbox"
                    checked={localEntregaDif}
                    onChange={(e) => setLocalEntregaDif(e.target.checked)}
                  />
                  Local de entrega diferente do destinatário
                </label>
                {localEntregaDif ? (
                  <select
                    value={idEnderecoEntrega || ''}
                    onChange={(e) => setIdEnderecoEntrega(Number(e.target.value) || 0)}
                    className={`${campo} w-full`}
                  >
                    <option value="">Selecione o endereço…</option>
                    {enderecos.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.rotulo}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            )}

            {modo === 'ambos' ? (
              <fieldset className="flex flex-wrap gap-3 text-xs text-[var(--pdv-muted)]">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={destino === 'orcamento'} onChange={() => setDestino('orcamento')} /> Orçamento
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={destino === 'pedido'} onChange={() => setDestino('pedido')} /> Pedido
                </label>
              </fieldset>
            ) : null}

            <div className="flex gap-2">
              <button type="button" disabled={enviando || carrinho.length === 0} onClick={() => void confirmar(true)} className={`${botaoContorno} disabled:opacity-40`}>
                Espera
              </button>
              {modo === 'ambos' ? (
                <>
                  <button
                    type="button"
                    disabled={enviando || carrinho.length === 0}
                    onClick={() => void confirmar(false, 'orcamento')}
                    className={`${botaoContorno} flex-1 disabled:opacity-40`}
                  >
                    {enviando ? 'Gravando…' : 'Gerar orçamento'}
                  </button>
                  <button
                    type="button"
                    disabled={enviando || !caixaOk || carrinho.length === 0}
                    onClick={() => void confirmar(false, 'pedido')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E22AA] px-3 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {enviando ? 'Gravando…' : 'Confirmar pedido'}
                    <span aria-hidden>→</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={
                    enviando ||
                    carrinho.length === 0 ||
                    (destinoEfetivo === 'pedido' && !caixaOk)
                  }
                  onClick={() => void confirmar(false, destinoEfetivo)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E22AA] px-3 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {enviando ? 'Gravando…' : destinoEfetivo === 'orcamento' ? 'Gerar orçamento' : 'Confirmar'}
                  <span aria-hidden>→</span>
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
      )}

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
const passo = 'flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--pdv-line)] text-sm';

function formatarSaldo(valor: number) {
  return Number.isInteger(valor) ? String(valor) : valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

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

function rotuloForma(nome: string) {
  const n = nome.toLowerCase();
  if (n.includes('dinheiro') || n.includes('espécie') || n.includes('especie')) return 'Dinheiro';
  if (n.includes('pix')) return 'PIX';
  if (n.includes('débito') || n.includes('debito')) return 'Débito';
  if (n.includes('crédito') || n.includes('credito')) return 'Crédito';
  if (n.includes('cart')) return 'Cartão';
  return nome;
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
