import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Percent, Receipt, Wallet } from 'lucide-react';
import {
  obterPortaPalletsDadosAbertos,
  obterPortaPalletsDetalhe,
  obterPortaPalletsMensal,
  type DetalhePortaPallets,
  type IndicadorPortaPallets,
  type LinhaPedidoItem,
  type LinhaPropostaItem,
  type MesPortaPallets,
  type PortaPalletsDadosAbertos,
  type PortaPalletsMensal,
} from '../../api/portaPalletsComercial';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import KpiPainelVoltarLink from '../../components/kpis/KpiPainelVoltarLink';
import { formatMoeda, formatNumero } from '../../components/painel-comercial/painelComercialUtils';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import { exportarPortaPalletsXlsx } from './exportPortaPalletsXlsx';
import ModalPortaPalletsDetalhe from './ModalPortaPalletsDetalhe';
import PortaPalletsComercialAjudaModal, { ComoLerBtn } from './PortaPalletsComercialAjudaModal';
import PortaPalletsFunil from './PortaPalletsFunil';
import PortaPalletsEvolucaoBarras, { type MetricaEvolucao } from './PortaPalletsEvolucaoBarras';
import AjudaPedidosCardFunil from './AjudaPedidosCardFunil';
import { formatDias, formatTaxa, labelMes } from './portaPalletsComercialFormat';
import GradePortaPallets from './GradePortaPallets';
import { COLUNAS_PEDIDOS, COLUNAS_PROPOSTAS } from './portaPalletsColunasGrade';
const MES_MIN = '2018-01';

const panelSurface =
  'rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(22,26,40,0.96),rgba(12,14,22,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_rgba(0,0,0,0.28)]';

type Tone = 'emerald' | 'violet' | 'amber' | 'cyan';
const TONE: Record<Tone, { card: string; icon: string }> = {
  emerald: {
    card: 'border-[#00A859]/30 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(0,168,89,0.16),transparent_55%),linear-gradient(180deg,#ffffff,#f3fbf7)] shadow-[0_12px_32px_rgba(0,168,89,0.08)] dark:border-[#00A859]/35 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(0,168,89,0.34),transparent_58%),linear-gradient(180deg,#0c2418,#0c1214)] dark:shadow-[0_0_36px_rgba(0,168,89,0.16)]',
    icon: 'bg-[#00A859]/15 text-[#00A859] ring-[#00A859]/35 shadow-[0_0_16px_rgba(0,168,89,0.35)] dark:text-[#7ddea8]',
  },
  violet: {
    card: 'border-[#1E22AA]/25 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(30,34,170,0.16),transparent_55%),linear-gradient(180deg,#ffffff,#f4f5fb)] shadow-[0_12px_32px_rgba(30,34,170,0.08)] dark:border-[#2B36C1]/40 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(30,34,170,0.48),transparent_58%),linear-gradient(180deg,#101433,#0c1018)] dark:shadow-[0_0_36px_rgba(30,34,170,0.22)]',
    icon: 'bg-[#1E22AA]/12 text-[#1E22AA] ring-[#1E22AA]/30 shadow-[0_0_16px_rgba(30,34,170,0.28)] dark:text-[#C5C9EF]',
  },
  amber: {
    card: 'border-[#FFAD00]/40 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,173,0,0.22),transparent_55%),linear-gradient(180deg,#ffffff,#fffaf0)] shadow-[0_12px_32px_rgba(255,173,0,0.1)] dark:border-[#FFAD00]/35 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(255,173,0,0.32),transparent_58%),linear-gradient(180deg,#2a220c,#120e0c)] dark:shadow-[0_0_36px_rgba(255,173,0,0.14)]',
    icon: 'bg-[#FFAD00]/15 text-[#C48400] ring-[#FFAD00]/40 shadow-[0_0_16px_rgba(255,173,0,0.35)] dark:text-[#FBB03B]',
  },
  cyan: {
    card: 'border-[#041E42]/20 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(4,30,66,0.12),transparent_55%),linear-gradient(180deg,#ffffff,#f3f6fa)] shadow-[0_12px_32px_rgba(4,30,66,0.08)] dark:border-[#041E42]/80 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(4,30,66,0.95),transparent_62%),linear-gradient(180deg,#0a2244,#0c1218)] dark:shadow-[0_0_36px_rgba(4,30,66,0.45)]',
    icon: 'bg-[#041E42]/10 text-[#041E42] ring-[#041E42]/25 shadow-[0_0_16px_rgba(4,30,66,0.2)] dark:text-[#C5C9EF]',
  },
};

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const TH =
  'sticky top-0 z-10 bg-slate-100 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-[#12141c] dark:text-slate-300';

type Aba = 'painel' | 'abertos';
type Origem = 'propostas' | 'pedidos';

type ModalAlvo = {
  mes?: string;
  desde?: string;
  ate?: string;
  indicador: IndicadorPortaPallets;
  titulo: string;
  subtitulo: string;
};

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesHa(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return ym < MES_MIN ? MES_MIN : ym;
}

function recortePadrao(): { desde: string; ate: string } {
  return { desde: mesHa(12), ate: mesAtual() };
}

export default function PortaPalletsComercialPage() {
  const padrao = recortePadrao();
  const [aba, setAba] = useState<Aba>('painel');
  const [ajuda, setAjuda] = useState(false);
  const [draftDesde, setDraftDesde] = useState(padrao.desde);
  const [draftAte, setDraftAte] = useState(padrao.ate);
  const [desde, setDesde] = useState(padrao.desde);
  const [ate, setAte] = useState(padrao.ate);
  const [dados, setDados] = useState<PortaPalletsMensal | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<MetricaEvolucao>('valor');
  const [modal, setModal] = useState<ModalAlvo | null>(null);
  const [detalhe, setDetalhe] = useState<DetalhePortaPallets | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const detalheCacheRef = useRef(new Map<string, DetalhePortaPallets>());
  const detalheReqRef = useRef(0);

  const [abertos, setAbertos] = useState<PortaPalletsDadosAbertos | null>(null);
  const [abertosLoading, setAbertosLoading] = useState(false);
  const [abertosErro, setAbertosErro] = useState<string | null>(null);
  const [origem, setOrigem] = useState<Origem>('propostas');
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async (ini: string, fim: string, refresh = false) => {
    setLoading(true);
    setErro(null);
    try {
      setDados(await obterPortaPalletsMensal({ desde: ini, ate: fim, refresh }));
    } catch (e) {
      setDados(null);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarAbertos = useCallback(async (refresh = false) => {
    setAbertosLoading(true);
    setAbertosErro(null);
    try {
      setAbertos(await obterPortaPalletsDadosAbertos({ refresh }));
    } catch (e) {
      setAbertos(null);
      setAbertosErro(e instanceof Error ? e.message : 'Erro ao carregar os dados abertos.');
    } finally {
      setAbertosLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar(desde, ate, false);
  }, [carregar, desde, ate]);

  useEffect(() => {
    if (aba !== 'abertos' || abertos || abertosLoading) return;
    void carregarAbertos(false);
  }, [aba, abertos, abertosLoading, carregarAbertos]);

  const aplicar = useCallback(
    (ini: string, fim: string) => {
      detalheCacheRef.current.clear();
      setDraftDesde(ini);
      setDraftAte(fim);
      setDesde(ini);
      setAte(fim);
    },
    []
  );

  const atualizar = useCallback(() => {
    detalheCacheRef.current.clear();
    void carregar(desde, ate, true);
    if (aba === 'abertos') void carregarAbertos(true);
  }, [aba, ate, carregar, carregarAbertos, desde]);

  const abrir = useCallback((alvo: ModalAlvo) => {
    setModal(alvo);
    setDetalheErro(null);
    const chave = `${alvo.indicador}|${alvo.mes ?? ''}|${alvo.desde ?? desde}|${alvo.ate ?? ate}`;
    const cached = detalheCacheRef.current.get(chave);
    if (cached) {
      setDetalhe(cached);
      setDetalheLoading(false);
      return;
    }
    setDetalhe(null);
    setDetalheLoading(true);
    const req = ++detalheReqRef.current;
    void obterPortaPalletsDetalhe(alvo.indicador, {
      mes: alvo.mes,
      desde: alvo.mes ? undefined : alvo.desde ?? desde,
      ate: alvo.mes ? undefined : alvo.ate ?? ate,
    })
      .then((data) => {
        detalheCacheRef.current.set(chave, data);
        if (detalheReqRef.current !== req) return;
        setDetalhe(data);
      })
      .catch((e: unknown) => {
        if (detalheReqRef.current !== req) return;
        setDetalheErro(e instanceof Error ? e.message : 'Erro ao carregar o detalhe.');
      })
      .finally(() => {
        if (detalheReqRef.current === req) setDetalheLoading(false);
      });
  }, [ate, desde]);

  const totais = dados?.totais;
  const mesesTabela = useMemo(() => [...(dados?.meses ?? [])].sort((a, b) => b.mes.localeCompare(a.mes)), [dados]);
  const pctReferenciaEvolucao = useMemo(() => {
    const t = dados?.totais;
    if (!t) return null;
    if (metrica === 'qtde') return t.taxaConversao;
    return t.valorPropostas > 0 ? t.valorPedidosGerados / t.valorPropostas : null;
  }, [dados, metrica]);
  const propostasRecorte = useMemo(
    () => (abertos?.propostas ?? []).filter((l) => l.mes >= desde && l.mes <= ate),
    [abertos, ate, desde]
  );
  const pedidosRecorte = useMemo(
    () => (abertos?.pedidos ?? []).filter((l) => l.mes >= desde && l.mes <= ate),
    [abertos, ate, desde]
  );
  const propostasBusca = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    return propostasRecorte.filter((l) => match(textoLinha(l, 'propostas')));
  }, [busca, propostasRecorte]);
  const pedidosBusca = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    return pedidosRecorte.filter((l) => match(textoLinha(l, 'pedidos')));
  }, [busca, pedidosRecorte]);

  const propostasGradeRef = useRef<LinhaPropostaItem[] | null>(null);
  const pedidosGradeRef = useRef<LinhaPedidoItem[] | null>(null);
  const onPropostasGrade = useCallback((rows: LinhaPropostaItem[]) => {
    propostasGradeRef.current = rows;
  }, []);
  const onPedidosGrade = useCallback((rows: LinhaPedidoItem[]) => {
    pedidosGradeRef.current = rows;
  }, []);

  const exportar = useCallback(async () => {
    if (!abertos) return;
    setExportando(true);
    try {
      await exportarPortaPalletsXlsx(
        origem === 'propostas' ? (propostasGradeRef.current ?? propostasBusca) : propostasRecorte,
        origem === 'pedidos' ? (pedidosGradeRef.current ?? pedidosBusca) : pedidosRecorte
      );
    } finally {
      setExportando(false);
    }
  }, [abertos, origem, pedidosBusca, pedidosRecorte, propostasBusca, propostasRecorte]);

  const abrirPeriodo = (indicador: IndicadorPortaPallets, titulo: string, subtitulo: string) => {
    abrir({ indicador, desde, ate, titulo: `${titulo} · ${labelMes(desde)} a ${labelMes(ate)}`, subtitulo });
  };

  const k = totais;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col px-3 py-4 md:px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-72 dark:block">
        <div className="absolute left-[8%] top-0 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute right-[12%] top-8 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>
      <CarregandoInformacoesOverlay show={loading} mensagem="Carregando indicadores de porta-pallets…" mode="viewport" />

      <div className="relative mx-auto w-full max-w-[1920px] space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <KpiPainelVoltarLink painelId="porta-pallets-comercial" />
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Indicadores de porta-pallets
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Venda do grupo Porta Paletes — não é faturamento. Clique no número para ver a origem.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ComoLerBtn onClick={() => setAjuda(true)} title="Como ler os indicadores de porta-pallets" />
            <button type="button" className={btnSecondary} onClick={atualizar}>
              Atualizar
            </button>
          </div>
        </header>

        <div className={`flex flex-wrap items-end gap-3 px-4 py-3 ${panelSurface}`}>
          <div>
            <label className={labelClass} htmlFor="pp-inicio">
              Mês início
            </label>
            <input
              id="pp-inicio"
              type="month"
              min={MES_MIN}
              max={mesAtual()}
              className={inputClass}
              value={draftDesde}
              onChange={(e) => setDraftDesde(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="pp-fim">
              Mês fim
            </label>
            <input
              id="pp-fim"
              type="month"
              min={MES_MIN}
              max={mesAtual()}
              className={inputClass}
              value={draftAte}
              onChange={(e) => setDraftAte(e.target.value)}
            />
          </div>
          <button type="button" className={btnSecondary} onClick={() => aplicar(mesHa(12), mesAtual())}>
            12 meses
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => aplicar(`${new Date().getFullYear()}-01`, mesAtual())}
          >
            Ano atual
          </button>
          <button type="button" className={btnSecondary} onClick={() => aplicar(MES_MIN, mesAtual())}>
            Desde 2018
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={loading || !draftDesde || !draftAte || draftAte < draftDesde}
            onClick={() => aplicar(draftDesde, draftAte)}
          >
            Filtrar
          </button>
          <div className="ml-auto">
            <span className={labelClass}>Visão</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-black/25">
              <SegBtn ativo={aba === 'painel'} onClick={() => setAba('painel')}>
                Painel
              </SegBtn>
              <SegBtn ativo={aba === 'abertos'} onClick={() => setAba('abertos')}>
                Dados abertos
              </SegBtn>
            </div>
          </div>
        </div>

        {erro && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {erro}
          </p>
        )}

        {aba === 'painel' && k && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard
                tone="emerald"
                titulo="Valor vendido"
                valor={formatMoeda(k.valorVendido, true)}
                detalhe={`${formatNumero(k.qtdPedidos)} pedidos emitidos no recorte`}
                icone={<Wallet className="h-4 w-4" strokeWidth={2.2} />}
                ajuda={dados?.funil ? <AjudaPedidosCardFunil conciliacao={dados.funil.conciliacao} /> : undefined}
                onClick={() => abrirPeriodo('pedidos', 'Valor vendido', formatMoeda(k.valorVendido))}
              />
              <KpiCard
                tone="violet"
                titulo="Ticket médio"
                valor={k.ticketMedio == null ? '—' : formatMoeda(k.ticketMedio)}
                detalhe={`${formatMoeda(k.valorVendido, true)} ÷ ${formatNumero(k.qtdPedidos)} pedidos`}
                icone={<Receipt className="h-4 w-4" strokeWidth={2.2} />}
                onClick={() =>
                  abrirPeriodo('pedidos', 'Ticket médio', k.ticketMedio == null ? '—' : formatMoeda(k.ticketMedio))
                }
              />
              <KpiCard
                tone="cyan"
                titulo="Conversão"
                valor={formatTaxa(k.taxaConversao)}
                detalhe={`${formatNumero(k.qtdConvertidas)} de ${formatNumero(k.qtdPropostas)} propostas · lead time ${formatDias(k.tempoMedioDias)}`}
                icone={<Percent className="h-4 w-4" strokeWidth={2.2} />}
                onClick={() => abrirPeriodo('conversao', 'Conversão', formatTaxa(k.taxaConversao))}
              />
            </div>

            {dados?.funil ? (
              <div className={`p-4 ${panelSurface}`}>
                <PortaPalletsFunil funil={dados.funil} onAbrir={abrirPeriodo} />
              </div>
            ) : null}

            <div className={`flex flex-col p-4 ${panelSurface}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Evolução mensal — propostas x fechamento</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-3.5 rounded-sm bg-slate-400/40" />
                      Proposto
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2 rounded-sm bg-[#5C92D6] shadow-[0_0_8px_#5C92D6]" />
                      Virou pedido
                    </span>
                    <span>
                      <span className="font-semibold text-emerald-400">%</span> acima /{' '}
                      <span className="font-semibold text-rose-400">%</span> abaixo da média ({formatTaxa(pctReferenciaEvolucao)})
                    </span>
                  </div>
                </div>
                <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-black/25">
                  <SegBtn ativo={metrica === 'valor'} onClick={() => setMetrica('valor')}>
                    Valor
                  </SegBtn>
                  <SegBtn ativo={metrica === 'qtde'} onClick={() => setMetrica('qtde')}>
                    Quantidade
                  </SegBtn>
                </div>
              </div>
              <div className="h-80 w-full">
                <PortaPalletsEvolucaoBarras
                  meses={dados?.meses ?? []}
                  metrica={metrica}
                  pctReferencia={pctReferenciaEvolucao}
                  onMes={(m) =>
                    abrir(
                      metrica === 'valor'
                        ? {
                            mes: m.mes,
                            indicador: 'pedidos_gerados',
                            titulo: `Pedidos gerados pelas propostas de ${labelMes(m.mes)}`,
                            subtitulo: `${formatMoeda(m.valorPedidosGerados)} de ${formatMoeda(m.valorPropostas)} em propostas`,
                          }
                        : {
                            mes: m.mes,
                            indicador: 'conversao',
                            titulo: `Propostas de ${labelMes(m.mes)}`,
                            subtitulo: `${formatNumero(m.qtdConvertidas)} de ${formatNumero(m.qtdPropostas)} viraram pedido`,
                          }
                    )
                  }
                />
              </div>
            </div>

            <div className={`overflow-hidden ${panelSurface}`}>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Série mensal</h2>
                  <p className="text-xs text-slate-500">A soma de cada coluna do recorte é o número do card. Clique na célula para auditar.</p>
                </div>
              </div>
              <div className="max-h-[28rem] overflow-auto">
                <TabelaMensal meses={mesesTabela} totais={k} onAbrir={abrir} />
              </div>
            </div>
          </div>
        )}

        {aba === 'abertos' && (
          <section className={`p-4 ${panelSurface}`}>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-black/25">
                <SegBtn ativo={origem === 'propostas'} onClick={() => setOrigem('propostas')}>
                  Propostas
                </SegBtn>
                <SegBtn ativo={origem === 'pedidos'} onClick={() => setOrigem('pedidos')}>
                  Pedidos
                </SegBtn>
              </div>
              <label className="ml-auto flex min-w-[220px] flex-1 flex-col text-xs text-slate-500">
                Busca
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Texto livre, use % para refinar"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <button type="button" disabled={!abertos || exportando} onClick={() => void exportar()} className={btnPrimary}>
                {exportando ? 'Exportando…' : 'Exportar Excel'}
              </button>
            </div>
            {abertosLoading && <p className="text-sm text-slate-500">Carregando dados abertos…</p>}
            {abertosErro && <p className="text-sm text-rose-700 dark:text-rose-300">{abertosErro}</p>}
            {!abertosLoading && !abertosErro && (
              <>
                <p className="mb-2 text-xs text-slate-500">
                  Linhas do recorte{busca.trim() ? ' que passam na busca' : ''}. A exportação leva a aba aberta com a busca e os
                  filtros da grade; a outra aba vai com o recorte inteiro.
                </p>
                {origem === 'propostas' ? (
                  <GradePortaPallets
                    key="propostas"
                    rows={propostasBusca}
                    colunas={COLUNAS_PROPOSTAS}
                    rowKey={(r) => r.idItem}
                    defaultSortLevels={[{ id: 'abertura', dir: 'desc' }]}
                    onLinhasExibidas={onPropostasGrade}
                    maxHeightClass="max-h-[calc(100vh-22rem)]"
                  />
                ) : (
                  <GradePortaPallets
                    key="pedidos"
                    rows={pedidosBusca}
                    colunas={COLUNAS_PEDIDOS}
                    rowKey={(r) => r.idItem}
                    defaultSortLevels={[{ id: 'emissao', dir: 'desc' }]}
                    onLinhasExibidas={onPedidosGrade}
                    maxHeightClass="max-h-[calc(100vh-22rem)]"
                  />
                )}
              </>
            )}
          </section>
        )}
      </div>

      <ModalPortaPalletsDetalhe
        aberto={modal != null}
        titulo={modal?.titulo ?? ''}
        subtitulo={modal?.subtitulo ?? ''}
        loading={detalheLoading}
        erro={detalheErro}
        detalhe={detalhe}
        onClose={() => setModal(null)}
      />
      <PortaPalletsComercialAjudaModal aberto={ajuda} onClose={() => setAjuda(false)} />
    </div>
  );
}

function KpiCard({
  tone,
  titulo,
  valor,
  detalhe,
  icone,
  ajuda,
  onClick,
}: {
  tone: Tone;
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: ReactNode;
  ajuda?: ReactNode;
  onClick?: () => void;
}) {
  const tom = TONE[tone];
  return (
    <article
      title={onClick ? 'Clique para ver a origem' : undefined}
      className={`relative rounded-2xl border px-4 py-3 text-left ${tom.card} ${
        onClick
          ? 'cursor-pointer transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400'
          : ''
      }`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{titulo}</p>
          <p className="mt-1 text-xl font-semibold leading-tight tracking-tight tabular-nums text-slate-900 dark:text-white">
            {valor}
          </p>
          {detalhe ? <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{detalhe}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {ajuda}
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${tom.icon}`}>{icone}</span>
        </div>
      </div>
    </article>
  );
}

function SegBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
        ativo ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-500'
      }`}
    >
      {children}
    </button>
  );
}

function TabelaMensal({
  meses,
  totais,
  onAbrir,
}: {
  meses: MesPortaPallets[];
  totais: MesPortaPallets;
  onAbrir: (alvo: ModalAlvo) => void;
}) {
  return (
    <table className="w-full min-w-[1100px] border-collapse text-sm">
      <thead>
        <tr>
          <th className={`${TH} left-0 z-20 text-left`}>Mês</th>
          <th className={TH}>Propostas</th>
          <th className={TH}>Valor das propostas</th>
          <th className={TH}>Pedidos</th>
          <th className={TH}>Valor vendido</th>
          <th className={TH}>Ticket médio</th>
          <th className={TH}>Clientes</th>
          <th className={TH}>Primeira compra</th>
          <th className={TH}>Conversão</th>
          <th className={TH}>Tempo médio</th>
        </tr>
      </thead>
      <tbody>
        {meses.map((mes) => (
          <tr key={mes.mes} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/70 dark:border-white/5 dark:odd:bg-transparent dark:even:bg-white/[0.02]">
            <th className="sticky left-0 bg-inherit px-2 py-1.5 text-left font-medium text-slate-800 dark:text-slate-100">
              {labelMes(mes.mes)}
            </th>
            <Num mes={mes} indicador="propostas" texto={formatNumero(mes.qtdPropostas)} onAbrir={onAbrir} />
            <Num mes={mes} indicador="propostas" texto={formatMoeda(mes.valorPropostas)} onAbrir={onAbrir} />
            <Num mes={mes} indicador="pedidos" texto={formatNumero(mes.qtdPedidos)} onAbrir={onAbrir} />
            <Num mes={mes} indicador="pedidos" texto={formatMoeda(mes.valorVendido)} onAbrir={onAbrir} />
            <Num mes={mes} indicador="pedidos" texto={mes.ticketMedio == null ? '—' : formatMoeda(mes.ticketMedio)} onAbrir={onAbrir} />
            <Num mes={mes} indicador="clientes" texto={formatNumero(mes.qtdClientes)} onAbrir={onAbrir} />
            <Num mes={mes} indicador="primeira" texto={formatNumero(mes.qtdPrimeiraCompra)} onAbrir={onAbrir} />
            <Num mes={mes} indicador="conversao" texto={formatTaxa(mes.taxaConversao)} onAbrir={onAbrir} />
            <Num mes={mes} indicador="tempo" texto={formatDias(mes.tempoMedioDias)} onAbrir={onAbrir} />
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold dark:border-white/10 dark:bg-[#12141c]">
          <th className="sticky left-0 bg-slate-100 px-2 py-2 text-left dark:bg-[#12141c]">Total</th>
          <td className="px-2 py-2 text-right tabular-nums">{formatNumero(totais.qtdPropostas)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatMoeda(totais.valorPropostas)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatNumero(totais.qtdPedidos)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatMoeda(totais.valorVendido)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{totais.ticketMedio == null ? '—' : formatMoeda(totais.ticketMedio)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatNumero(totais.qtdClientes)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatNumero(totais.qtdPrimeiraCompra)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatTaxa(totais.taxaConversao)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatDias(totais.tempoMedioDias)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Num({
  mes,
  indicador,
  texto,
  onAbrir,
}: {
  mes: MesPortaPallets;
  indicador: IndicadorPortaPallets;
  texto: string;
  onAbrir: (alvo: ModalAlvo) => void;
}) {
  const titulos: Record<IndicadorPortaPallets, string> = {
    propostas: 'Propostas',
    pedidos: 'Pedidos',
    clientes: 'Clientes',
    primeira: 'Primeira compra',
    conversao: 'Conversão',
    tempo: 'Tempo médio',
    pedidos_gerados: 'Pedidos gerados',
    clientes_com_pedido: 'Clientes que fecharam negócio',
    clientes_total: 'Clientes ao todo',
    clientes_novos: 'Clientes novos',
    novos_com_pedido: 'Novos que fecharam',
  };
  return (
    <td className="px-1 py-1 text-right">
      <button
        type="button"
        className="w-full rounded px-1 py-0.5 text-right tabular-nums text-sky-800 hover:bg-sky-50 hover:underline dark:text-sky-300 dark:hover:bg-sky-950/40"
        onClick={() =>
          onAbrir({
            mes: mes.mes,
            indicador,
            titulo: `${titulos[indicador]} · ${labelMes(mes.mes)}`,
            subtitulo: texto,
          })
        }
      >
        {texto}
      </button>
    </td>
  );
}

function textoLinha(linha: LinhaPropostaItem | LinhaPedidoItem, origem: Origem): string {
  if (origem === 'propostas') {
    const p = linha as LinhaPropostaItem;
    return [p.codigoProposta, p.cliente, p.codigoProduto, p.descricaoProduto, p.statusLabel, p.codigosPedido, p.motivoRejeicao].join(' ');
  }
  const p = linha as LinhaPedidoItem;
  return [p.codigoPedido, p.cliente, p.codigoProduto, p.descricaoProduto].join(' ');
}
