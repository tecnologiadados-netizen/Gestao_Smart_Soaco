import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { logout } from '@/api/auth';
import { pdvJson } from '@pdv/pdvApi';

type Sessao = {
  operador: string;
  podeConfigurar: boolean;
  idEmpresa: number | null;
  empresa: string;
  uf: string;
  crt: string;
  configurado: boolean;
  ignorarEstoque: boolean;
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
type Cliente = { id: number; nome: string };
type Pagamento = { idFormaPagamento: number; valor: number };

type VendaResposta = {
  id: number;
  total: number;
  troco: number;
  status: string;
  idPedidoNomus: number | null;
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

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [erroSessao, setErroSessao] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregandoBusca, setCarregandoBusca] = useState(false);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [selecionado, setSelecionado] = useState(0);
  const [formas, setFormas] = useState<Forma[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([{ idFormaPagamento: 0, valor: 0 }]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteBusca, setClienteBusca] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [documento, setDocumento] = useState('');
  const [contribuinte, setContribuinte] = useState(false);
  const [ie, setIe] = useState('');
  const [ufCliente, setUfCliente] = useState('');
  const [fiscal, setFiscal] = useState<'nenhuma' | 'nfce' | 'nfe'>('nenhuma');
  const [enviando, setEnviando] = useState(false);
  const [comprovante, setComprovante] = useState<VendaResposta | null>(null);
  const [esperas, setEsperas] = useState<VendaResposta[]>([]);
  const [painelEspera, setPainelEspera] = useState(false);
  const [fundo, setFundo] = useState('0');
  const [movimentoValor, setMovimentoValor] = useState('');
  const [movimentoTipo, setMovimentoTipo] = useState<'suprimento' | 'sangria'>('suprimento');
  const [painelCaixa, setPainelCaixa] = useState(false);
  const [mostrarCliente, setMostrarCliente] = useState(false);
  const [claro, setClaro] = useState(() => localStorage.getItem('pdv_tema') === 'claro');
  const tema = claro ? 'pdv-shell pdv-claro' : 'pdv-shell';

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
    pdvJson<{ formas: Forma[] }>('/api/pdv/formas')
      .then((data) => {
        setFormas(data.formas);
        const primeira = ordenarFormas(data.formas)[0];
        setPagamentos((atual) =>
          atual.map((p, i) => (i === 0 && !p.idFormaPagamento && primeira ? { ...p, idFormaPagamento: primeira.id } : p)),
        );
      })
      .catch(() => setFormas([]));
  }, [recarregarSessao]);

  useEffect(() => {
    if (!sessao?.idEmpresa || !sessao.configurado) return;
    const t = window.setTimeout(() => {
      setCarregandoBusca(true);
      pdvJson<{ produtos: Produto[] }>(`/api/pdv/produtos?q=${encodeURIComponent(busca)}`)
        .then((data) => setProdutos(data.produtos))
        .catch((e: unknown) => setAviso(e instanceof Error ? e.message : 'Falha na busca.'))
        .finally(() => setCarregandoBusca(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [busca, sessao?.idEmpresa, sessao?.configurado]);

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
  const pago = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const troco = Math.max(0, pago - total);
  const formasVisiveis = useMemo(() => ordenarFormas(formas).slice(0, 4), [formas]);
  const formaAtualId = pagamentos[0]?.idFormaPagamento ?? 0;
  const formaAtual = formas.find((f) => f.id === formaAtualId);
  const pagamentoEmDinheiro = /dinheiro|espécie|especie/i.test(formaAtual?.nome ?? '');

  function escolherForma(id: number) {
    const forma = formas.find((f) => f.id === id);
    const dinheiro = /dinheiro|espécie|especie/i.test(forma?.nome ?? '');
    setPagamentos([{ idFormaPagamento: id, valor: total }]);
    if (!dinheiro) setAviso('');
  }

  useEffect(() => {
    if (!formaAtualId) return;
    setPagamentos((atual) => {
      if (atual.length !== 1 || atual[0].idFormaPagamento !== formaAtualId) return atual;
      if (pagamentoEmDinheiro && atual[0].valor >= total - 0.009) return atual;
      if (!pagamentoEmDinheiro && Math.abs(atual[0].valor - total) < 0.009) return atual;
      return [{ idFormaPagamento: formaAtualId, valor: total }];
    });
  }, [formaAtualId, pagamentoEmDinheiro, total]);

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

  const confirmar = useCallback(
    async (espera: boolean) => {
      if (!carrinho.length) {
        setAviso('Inclua ao menos um produto.');
        return;
      }
      setEnviando(true);
      setAviso('');
      try {
        const venda = await pdvJson<VendaResposta>('/api/pdv/vendas', {
          method: 'POST',
          body: {
            espera,
            fiscal: espera ? 'nenhuma' : fiscal,
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
            pagamentos: espera ? [] : pagamentos.filter((p) => p.valor > 0 && p.idFormaPagamento),
            idPessoaCliente: cliente?.id ?? null,
            clienteNome: cliente?.nome ?? '',
            clienteDocumento: documento,
            clienteContribuinte: contribuinte,
            clienteIe: ie,
            clienteUf: ufCliente,
          },
        });
        if (espera) {
          setAviso(`Venda ${venda.id} ficou em espera.`);
        } else {
          setComprovante(venda);
        }
        setCarrinho([]);
        setPagamentos((atual) => atual.map((p) => ({ ...p, valor: 0 })));
        recarregarSessao();
      } catch (e) {
        setAviso(e instanceof Error ? e.message : 'Não foi possível concluir a venda.');
      } finally {
        setEnviando(false);
      }
    },
    [carrinho, cliente, contribuinte, documento, fiscal, ie, pagamentos, recarregarSessao, ufCliente],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'F2') {
        ev.preventDefault();
        buscaRef.current?.focus();
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
  }, [confirmar, selecionado]);

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
              {sessao.caixa ? ' · Caixa aberto' : ' · Caixa fechado'}
              {sessao.ignorarEstoque ? ' · sem checagem de estoque' : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={alternarTema} className={botaoContorno}>
            {claro ? 'Modo escuro' : 'Modo claro'}
          </button>
          <button type="button" onClick={() => setPainelCaixa((v) => !v)} className={botaoContorno}>
            Caixa
          </button>
          <button type="button" onClick={() => void abrirEsperas()} className={botaoContorno}>
            Em espera
          </button>
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

      {painelCaixa ? (
        <section className="mx-5 mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] p-3 text-sm">
          {sessao.caixa ? (
            <>
              <span className="text-xs text-[var(--pdv-muted)]">Fundo {brl(sessao.caixa.fundoTroco)}</span>
              <select value={movimentoTipo} onChange={(e) => setMovimentoTipo(e.target.value as 'suprimento' | 'sangria')} className={campo}>
                <option value="suprimento">Suprimento</option>
                <option value="sangria">Sangria</option>
              </select>
              <input value={movimentoValor} onChange={(e) => setMovimentoValor(e.target.value)} placeholder="Valor" className={`${campo} w-28`} />
              <button type="button" onClick={() => void movimentar()} className={botaoContorno}>Registrar</button>
              <button type="button" onClick={() => void fecharCaixa()} className={botaoContorno}>Fechar caixa</button>
            </>
          ) : (
            <>
              <label className="text-xs text-[var(--pdv-muted)]">
                Fundo de troco
                <input value={fundo} onChange={(e) => setFundo(e.target.value)} className={`${campo} ml-2 w-28`} />
              </label>
              <button type="button" onClick={() => void abrirCaixa()} className="rounded-lg bg-[#1E22AA] px-3 py-2 text-sm font-medium text-white">
                Abrir caixa
              </button>
            </>
          )}
        </section>
      ) : null}

      {!sessao.caixa && !painelCaixa ? (
        <section className="mx-5 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#FFAD00]/30 bg-[var(--pdv-field)] px-3 py-2 text-sm">
          <span className="text-xs text-[var(--pdv-muted)]">Caixa fechado. Informe o fundo para vender.</span>
          <input value={fundo} onChange={(e) => setFundo(e.target.value)} placeholder="Fundo" className={`${campo} w-28`} />
          <button type="button" onClick={() => void abrirCaixa()} className="rounded-lg bg-[#1E22AA] px-3 py-2 text-sm font-medium text-white">
            Abrir caixa
          </button>
        </section>
      ) : null}

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="flex min-h-0 flex-col gap-4 overflow-hidden p-5">
          <input
            ref={buscaRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, GTIN ou nome."
            className="w-full rounded-xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] px-4 py-3 text-sm outline-none placeholder:text-[var(--pdv-faint)] focus:border-[#FFAD00]/60"
          />
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
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden border-t border-[var(--pdv-line)] bg-[var(--pdv-panel)] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <h2 className="text-lg font-semibold">Carrinho</h2>
            <span className="text-xs text-[var(--pdv-faint)]">{carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'}</span>
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
                      type="number"
                      min={0}
                      max={item.descontoMaximo}
                      value={item.descontoPercentual}
                      onChange={(e) => {
                        const desc = Math.min(Math.max(Number(e.target.value) || 0, 0), item.descontoMaximo);
                        setCarrinho((atual) => atual.map((row, i) => (i === index ? { ...row, descontoPercentual: desc } : row)));
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

            {pagamentoEmDinheiro ? (
              <div className="flex items-center justify-between gap-2 text-xs text-[var(--pdv-muted)]">
                <label className="flex items-center gap-2">
                  Recebido
                  <input
                    ref={pagamentoRef}
                    value={pagamentos[0]?.valor || ''}
                    onChange={(e) => {
                      const valor = Number(e.target.value.replace(',', '.')) || 0;
                      setPagamentos([{ idFormaPagamento: formaAtualId, valor }]);
                    }}
                    className={`${campo} w-28`}
                  />
                </label>
                <span>Troco {brl(troco)}</span>
              </div>
            ) : (
              <input ref={pagamentoRef} className="sr-only" tabIndex={-1} readOnly aria-hidden value="" />
            )}

            <button type="button" onClick={() => setMostrarCliente((v) => !v)} className="text-left text-xs text-[var(--pdv-faint)] underline-offset-2 hover:text-[var(--pdv-text)]">
              {cliente ? cliente.nome : 'Cliente (F4)'}
            </button>
            {clienteAberto ? (
              <div className="space-y-2">
                <input
                  ref={clienteRef}
                  value={clienteBusca}
                  onChange={(e) => setClienteBusca(e.target.value)}
                  placeholder="Buscar cliente"
                  className={`${campo} w-full`}
                />
                {clientes.length > 0 ? (
                  <ul className="max-h-24 overflow-auto rounded-lg border border-[var(--pdv-line)] text-xs">
                    {clientes.map((c) => (
                      <li key={c.id}>
                        <button type="button" className="w-full px-2 py-1.5 text-left hover:bg-[var(--pdv-hover)]" onClick={() => { setCliente(c); setClientes([]); setClienteBusca(c.nome); }}>
                          {c.nome}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="CPF ou CNPJ" className={`${campo} w-full`} />
                <label className="flex items-center gap-2 text-xs text-[var(--pdv-muted)]">
                  <input type="checkbox" checked={contribuinte} onChange={(e) => setContribuinte(e.target.checked)} />
                  Contribuinte de ICMS
                </label>
                <div className="flex gap-2">
                  <input value={ie} onChange={(e) => setIe(e.target.value)} placeholder="IE" className={`${campo} w-full`} />
                  <input value={ufCliente} onChange={(e) => setUfCliente(e.target.value.toUpperCase())} placeholder="UF" className={`${campo} w-16`} />
                </div>
              </div>
            ) : null}

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

            <div className="flex gap-2">
              <button type="button" disabled={enviando || carrinho.length === 0} onClick={() => void confirmar(true)} className={`${botaoContorno} disabled:opacity-40`}>
                Espera
              </button>
              <button
                type="button"
                disabled={enviando || !sessao.caixa || carrinho.length === 0}
                onClick={() => void confirmar(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E22AA] px-3 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {enviando ? 'Gravando…' : 'Confirmar'}
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

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

      {comprovante ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 print:static print:bg-white print:p-0">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[var(--pdv-line)] bg-[var(--pdv-field)] p-5 text-sm print:max-h-none print:border-0 print:bg-white print:text-black">
            <div className="mb-3 flex items-start justify-between gap-3">
              <strong>
                {comprovante.qrCode
                  ? `Cupom NFC-e da venda ${comprovante.id}`
                  : comprovante.chave
                    ? `DANFE da venda ${comprovante.id}`
                    : `Comprovante da venda ${comprovante.id}`}
              </strong>
              <button type="button" onClick={() => window.print()} className={`${botaoContorno} print:hidden`}>Imprimir</button>
            </div>
            <p>Pedido Nomus: {comprovante.idPedidoNomus ?? '—'} · Documento: {comprovante.idDocumentoNomus ?? '—'}</p>
            <p>IPI médio lido do Nomus: {comprovante.aliquotaIpiMedia}%</p>
            <ul className="my-3 space-y-1">
              {comprovante.itens.map((item, i) => (
                <li key={i}>
                  {item.codigo} {item.descricao} · {item.quantidade} × {brl(item.valorUnitario)} · IPI {item.aliquotaIpi}% · NCM {item.ncm || '—'}
                </li>
              ))}
            </ul>
            <p>Total {brl(comprovante.total)} · troco {brl(comprovante.troco)}</p>
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
