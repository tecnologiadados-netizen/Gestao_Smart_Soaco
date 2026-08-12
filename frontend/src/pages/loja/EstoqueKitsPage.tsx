import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  fetchLojaEstoqueKitsDocumentosSaidaNomus,
  fetchLojaEstoqueKitsInventarios,
  fetchLojaEstoqueKitsItensDocumentoSaidaNomus,
  fetchLojaEstoqueKitsMovimentacoes,
  fetchLojaEstoqueKitsResumo,
  postLojaEstoqueKitsInventario,
  postLojaEstoqueKitsMovimentacao,
  type LojaKitDocumentoSaidaNomus,
  type LojaKitInventario,
  type LojaKitItemDocumentoSaidaNomus,
  type LojaKitMovimentacao,
  type LojaKitResumo,
} from '../../api/lojaEstoqueKits';
import EstoqueKitsAjudaModal from './EstoqueKitsAjudaModal';

type Aba = 'estoque' | 'lancamento' | 'inventario';

function fmtDataEmissao(iso: string): string {
  const texto = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto;
  const [y, m, d] = texto.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function badgeTipo(tipo: LojaKitMovimentacao['tipo']) {
  if (tipo === 'entrada') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (tipo === 'saida') {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
  }
  return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200';
}

function labelTipo(tipo: LojaKitMovimentacao['tipo']) {
  if (tipo === 'entrada') return 'Entrada';
  if (tipo === 'saida') return 'Saída';
  return 'Inventário';
}

export default function EstoqueKitsPage() {
  const { hasPermission, nome, login } = useAuth();
  const podeMovimentar = hasPermission(PERMISSOES.LOJA_KITS_MOVIMENTAR);
  const podeInventario = hasPermission(PERMISSOES.LOJA_KITS_INVENTARIO);

  const [aba, setAba] = useState<Aba>('estoque');
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [resumo, setResumo] = useState<LojaKitResumo | null>(null);
  const [recentes, setRecentes] = useState<LojaKitMovimentacao[]>([]);
  const [inventarios, setInventarios] = useState<LojaKitInventario[]>([]);

  const [kitId, setKitId] = useState<number | ''>('');
  const [tipoMov, setTipoMov] = useState<'entrada' | 'saida' | null>(null);
  const [docTermo, setDocTermo] = useState('');
  const [documentoSelecionado, setDocumentoSelecionado] =
    useState<LojaKitDocumentoSaidaNomus | null>(null);
  const [docsOpcoes, setDocsOpcoes] = useState<LojaKitDocumentoSaidaNomus[]>([]);
  const [docsAberto, setDocsAberto] = useState(false);
  const [docsCarregando, setDocsCarregando] = useState(false);
  const [itensDoc, setItensDoc] = useState<LojaKitItemDocumentoSaidaNomus[]>([]);
  const [itensCarregando, setItensCarregando] = useState(false);
  const [pedidoIdSel, setPedidoIdSel] = useState('');
  const [produtoPedidoCodigo, setProdutoPedidoCodigo] = useState('');
  const [qty, setQty] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [contagem, setContagem] = useState<Record<number, string>>({});
  const [invObs, setInvObs] = useState('');
  const [salvandoInv, setSalvandoInv] = useState(false);

  const produtos = resumo?.produtos ?? [];
  const saldoTotalLoja = useMemo(
    () => produtos.reduce((s, p) => s + p.saldo, 0),
    [produtos],
  );
  const pedidosDoDoc = documentoSelecionado?.pedidos ?? [];
  const itensFiltrados = useMemo(
    () => (pedidoIdSel ? itensDoc.filter((i) => i.pedidoId === pedidoIdSel) : itensDoc),
    [itensDoc, pedidoIdSel],
  );
  const produtoPedidoSel =
    itensFiltrados.find((i) => i.codigo === produtoPedidoCodigo) ?? null;
  const pedidoNumeroSel =
    pedidosDoDoc.find((p) => p.pedidoId === pedidoIdSel)?.numero ??
    produtoPedidoSel?.pedidoNumero ??
    '';

  const carregarBase = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [r, movs] = await Promise.all([
        fetchLojaEstoqueKitsResumo(),
        fetchLojaEstoqueKitsMovimentacoes({ limit: 30 }),
      ]);
      setResumo(r);
      setRecentes(movs);
      setContagem((prev) => {
        const next = { ...prev };
        for (const p of r.produtos) {
          if (next[p.produtoId] == null) next[p.produtoId] = String(p.saldo);
        }
        return next;
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar estoque de kits.');
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarInventarios = useCallback(async () => {
    if (!podeInventario && !hasPermission(PERMISSOES.LOJA_KITS_VER)) return;
    try {
      const rows = await fetchLojaEstoqueKitsInventarios();
      setInventarios(rows);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar inventários.');
    }
  }, [hasPermission, podeInventario]);

  useEffect(() => {
    void carregarBase();
  }, [carregarBase]);

  useEffect(() => {
    if (aba === 'inventario') void carregarInventarios();
  }, [aba, carregarInventarios]);

  useEffect(() => {
    if (aba !== 'lancamento' || !tipoMov) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setDocsCarregando(true);
        try {
          const lista = await fetchLojaEstoqueKitsDocumentosSaidaNomus({
            q: docTermo.trim() || undefined,
            limit: docTermo.trim().length >= 2 ? 50 : 20,
          });
          if (!cancelled) setDocsOpcoes(lista);
        } catch (e) {
          if (!cancelled) {
            setDocsOpcoes([]);
            setErro(e instanceof Error ? e.message : 'Erro ao buscar documentos de saída.');
          }
        } finally {
          if (!cancelled) setDocsCarregando(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [aba, docTermo, tipoMov]);

  useEffect(() => {
    if (!documentoSelecionado) {
      setItensDoc([]);
      setPedidoIdSel('');
      setProdutoPedidoCodigo('');
      setQty('');
      return;
    }
    let cancelled = false;
    void (async () => {
      setItensCarregando(true);
      try {
        const itens = await fetchLojaEstoqueKitsItensDocumentoSaidaNomus(
          documentoSelecionado.documentoId,
        );
        if (cancelled) return;
        setItensDoc(itens);
        const pedidos = documentoSelecionado.pedidos;
        const pedidoPadrao =
          pedidos.length === 1
            ? pedidos[0].pedidoId
            : itens.length === 1
              ? itens[0].pedidoId
              : '';
        setPedidoIdSel(pedidoPadrao);
        const itensDoPedido = pedidoPadrao
          ? itens.filter((i) => i.pedidoId === pedidoPadrao)
          : itens;
        if (itensDoPedido.length === 1) {
          setProdutoPedidoCodigo(itensDoPedido[0].codigo);
          setQty(String(Math.max(1, Math.round(itensDoPedido[0].quantidade)) || 1));
        } else {
          setProdutoPedidoCodigo('');
          setQty('');
        }
      } catch (e) {
        if (!cancelled) {
          setItensDoc([]);
          setErro(e instanceof Error ? e.message : 'Erro ao carregar itens do documento.');
        }
      } finally {
        if (!cancelled) setItensCarregando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentoSelecionado]);

  const responsavelLabel = useMemo(
    () => nome?.trim() || login || '—',
    [login, nome],
  );

  function limparLancamento(opts?: { manterTipo?: boolean }) {
    if (!opts?.manterTipo) setTipoMov(null);
    setDocTermo('');
    setDocumentoSelecionado(null);
    setDocsOpcoes([]);
    setItensDoc([]);
    setPedidoIdSel('');
    setProdutoPedidoCodigo('');
    setKitId('');
    setQty('');
  }

  async function registrar() {
    if (!tipoMov) {
      setErro('Escolha se a movimentação é entrada ou saída.');
      return;
    }
    if (!podeMovimentar) {
      setErro('Sem permissão para movimentar estoque de kits.');
      return;
    }
    if (!documentoSelecionado) {
      setErro('Selecione o documento de saída no Nomus.');
      return;
    }
    if (!pedidoIdSel || !pedidoNumeroSel) {
      setErro('Selecione o pedido vinculado ao documento.');
      return;
    }
    if (!produtoPedidoCodigo || !produtoPedidoSel) {
      setErro('Selecione o produto do documento.');
      return;
    }
    if (kitId === '') {
      setErro('Selecione o kit (Filtro ou Engate).');
      return;
    }
    const quantidade = Number.parseInt(qty, 10);
    if (!Number.isFinite(quantidade) || quantidade < 1) {
      setErro('Informe uma quantidade válida.');
      return;
    }
    setSalvando(true);
    setErro(null);
    setOkMsg(null);
    try {
      await postLojaEstoqueKitsMovimentacao({
        produtoId: kitId,
        tipo: tipoMov,
        quantidade,
        pd: pedidoNumeroSel,
        documentoSaida: documentoSelecionado.numero,
        produtoPedidoCodigo: produtoPedidoSel.codigo,
        produtoPedidoDescricao: produtoPedidoSel.descricao,
      });
      setOkMsg(tipoMov === 'entrada' ? 'Entrada registrada.' : 'Saída registrada.');
      limparLancamento({ manterTipo: true });
      await carregarBase();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarInventario() {
    if (!podeInventario) {
      setErro('Sem permissão para inventário.');
      return;
    }
    const itens = produtos.map((p) => {
      const raw = contagem[p.produtoId] ?? '';
      const qtdContada = Number.parseInt(raw, 10);
      return { produtoId: p.produtoId, qtdContada };
    });
    if (itens.some((it) => !Number.isFinite(it.qtdContada) || it.qtdContada < 0)) {
      setErro('Informe quantidades válidas (≥ 0) para todos os produtos.');
      return;
    }
    setSalvandoInv(true);
    setErro(null);
    setOkMsg(null);
    try {
      await postLojaEstoqueKitsInventario({
        observacao: invObs.trim() || null,
        itens,
      });
      setOkMsg('Inventário confirmado.');
      setInvObs('');
      await carregarBase();
      await carregarInventarios();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao confirmar inventário.');
    } finally {
      setSalvandoInv(false);
    }
  }

  const tabs: { id: Aba; label: string; hidden?: boolean }[] = [
    { id: 'estoque', label: 'Estoque atual' },
    { id: 'lancamento', label: 'Lançamento' },
    { id: 'inventario', label: 'Inventário', hidden: !podeInventario },
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Controle de estoque de kits
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Filtros e engates remanescentes na loja (bebedouros vendidos sem kit).
          </p>
        </div>
        <ComoLerBtn onClick={() => setAjudaAberta(true)} title="Como ler esta tela" />
      </div>

      {erro && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {erro}
        </div>
      )}
      {okMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {okMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs
          .filter((t) => !t.hidden)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setAba(t.id);
                setErro(null);
                setOkMsg(null);
              }}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                aba === t.id
                  ? 'bg-white text-primary-700 border border-b-white border-slate-200 dark:bg-slate-800 dark:text-accent-400 dark:border-slate-600'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {loading && !resumo ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          {aba === 'estoque' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="card-panel border-l-4 border-l-primary-500 bg-primary-50/60 p-4 dark:bg-primary-950/20">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Saldo na loja
                  </div>
                  <div className="mt-2 text-3xl font-extrabold tabular-nums leading-none text-primary-700 dark:text-accent-400">
                    {saldoTotalLoja}
                    <span className="ml-1.5 text-sm font-medium text-slate-400">unid.</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {produtos.length} kit{produtos.length === 1 ? '' : 's'} controlado
                    {produtos.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="card-panel border-l-4 border-l-emerald-500 bg-emerald-50/70 p-4 dark:bg-emerald-950/25">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Entradas
                  </div>
                  <div className="mt-2 text-3xl font-extrabold tabular-nums leading-none text-emerald-700 dark:text-emerald-300">
                    {resumo?.totais.entradas ?? 0}
                    <span className="ml-1.5 text-sm font-medium text-slate-400">unid.</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Kits que ficaram na loja
                  </div>
                </div>
                <div className="card-panel border-l-4 border-l-rose-500 bg-rose-50/70 p-4 dark:bg-rose-950/25">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Saídas
                  </div>
                  <div className="mt-2 text-3xl font-extrabold tabular-nums leading-none text-rose-700 dark:text-rose-300">
                    {resumo?.totais.saidas ?? 0}
                    <span className="ml-1.5 text-sm font-medium text-slate-400">unid.</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Kits retirados / entregues
                  </div>
                </div>
                <div className="card-panel border-l-4 border-l-violet-500 bg-violet-50/70 p-4 dark:bg-violet-950/25">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Inventários
                  </div>
                  <div className="mt-2 text-3xl font-extrabold tabular-nums leading-none text-violet-700 dark:text-violet-300">
                    {resumo?.totais.inventarios ?? 0}
                    <span className="ml-1.5 text-sm font-medium text-slate-400">contagens</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {resumo?.totais.registros ?? 0} registro
                    {(resumo?.totais.registros ?? 0) === 1 ? '' : 's'} no histórico
                  </div>
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Saldo por kit
                </h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {produtos.map((p) => (
                    <div
                      key={p.produtoId}
                      className={`card-panel border-l-4 p-4 ${
                        p.estoqueBaixo ? 'border-l-rose-500' : 'border-l-primary-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-primary-700 dark:text-accent-400">
                            {p.codigo}
                          </div>
                          <div className="text-sm text-slate-500">{p.descricao}</div>
                        </div>
                        {p.estoqueBaixo && (
                          <span className="shrink-0 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                            Estoque baixo
                          </span>
                        )}
                      </div>
                      <div
                        className={`mt-3 text-4xl font-extrabold tabular-nums ${
                          p.estoqueBaixo ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {p.saldo}{' '}
                        <span className="text-sm font-medium text-slate-400">unid.</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
                            Entradas
                          </div>
                          <div className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                            {p.entradas}
                          </div>
                        </div>
                        <div className="rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-950/30">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-700/80 dark:text-rose-300/80">
                            Saídas
                          </div>
                          <div className="mt-0.5 text-lg font-bold tabular-nums text-rose-800 dark:text-rose-200">
                            {p.saidas}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {aba === 'lancamento' && (
            <div className="space-y-4">
              <div className="card-panel p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Registrar movimentação
                </h2>

                {!tipoMov ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Primeiro escolha o tipo de movimentação:
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={!podeMovimentar}
                        onClick={() => {
                          setTipoMov('entrada');
                          setErro(null);
                          setOkMsg(null);
                        }}
                        className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-5 text-left transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:hover:border-emerald-600"
                      >
                        <div className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
                          Entrada
                        </div>
                        <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                          Kit fica na loja (produto saiu sem filtro/engate).
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={!podeMovimentar}
                        onClick={() => {
                          setTipoMov('saida');
                          setErro(null);
                          setOkMsg(null);
                        }}
                        className="rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-5 text-left transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:hover:border-rose-600"
                      >
                        <div className="text-base font-semibold text-rose-800 dark:text-rose-200">
                          Saída
                        </div>
                        <div className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">
                          Kit sai da loja (entrega, consumo ou retirada).
                        </div>
                      </button>
                    </div>
                    {!podeMovimentar && (
                      <p className="text-xs text-slate-500">Sem permissão para movimentar.</p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold ${
                          tipoMov === 'entrada'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                        }`}
                      >
                        Tipo: {tipoMov === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                      <button
                        type="button"
                        onClick={() => limparLancamento()}
                        className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        Alterar tipo
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      <label className="block text-xs font-medium text-slate-500">
                        Responsável
                        <input
                          readOnly
                          value={responsavelLabel}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                        />
                      </label>
                      <div className="relative block text-xs font-medium text-slate-500">
                        Documento de saída
                        <input
                          value={docTermo}
                          onChange={(e) => {
                            setDocTermo(e.target.value);
                            setDocumentoSelecionado(null);
                            setDocsAberto(true);
                          }}
                          onFocus={() => setDocsAberto(true)}
                          onBlur={() => {
                            window.setTimeout(() => setDocsAberto(false), 150);
                          }}
                          placeholder="Nº do documento de saída…"
                          autoComplete="off"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                        />
                        {docsCarregando && (
                          <span className="absolute right-2 top-8 text-[10px] text-slate-400">…</span>
                        )}
                        {docsAberto && docsOpcoes.length > 0 && (
                          <ul className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                            {docsOpcoes.map((d) => (
                              <li key={d.documentoId}>
                                <button
                                  type="button"
                                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setDocumentoSelecionado(d);
                                    setDocTermo(d.numero);
                                    setDocsAberto(false);
                                  }}
                                >
                                  <span className="text-sm font-semibold text-primary-700 dark:text-accent-400">
                                    {d.numero}
                                    {d.dataEmissao ? ` · ${fmtDataEmissao(d.dataEmissao)}` : ''}
                                  </span>
                                  <span className="line-clamp-1 text-[11px] text-slate-500">
                                    {d.clienteNome || '—'}
                                    {d.pedidos.length > 0
                                      ? ` · PD ${d.pedidos.map((p) => p.numero).join(', ')}`
                                      : ''}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <label className="block text-xs font-medium text-slate-500">
                        Pedido vinculado
                        {pedidosDoDoc.length <= 1 ? (
                          <input
                            readOnly
                            value={
                              !documentoSelecionado
                                ? ''
                                : itensCarregando
                                  ? 'Carregando…'
                                  : pedidoNumeroSel || '—'
                            }
                            placeholder="Selecione o documento…"
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        ) : (
                          <select
                            value={pedidoIdSel}
                            onChange={(e) => {
                              const id = e.target.value;
                              setPedidoIdSel(id);
                              const itens = itensDoc.filter((i) => i.pedidoId === id);
                              if (itens.length === 1) {
                                setProdutoPedidoCodigo(itens[0].codigo);
                                setQty(String(Math.max(1, Math.round(itens[0].quantidade)) || 1));
                              } else {
                                setProdutoPedidoCodigo('');
                                setQty('');
                              }
                            }}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                          >
                            <option value="">Selecione…</option>
                            {pedidosDoDoc.map((p) => (
                              <option key={p.pedidoId} value={p.pedidoId}>
                                {p.numero}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>
                      <label className="block text-xs font-medium text-slate-500">
                        Produto (do documento)
                        <select
                          value={produtoPedidoCodigo}
                          disabled={!documentoSelecionado || itensCarregando || !pedidoIdSel}
                          onChange={(e) => {
                            const codigo = e.target.value;
                            setProdutoPedidoCodigo(codigo);
                            const item = itensFiltrados.find((i) => i.codigo === codigo);
                            if (item) {
                              setQty(String(Math.max(1, Math.round(item.quantidade)) || 1));
                            } else {
                              setQty('');
                            }
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
                        >
                          <option value="">
                            {!documentoSelecionado
                              ? 'Selecione o documento…'
                              : itensCarregando
                                ? 'Carregando…'
                                : 'Selecione…'}
                          </option>
                          {itensFiltrados.map((item) => (
                            <option key={`${item.pedidoId}-${item.codigo}`} value={item.codigo}>
                              {item.codigo} — {item.descricao} (qtd {item.quantidade})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-slate-500">
                        Kit (estoque)
                        <select
                          value={kitId === '' ? '' : String(kitId)}
                          onChange={(e) => setKitId(e.target.value ? Number(e.target.value) : '')}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                        >
                          <option value="">Selecione…</option>
                          {produtos.map((p) => (
                            <option key={p.produtoId} value={p.produtoId}>
                              {p.codigo} — {p.descricao} (saldo {p.saldo})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-slate-500">
                        Quantidade
                        <input
                          type="number"
                          min={1}
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!podeMovimentar || salvando}
                        onClick={() => void registrar()}
                        className={`btn-primary disabled:opacity-50 ${
                          tipoMov === 'entrada'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-rose-600 hover:bg-rose-700'
                        }`}
                      >
                        {salvando
                          ? 'Registrando…'
                          : tipoMov === 'entrada'
                            ? 'Confirmar entrada'
                            : 'Confirmar saída'}
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="card-panel p-4">
                <TabelaMovs rows={recentes} />
              </div>
            </div>
          )}

          {aba === 'inventario' && podeInventario && (
            <div className="space-y-4">
              <div className="card-panel p-4">
                <h2 className="mb-3 text-sm font-semibold text-violet-700 dark:text-violet-300">
                  Contagem física
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {produtos.map((p) => {
                    const raw = contagem[p.produtoId] ?? '';
                    const contada = Number.parseInt(raw, 10);
                    const diff = Number.isFinite(contada) ? contada - p.saldo : null;
                    return (
                      <div
                        key={p.produtoId}
                        className="rounded-lg border border-slate-200 p-3 dark:border-slate-600"
                      >
                        <div className="font-semibold text-violet-700 dark:text-violet-300">
                          {p.codigo} — {p.descricao}
                        </div>
                        <div className="mt-1 text-xs uppercase text-slate-500">Sistema</div>
                        <div className="text-2xl font-bold tabular-nums">{p.saldo}</div>
                        <label className="mt-2 block text-xs font-medium text-slate-500">
                          Contagem física
                          <input
                            type="number"
                            min={0}
                            value={raw}
                            onChange={(e) =>
                              setContagem((prev) => ({
                                ...prev,
                                [p.produtoId]: e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold dark:border-slate-600 dark:bg-slate-900"
                          />
                        </label>
                        {diff != null && (
                          <div
                            className={`mt-2 rounded px-2 py-1 text-center text-xs font-semibold ${
                              diff > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : diff < 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            Diferença: {diff > 0 ? `+${diff}` : diff}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <label className="mt-4 block text-xs font-medium text-slate-500">
                  Observações
                  <textarea
                    rows={3}
                    value={invObs}
                    onChange={(e) => setInvObs(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                    placeholder="Divergências, danos, etc."
                  />
                </label>
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={salvandoInv}
                    onClick={() => void confirmarInventario()}
                    className="btn-primary bg-violet-700 hover:bg-violet-800 disabled:opacity-50"
                  >
                    Confirmar inventário
                  </button>
                </div>
              </div>
              <div className="card-panel p-4">
                <h2 className="mb-3 text-sm font-semibold text-violet-700 dark:text-violet-300">
                  Histórico de inventários
                </h2>
                {inventarios.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Nenhum inventário ainda.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-600">
                          <th className="px-2 py-2">Data</th>
                          <th className="px-2 py-2">Responsável</th>
                          <th className="px-2 py-2">Itens</th>
                          <th className="px-2 py-2">Obs.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventarios.map((inv) => (
                          <tr
                            key={inv.id}
                            className="border-b border-slate-100 dark:border-slate-700/60"
                          >
                            <td className="whitespace-nowrap px-2 py-2">
                              {fmtDataHora(inv.createdAt)}
                            </td>
                            <td className="px-2 py-2">{inv.responsavelNome}</td>
                            <td className="px-2 py-2">
                              <ul className="space-y-0.5">
                                {inv.itens.map((it) => (
                                  <li key={it.produtoId}>
                                    {it.codigo}: sist. {it.qtdSistema} → cont. {it.qtdContada} (
                                    {it.diferenca > 0 ? `+${it.diferenca}` : it.diferenca})
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td className="max-w-xs truncate px-2 py-2" title={inv.observacao ?? ''}>
                              {inv.observacao || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <EstoqueKitsAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
    </div>
  );
}

type MovColId =
  | 'tipo'
  | 'dataHora'
  | 'responsavel'
  | 'pd'
  | 'codigo'
  | 'descricao'
  | 'qtd';

const MOV_COLS: MovColId[] = [
  'tipo',
  'dataHora',
  'responsavel',
  'pd',
  'codigo',
  'descricao',
  'qtd',
];

const MOV_COL_LABELS: Record<MovColId, string> = {
  tipo: 'Tipo',
  dataHora: 'Data/Hora',
  responsavel: 'Responsável',
  pd: 'PD',
  codigo: 'Código',
  descricao: 'Descrição',
  qtd: 'Qtd',
};

function cellTextMov(r: LojaKitMovimentacao, col: MovColId): string {
  switch (col) {
    case 'tipo':
      return labelTipo(r.tipo);
    case 'dataHora':
      return fmtDataHora(r.createdAt);
    case 'responsavel':
      return r.responsavelNome || '—';
    case 'pd':
      return r.pd?.trim() || '—';
    case 'codigo':
      return r.codigo || '—';
    case 'descricao':
      return r.descricao || '—';
    case 'qtd':
      return String(r.quantidade);
    default:
      return '—';
  }
}

function sortValueMov(r: LojaKitMovimentacao, col: MovColId): string | number {
  if (col === 'qtd') return Number(r.quantidade) || 0;
  if (col === 'dataHora') {
    const t = new Date(r.createdAt).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return cellTextMov(r, col).toLowerCase();
}

function TabelaMovs({ rows }: { rows: LojaKitMovimentacao[] }) {
  const grade = useGradeFiltrosExcel<LojaKitMovimentacao>({
    rows,
    columnIds: MOV_COLS,
    getCellText: (r, c) => cellTextMov(r, c as MovColId),
    valueForSort: (r, c) => sortValueMov(r, c as MovColId),
    defaultSortLevels: [{ id: 'dataHora', dir: 'desc' }],
  });

  if (rows.length === 0) {
    return (
      <>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Últimas movimentações
        </h2>
        <p className="py-8 text-center text-sm text-slate-500">Nenhuma movimentação.</p>
      </>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Últimas movimentações
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            Exibindo {grade.rowsExibidas.length} de {rows.length}
          </span>
          {grade.temFiltrosOuOrdem && (
            <button
              type="button"
              onClick={() => grade.limparFiltrosGrade()}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>
      <div
        ref={grade.tableScrollRef}
        className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"
      >
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              {MOV_COLS.map((c) => (
                <th
                  key={c}
                  className="sticky top-0 z-10 border border-primary-500/40 bg-primary-600 px-2 py-2.5 align-middle font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]"
                >
                  <div className="flex min-w-0 items-start justify-between gap-1">
                    <span className="min-w-0 flex-1 text-[11px] leading-tight sm:text-xs">
                      {MOV_COL_LABELS[c]}
                    </span>
                    <GradeFiltroCabecalhoBtn
                      ativo={grade.colunaComFiltroAtivo(c)}
                      onClick={(e) => grade.abrirFiltroExcel(c, e)}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.rowsExibidas.length === 0 ? (
              <tr>
                <td colSpan={MOV_COLS.length} className="px-2 py-8 text-center text-slate-500">
                  Nenhuma linha com os filtros da grade. Ajuste ou limpe os filtros por coluna.
                </td>
              </tr>
            ) : (
              grade.rowsExibidas.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/40"
                >
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeTipo(r.tipo)}`}
                    >
                      {labelTipo(r.tipo)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">{fmtDataHora(r.createdAt)}</td>
                  <td className="px-2 py-1.5">{r.responsavelNome}</td>
                  <td className="px-2 py-1.5">{r.pd || '—'}</td>
                  <td className="px-2 py-1.5">{r.codigo}</td>
                  <td className="px-2 py-1.5">{r.descricao}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {r.quantidade}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
          showNumericFilters={grade.colunaFiltroAberta === 'qtd'}
          sortAscLabel={
            grade.colunaFiltroAberta === 'qtd'
              ? '↑ Classificar do menor para o maior'
              : grade.colunaFiltroAberta === 'dataHora'
                ? '↑ Classificar da mais antiga'
                : undefined
          }
          sortDescLabel={
            grade.colunaFiltroAberta === 'qtd'
              ? '↓ Classificar do maior para o menor'
              : grade.colunaFiltroAberta === 'dataHora'
                ? '↓ Classificar da mais recente'
                : undefined
          }
        />
      )}
    </>
  );
}
