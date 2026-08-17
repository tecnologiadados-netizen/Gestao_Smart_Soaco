import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import ModalFiltrosConsultaEstoque, {
  filtrosConsultaTemAlgumSelecionado,
  filtrosStateToPayload,
  type FiltrosConsultaEstoqueState,
  type PedidoFiltroConsultaEstoque,
} from '../../components/pcp/ModalFiltrosConsultaEstoque';
import type { OptionItem } from '../../components/SingleSelectWithSearch';
import {
  buscarOpcoesFiltroConsultaEstoque,
  buscarPedidosGerenciadorTypeahead,
  contarConsultaEstoque,
  obterOpcoesFiltroCascataConsultaEstoque,
  obterOpcoesFiltroConsultaEstoque,
  obterCotacaoDetalhe,
  obterSaldoDetalhe,
  obterScDetalhe,
  type CotacaoDetalhe,
  type OpcoesFiltroConsultaEstoque,
  type PedidoGerenciadorTypeaheadItem,
  type SaldoSetorDetalhe,
  type ScDetalhe,
} from '../../api/consultaEstoque';
import {
  LABELS_STATUS_COBERTURA,
  STATUS_COBERTURA_ORDEM,
  obterPainelCoberturaEstoque,
  type CoberturaEstoqueLinha,
  type PainelCoberturaEstoqueData,
  type StatusCoberturaEstoque,
} from '../../api/coberturaEstoque';
import { obterRessupEmpenhoPorPedido, type RessupEmpenhoPedidoResultado } from '../../api/compras';
import ModalConsultaEstoqueDetalhe, { fmtQtde } from '../../components/pcp/ModalConsultaEstoqueDetalhe';
import TabelaDetalheSolicitacao from '../../components/pcp/TabelaDetalheSolicitacao';
import TabelaDetalheCotacao from '../../components/pcp/TabelaDetalheCotacao';
import EmpenhoLiquidoPainel from '../../components/ressupAlmox/EmpenhoLiquidoPainel';
import ModalPcPendDetalhes from '../../components/ressupAlmox/ModalPcPendDetalhes';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import { isSetorEstoquePa } from '../../components/ressupAlmox/empenhoModalUtils';
import CoberturaEstoqueAjudaModal from './CoberturaEstoqueAjudaModal';

const EMPTY_OPCOES: OpcoesFiltroConsultaEstoque = {
  codigos: [],
  descricoes: [],
  tipos: [],
  grupos: [],
  coletas: [],
  setoresProducao: [],
  subgrupo1: [],
  subgrupo2: [],
};

const EMPTY_FILTROS: FiltrosConsultaEstoqueState = {
  codigos: '',
  descricoes: '',
  tipos: '',
  grupos: '',
  coletas: '',
  setoresProducao: '',
  subgrupo1: '',
  subgrupo2: '',
  comEmpenho: 'todos',
  comSaldoEstoque: 'todos',
};

const EMPTY_PEDIDO: PedidoFiltroConsultaEstoque = {
  pedido: null,
  modoPedido: null,
  empenhoEscopo: null,
};

const CONFIRM_ROWS = 50;

const STATUS_ACCENT: Record<StatusCoberturaEstoque, string> = {
  ruptura_projetada: 'border-l-red-500',
  zerado_projetado: 'border-l-amber-500',
  cobertura_fragil: 'border-l-orange-500',
  nivelado: 'border-l-primary-600',
  excesso_parado: 'border-l-accent-500',
};

const STATUS_BAR: Record<StatusCoberturaEstoque, string> = {
  ruptura_projetada: 'bg-red-500',
  zerado_projetado: 'bg-amber-500',
  cobertura_fragil: 'bg-orange-400',
  nivelado: 'bg-primary-600',
  excesso_parado: 'bg-accent-500',
};

function formatIsoParaBr(iso: string): string {
  const s = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function pedidoToOption(p: PedidoGerenciadorTypeaheadItem): OptionItem {
  return {
    id: p.id,
    nome: p.nome,
    descricao: `Cliente: ${p.cliente ?? '—'} — Emissão: ${formatIsoParaBr(p.dataEmissao)}`,
    uniqueKey: `pd-${p.id}`,
  };
}

type DetalheModal =
  | { tipo: 'saldo'; linha: CoberturaEstoqueLinha }
  | { tipo: 'empenho'; linha: CoberturaEstoqueLinha }
  | { tipo: 'solicitacao'; linha: CoberturaEstoqueLinha }
  | { tipo: 'cotacao'; linha: CoberturaEstoqueLinha }
  | { tipo: 'pc'; linha: CoberturaEstoqueLinha };

export default function CoberturaEstoquePage() {
  const navigate = useNavigate();
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [filtrosOpen, setFiltrosOpen] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosConsultaEstoqueState>(EMPTY_FILTROS);
  const [pedidoFiltro, setPedidoFiltro] = useState<PedidoFiltroConsultaEstoque>(EMPTY_PEDIDO);
  const [opcoes, setOpcoes] = useState<OpcoesFiltroConsultaEstoque>(EMPTY_OPCOES);
  const [msgFiltro, setMsgFiltro] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [considerarRequisicoes, setConsiderarRequisicoes] = useState(false);
  const [painel, setPainel] = useState<PainelCoberturaEstoqueData | null>(null);
  const [statusAtivo, setStatusAtivo] = useState<StatusCoberturaEstoque | null>(null);
  const [confirmVolume, setConfirmVolume] = useState<number | null>(null);
  const detalheCacheRef = useRef(new Map<string, unknown>());

  const [detalhe, setDetalhe] = useState<DetalheModal | null>(null);
  const [detalheSaldo, setDetalheSaldo] = useState<SaldoSetorDetalhe[]>([]);
  const [detalheEmpenho, setDetalheEmpenho] = useState<RessupEmpenhoPedidoResultado | null>(null);
  const [detalheSc, setDetalheSc] = useState<ScDetalhe[]>([]);
  const [detalheCotacao, setDetalheCotacao] = useState<CotacaoDetalhe[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await obterOpcoesFiltroConsultaEstoque();
      if (!cancelled && r.data) setOpcoes(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const payload = filtrosStateToPayload(filtros, pedidoFiltro);
        const r = await obterOpcoesFiltroCascataConsultaEstoque(payload);
        if (!cancelled && r.data) setOpcoes(r.data);
      })();
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [filtros, pedidoFiltro]);

  const executarPainel = useCallback(
    async (req: boolean) => {
      setErro(null);
      setLoading(true);
      detalheCacheRef.current.clear();
      setStatusAtivo(null);
      const payload = filtrosStateToPayload(filtros, pedidoFiltro);
      const r = await obterPainelCoberturaEstoque({
        filtros: payload,
        considerarRequisicoes: req,
      });
      setLoading(false);
      if (r.error) {
        setErro(r.error);
        setPainel(null);
        return;
      }
      setPainel(r.data);
      setFiltrosOpen(false);
    },
    [filtros, pedidoFiltro]
  );

  const handleFiltrar = async () => {
    if (!filtrosConsultaTemAlgumSelecionado(filtros, pedidoFiltro.pedido)) {
      setMsgFiltro('Informe ao menos um filtro.');
      return;
    }
    if (pedidoFiltro.pedido && (!pedidoFiltro.modoPedido || !pedidoFiltro.empenhoEscopo)) {
      setMsgFiltro('Conclua as escolhas do pedido de venda (visualização e empenho).');
      return;
    }
    setMsgFiltro(null);
    setErro(null);
    setLoading(true);
    const countRes = await contarConsultaEstoque({
      filtros: filtrosStateToPayload(filtros, pedidoFiltro),
    });
    setLoading(false);
    if (countRes.error) {
      setErro(countRes.error);
      return;
    }
    if (countRes.total > CONFIRM_ROWS) {
      setConfirmVolume(countRes.total);
      return;
    }
    await executarPainel(considerarRequisicoes);
  };

  const itensFiltrados = useMemo(() => {
    if (!painel) return [];
    if (!statusAtivo) return painel.itens;
    return painel.itens.filter((i) => i.status === statusAtivo);
  }, [painel, statusAtivo]);

  const maxDist = useMemo(() => {
    if (!painel?.distribuicaoTipo.length) return 1;
    return Math.max(1, ...painel.distribuicaoTipo.map((d) => d.itens));
  }, [painel]);

  const maxStatus = useMemo(() => {
    if (!painel?.totais.length) return 1;
    return Math.max(1, ...painel.totais.map((t) => t.itens));
  }, [painel]);

  const abrirDetalhe = (d: DetalheModal) => {
    setDetalhe(d);
  };

  const abrirNaConsultaEstoque = () => {
    navigate('/pedidos/consulta-estoque', {
      state: {
        coberturaEstoqueFiltros: {
          filtros,
          pedidoFiltro,
          considerarRequisicoes,
        },
      },
    });
  };

  const detailKey =
    detalhe && detalhe.tipo !== 'pc'
      ? `${detalhe.tipo}-${detalhe.linha.idProduto}-${considerarRequisicoes ? 1 : 0}`
      : null;

  const carregarDetalheModal = useCallback(async (): Promise<{ error?: string }> => {
    if (!detalhe || detalhe.tipo === 'pc') return {};
    const id = detalhe.linha.idProduto;
    const key = `${detalhe.tipo}-${id}-${considerarRequisicoes ? 1 : 0}`;
    const cached = detalheCacheRef.current.get(key);
    if (cached) {
      if (detalhe.tipo === 'saldo') setDetalheSaldo(cached as SaldoSetorDetalhe[]);
      else if (detalhe.tipo === 'empenho') setDetalheEmpenho(cached as RessupEmpenhoPedidoResultado);
      else if (detalhe.tipo === 'solicitacao') setDetalheSc(cached as ScDetalhe[]);
      else setDetalheCotacao(cached as CotacaoDetalhe[]);
      return {};
    }
    if (detalhe.tipo === 'saldo') {
      const r = await obterSaldoDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(key, r.data);
      setDetalheSaldo(r.data);
      return { error: r.error };
    }
    if (detalhe.tipo === 'empenho') {
      const r = await obterRessupEmpenhoPorPedido(id, considerarRequisicoes, false);
      if (!r.error && r.data) detalheCacheRef.current.set(key, r.data);
      setDetalheEmpenho(r.data);
      return { error: r.error };
    }
    if (detalhe.tipo === 'solicitacao') {
      const r = await obterScDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(key, r.data);
      setDetalheSc(r.data);
      return { error: r.error };
    }
    const r = await obterCotacaoDetalhe(id);
    if (!r.error) detalheCacheRef.current.set(key, r.data);
    setDetalheCotacao(r.data);
    return { error: r.error };
  }, [detalhe, considerarRequisicoes]);

  return (
    <div className="relative px-4 py-5 md:px-6">
      <CarregandoInformacoesOverlay
        show={loading}
        mensagem="Calculando cobertura de estoque…"
        mode="contained"
      />

      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              Cobertura de Estoque
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Visão gerencial da posição de estoque — mesma regra da Consulta de Estoque.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ComoLerBtn onClick={() => setAjudaAberta(true)} title="Como ler a Cobertura de Estoque" />
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={abrirNaConsultaEstoque}
            >
              Abrir na Consulta de Estoque
            </button>
            <button type="button" className="btn-primary" onClick={() => setFiltrosOpen(true)}>
              Filtrar
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={considerarRequisicoes}
              onChange={(e) => setConsiderarRequisicoes(e.target.checked)}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-600"
            />
            Considerar requisições de loja no empenho
          </label>
          {painel && (
            <span className="text-xs text-slate-500">
              {painel.totalItens} produto{painel.totalItens === 1 ? '' : 's'} no filtro
            </span>
          )}
        </div>

        {erro && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
            {erro}
          </p>
        )}

        {!painel && !loading && (
          <div className="card-panel border-dashed px-6 py-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Informe ao menos um filtro e clique em <strong>Filtrar</strong> para montar o painel.
            </p>
          </div>
        )}

        {painel && (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {STATUS_COBERTURA_ORDEM.map((st) => {
                const t = painel.totais.find((x) => x.status === st)!;
                const ativo = statusAtivo === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusAtivo((cur) => (cur === st ? null : st))}
                    className={`card-panel border-l-4 p-4 text-left transition hover:shadow-soaco-lg ${STATUS_ACCENT[st]} ${
                      ativo ? 'ring-2 ring-primary-600' : ''
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-soaco-gray">{t.label}</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-soaco-navy dark:text-soaco-white">
                      {t.itens}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Proj. {fmtQtde(t.saldoProjetado)} · Emp. {fmtQtde(t.empenho)}
                    </p>
                  </button>
                );
              })}
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="card-panel p-4">
                <h2 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
                  Distribuição por status
                </h2>
                <ul className="mt-3 space-y-2">
                  {painel.totais.map((t) => (
                    <li key={t.status} className="flex items-center gap-2 text-xs">
                      <span className="w-36 shrink-0 truncate text-slate-600 dark:text-slate-300">
                        {t.label}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full ${STATUS_BAR[t.status]}`}
                          style={{ width: `${(t.itens / maxStatus) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-slate-500">{t.itens}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-panel p-4">
                <h2 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
                  Concentração por tipo de produto
                </h2>
                <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {painel.distribuicaoTipo.slice(0, 12).map((d) => (
                    <li key={d.chave} className="flex items-center gap-2 text-xs">
                      <span className="w-36 shrink-0 truncate text-slate-600 dark:text-slate-300">
                        {d.chave}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full bg-primary-600"
                          style={{ width: `${(d.itens / maxDist) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-slate-500">{d.itens}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <RankingCard
                titulo="Top ruptura / zerado"
                subtitulo="Menor saldo projetado"
                rows={painel.topCriticos}
                onOpen={(linha) => abrirDetalhe({ tipo: 'saldo', linha })}
              />
              <RankingCard
                titulo="Top excesso / parado"
                subtitulo="Maior estoque físico na faixa de excesso"
                rows={painel.topExcesso}
                onOpen={(linha) => abrirDetalhe({ tipo: 'saldo', linha })}
              />
            </section>

            <section className="card-panel overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-soaco-gray/25 px-4 py-3">
                <h2 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
                  Itens{statusAtivo ? ` — ${LABELS_STATUS_COBERTURA[statusAtivo]}` : ''}
                </h2>
                {statusAtivo && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary-600 hover:underline"
                    onClick={() => setStatusAtivo(null)}
                  >
                    Limpar filtro de status
                  </button>
                )}
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[960px] border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-soaco-navy text-white">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">Código</th>
                      <th className="px-2 py-2 text-left font-semibold">Descrição</th>
                      <th className="px-2 py-2 text-left font-semibold">Status</th>
                      <th className="px-2 py-2 text-center font-semibold">Empenho</th>
                      <th className="px-2 py-2 text-center font-semibold">Estoque</th>
                      <th className="px-2 py-2 text-center font-semibold">SC</th>
                      <th className="px-2 py-2 text-center font-semibold">Ag Pag</th>
                      <th className="px-2 py-2 text-center font-semibold">PC</th>
                      <th className="px-2 py-2 text-center font-semibold">Proj.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensFiltrados.slice(0, 500).map((row) => (
                      <tr
                        key={row.idProduto}
                        className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100">
                          {row.codigo}
                        </td>
                        <td className="max-w-[240px] truncate px-2 py-1.5 text-slate-600 dark:text-slate-300">
                          {row.descricao}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                          {LABELS_STATUS_COBERTURA[row.status]}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn onClick={() => abrirDetalhe({ tipo: 'empenho', linha: row })}>
                            {fmtQtde(row.empenho)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn onClick={() => abrirDetalhe({ tipo: 'saldo', linha: row })}>
                            {fmtQtde(row.saldo)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn
                            onClick={() => abrirDetalhe({ tipo: 'solicitacao', linha: row })}
                          >
                            {fmtQtde(row.solicitacao)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn
                            onClick={() => abrirDetalhe({ tipo: 'cotacao', linha: row })}
                          >
                            {fmtQtde(row.cotacao)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeCelulaModalBtn onClick={() => abrirDetalhe({ tipo: 'pc', linha: row })}>
                            {fmtQtde(row.pedidoCompra)}
                          </GradeCelulaModalBtn>
                        </td>
                        <td
                          className={`px-2 py-1.5 text-center tabular-nums font-medium ${
                            row.saldoProjetado < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {fmtQtde(row.saldoProjetado)}
                        </td>
                      </tr>
                    ))}
                    {itensFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                          Nenhum item neste status.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {itensFiltrados.length > 500 && (
                <p className="border-t border-soaco-gray/25 px-4 py-2 text-xs text-slate-500">
                  Exibindo 500 de {itensFiltrados.length} itens. Refine os filtros para ver menos linhas.
                </p>
              )}
            </section>
          </>
        )}
      </div>

      <ModalFiltrosConsultaEstoque
        open={filtrosOpen}
        carregando={loading}
        msgFiltro={msgFiltro}
        filtros={filtros}
        pedidoFiltro={pedidoFiltro}
        opcoes={opcoes}
        onClose={() => setFiltrosOpen(false)}
        onChange={(patch) => setFiltros((f) => ({ ...f, ...patch }))}
        onPedidoChange={(pedido) =>
          setPedidoFiltro({
            pedido,
            modoPedido: pedido ? 'diretos' : null,
            empenhoEscopo: pedido ? 'todos' : null,
          })
        }
        onAlterarEscolhasPedido={() => {
          setPedidoFiltro((p) =>
            p.pedido
              ? {
                  ...p,
                  modoPedido: p.modoPedido === 'diretos' ? 'componentes' : 'diretos',
                }
              : p
          );
        }}
        onLimpar={() => {
          setFiltros(EMPTY_FILTROS);
          setPedidoFiltro(EMPTY_PEDIDO);
          setMsgFiltro(null);
        }}
        onFiltrar={() => void handleFiltrar()}
        onBuscarCodigo={(term) =>
          buscarOpcoesFiltroConsultaEstoque('codigo', term, filtrosStateToPayload(filtros, pedidoFiltro)).then(
            (r) => r.data
          )
        }
        onBuscarDescricao={(term) =>
          buscarOpcoesFiltroConsultaEstoque(
            'descricao',
            term,
            filtrosStateToPayload(filtros, pedidoFiltro)
          ).then((r) => r.data)
        }
        onBuscarPedido={async (term) => {
          const r = await buscarPedidosGerenciadorTypeahead(term);
          return (r.data ?? []).map(pedidoToOption);
        }}
      />

      {confirmVolume != null && (
        <div className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              A consulta retorna <strong>{confirmVolume}</strong> produtos. Continuar?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setConfirmVolume(null);
                  setFiltrosOpen(true);
                }}
              >
                Não
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setConfirmVolume(null);
                  void executarPainel(considerarRequisicoes);
                }}
              >
                Sim, continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {detalhe?.tipo === 'pc' && (
        <ModalPcPendDetalhes
          open
          onClose={() => setDetalhe(null)}
          idProduto={detalhe.linha.idProduto}
          codigo={detalhe.linha.codigo}
          descricao={detalhe.linha.descricao}
        />
      )}

      {detalhe && detalhe.tipo !== 'pc' && (
        <ModalConsultaEstoqueDetalhe
          open
          detailKey={detailKey}
          onClose={() => setDetalhe(null)}
          titulo={
            detalhe.tipo === 'saldo'
              ? `Estoque — ${detalhe.linha.codigo}`
              : detalhe.tipo === 'empenho'
                ? `Empenho — ${detalhe.linha.codigo}`
                : detalhe.tipo === 'solicitacao'
                  ? `Solicitação — ${detalhe.linha.codigo}`
                  : `Ag Pag — ${detalhe.linha.codigo}`
          }
          subtitulo={detalhe.linha.descricao}
          onLoad={carregarDetalheModal}
          largo={detalhe.tipo === 'empenho'}
        >
          {({ carregando, erro: erroDetalhe }) => {
            if (carregando) return <p className="py-6 text-center text-slate-500">Carregando…</p>;
            if (erroDetalhe) return <p className="text-red-600">{erroDetalhe}</p>;
            if (detalhe.tipo === 'saldo') {
              if (detalheSaldo.length === 0) {
                return <p className="text-slate-500">Sem saldo por setor.</p>;
              }
              return (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
                      <th className="py-2 text-left">Setor</th>
                      <th className="py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalheSaldo.map((s) => (
                      <tr key={s.idSetor} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-1.5">
                          {s.setor}
                          {isSetorEstoquePa(s.idSetor) ? ' (PA)' : ''}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{fmtQtde(s.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            }
            if (detalhe.tipo === 'empenho') {
              if (!detalheEmpenho) return <p className="text-slate-500">Sem empenho.</p>;
              return (
                <EmpenhoLiquidoPainel
                  detalhe={detalheEmpenho}
                  codigo={detalhe.linha.codigo}
                  descricao={detalhe.linha.descricao}
                  saldoAtual={detalhe.linha.saldo}
                />
              );
            }
            if (detalhe.tipo === 'solicitacao') {
              return <TabelaDetalheSolicitacao linhas={detalheSc} />;
            }
            return <TabelaDetalheCotacao linhas={detalheCotacao} />;
          }}
        </ModalConsultaEstoqueDetalhe>
      )}

      <CoberturaEstoqueAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
    </div>
  );
}

function RankingCard({
  titulo,
  subtitulo,
  rows,
  onOpen,
}: {
  titulo: string;
  subtitulo: string;
  rows: CoberturaEstoqueLinha[];
  onOpen: (row: CoberturaEstoqueLinha) => void;
}) {
  return (
    <div className="card-panel p-4">
      <h2 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">{titulo}</h2>
      <p className="text-xs text-slate-500">{subtitulo}</p>
      <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
        {rows.length === 0 && <li className="text-xs text-slate-500">Sem itens nesta faixa.</li>}
        {rows.map((r) => (
          <li key={r.idProduto}>
            <button
              type="button"
              onClick={() => onOpen(r)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-slate-800 dark:text-slate-100">{r.codigo}</span>
                <span className="ml-1 text-slate-500">{r.descricao}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                {fmtQtde(r.saldoProjetado)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
