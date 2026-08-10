import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import FiltroDatasPopover from '../../components/FiltroDatasPopover';
import {
  fetchCarteiraFinanceira,
  type CarteiraFinanceiraLinha,
  type CarteiraFinanceiraPayload,
} from '../../api/financeiro';
import CarteiraKpiCards from './carteira/CarteiraKpiCards';
import {
  CarteiraBarrasAgrupadas,
  CarteiraDonutStatus,
  CarteiraPizzaCondicao,
} from './carteira/CarteiraCharts';
import CarteiraTabela from './carteira/CarteiraTabela';
import CarteiraDetalheModal from './carteira/CarteiraDetalheModal';
import {
  aggPorCarrada,
  aggPorCliente,
  aggPorCondicao,
  aggPorStatus,
  aggPorUf,
  calcResumoLocal,
  consolidarPedidosDetalhe,
  filtrarLinhasPorDimensao,
  type CarteiraDetalhePedido,
  type CarteiraDimensao,
} from './carteira/carteiraAggregates';
import { exportCarteiraFinanceiraXlsx } from './carteira/exportCarteiraFinanceiraXlsx';
import { exportCarteiraFinanceiraPdf } from './carteira/exportCarteiraFinanceiraPdf';
import {
  clearFiltrosCarteira,
  loadFiltrosCarteira,
  saveFiltrosCarteira,
  type FiltrosCarteiraState,
} from '../../utils/persistFiltros';

const DIM_TITULO: Record<CarteiraDimensao, string> = {
  uf: 'Por UF',
  carrada: 'Por Carrada/Rota',
  cliente: 'Por Cliente',
  condicao: 'Por Condição de Pagamento',
  status: 'Por Status de entrega',
};

const FILTRO_INPUT_CLASS =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const FILTRO_LABEL_CLASS = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultDataInicio(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return ymdLocal(d);
}

function defaultDataFim(): string {
  return ymdLocal(new Date());
}

function csvToList(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeSorted(prev: string[], next: string[]): string[] {
  const set = new Set<string>();
  for (const v of prev) {
    if (v.trim()) set.add(v.trim());
  }
  for (const v of next) {
    if (v.trim()) set.add(v.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const VAZIO: CarteiraFinanceiraPayload = {
  linhas: [],
  resumo: {
    saldoAReceber: 0,
    saldoAFaturar: 0,
    saldoRomaneado: 0,
    totalPedidos: 0,
    pedidosAtrasados: 0,
    pctAtrasados: 0,
    ticketMedio: 0,
  },
  opcoes: {
    uf: [],
    cliente: [],
    empresa: [],
    condicaoPagamento: [],
    tipoF: [],
    observacoes: [],
  },
};

type DatasCarteira = {
  data_emissao_ini: string;
  data_emissao_fim: string;
  data_entrega_ini: string;
  data_entrega_fim: string;
  data_previsao_anterior_ini: string;
  data_previsao_anterior_fim: string;
  data_previsao_ini: string;
  data_previsao_fim: string;
};

function datasCarteiraIniciais(): DatasCarteira {
  return {
    data_emissao_ini: defaultDataInicio(),
    data_emissao_fim: defaultDataFim(),
    data_entrega_ini: '',
    data_entrega_fim: '',
    data_previsao_anterior_ini: '',
    data_previsao_anterior_fim: '',
    data_previsao_ini: '',
    data_previsao_fim: '',
  };
}

function filtrosCarteiraDefaults(): FiltrosCarteiraState {
  return {
    ...datasCarteiraIniciais(),
    empresaCsv: '',
    ufCsv: '',
    clienteCsv: '',
    condicaoCsv: '',
    carradaCsv: '',
    statusPedido: '',
  };
}

function snapshotFiltros(
  datas: DatasCarteira,
  empresaCsv: string,
  ufCsv: string,
  clienteCsv: string,
  condicaoCsv: string,
  carradaCsv: string,
  statusPedido: string
): FiltrosCarteiraState {
  return {
    ...datas,
    empresaCsv,
    ufCsv,
    clienteCsv,
    condicaoCsv,
    carradaCsv,
    statusPedido,
  };
}

export default function CarteiraFinanceiraPage() {
  const inicial = useMemo(() => loadFiltrosCarteira(filtrosCarteiraDefaults()), []);

  const [datas, setDatas] = useState<DatasCarteira>({
    data_emissao_ini: inicial.data_emissao_ini,
    data_emissao_fim: inicial.data_emissao_fim,
    data_entrega_ini: inicial.data_entrega_ini,
    data_entrega_fim: inicial.data_entrega_fim,
    data_previsao_anterior_ini: inicial.data_previsao_anterior_ini,
    data_previsao_anterior_fim: inicial.data_previsao_anterior_fim,
    data_previsao_ini: inicial.data_previsao_ini,
    data_previsao_fim: inicial.data_previsao_fim,
  });
  const [empresaCsv, setEmpresaCsv] = useState(inicial.empresaCsv);
  const [ufCsv, setUfCsv] = useState(inicial.ufCsv);
  const [clienteCsv, setClienteCsv] = useState(inicial.clienteCsv);
  const [condicaoCsv, setCondicaoCsv] = useState(inicial.condicaoCsv);
  const [carradaCsv, setCarradaCsv] = useState(inicial.carradaCsv);
  const [statusPedido, setStatusPedido] = useState(inicial.statusPedido);

  const [payload, setPayload] = useState<CarteiraFinanceiraPayload>(VAZIO);
  const [opcoesBase, setOpcoesBase] = useState(VAZIO.opcoes);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);

  const persistir = useCallback(
    (
      nextDatas: DatasCarteira,
      nextEmpresa: string,
      nextUf: string,
      nextCliente: string,
      nextCondicao: string,
      nextCarrada: string,
      nextStatus: string
    ) => {
      saveFiltrosCarteira(
        snapshotFiltros(
          nextDatas,
          nextEmpresa,
          nextUf,
          nextCliente,
          nextCondicao,
          nextCarrada,
          nextStatus
        )
      );
    },
    []
  );

  const carregarCom = useCallback(
    async (args: {
      datas: DatasCarteira;
      empresaCsv: string;
      ufCsv: string;
      clienteCsv: string;
      condicaoCsv: string;
      carradaCsv: string;
      statusPedido: string;
      /** Se true, zera o cache de opções e reconstrói a partir deste resultado. */
      resetOpcoes?: boolean;
    }) => {
      const {
        datas: d,
        empresaCsv: emp,
        ufCsv: uf,
        clienteCsv: cli,
        condicaoCsv: cond,
        carradaCsv: carr,
        statusPedido: st,
        resetOpcoes,
      } = args;

      persistir(d, emp, uf, cli, cond, carr, st);
      setLoading(true);
      setErro(null);
      try {
        const data = await fetchCarteiraFinanceira({
          dataInicio: d.data_emissao_ini || undefined,
          dataFim: d.data_emissao_fim || undefined,
          dataPrevisaoIni: d.data_previsao_ini || undefined,
          dataPrevisaoFim: d.data_previsao_fim || undefined,
          empresa: csvToList(emp),
          uf: csvToList(uf),
          cliente: csvToList(cli),
          condicaoPagamento: csvToList(cond),
          observacoes: csvToList(carr),
          statusPedido: st || undefined,
        });
        setPayload(data);
        if (data.erro) setErro(data.erro);
        setOpcoesBase((prev) => {
          const base = resetOpcoes ? VAZIO.opcoes : prev;
          return {
            uf: mergeSorted(base.uf, data.opcoes.uf),
            cliente: mergeSorted(base.cliente, data.opcoes.cliente),
            empresa: mergeSorted(base.empresa, data.opcoes.empresa),
            condicaoPagamento: mergeSorted(base.condicaoPagamento, data.opcoes.condicaoPagamento),
            tipoF: mergeSorted(base.tipoF, data.opcoes.tipoF),
            observacoes: mergeSorted(base.observacoes, data.opcoes.observacoes),
          };
        });
        setLoaded(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
        setPayload(VAZIO);
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    },
    [persistir]
  );

  const carregar = useCallback(() => {
    return carregarCom({
      datas,
      empresaCsv,
      ufCsv,
      clienteCsv,
      condicaoCsv,
      carradaCsv,
      statusPedido,
    });
  }, [
    carregarCom,
    datas,
    empresaCsv,
    ufCsv,
    clienteCsv,
    condicaoCsv,
    carradaCsv,
    statusPedido,
  ]);

  useEffect(() => {
    void carregarCom({
      datas: {
        data_emissao_ini: inicial.data_emissao_ini,
        data_emissao_fim: inicial.data_emissao_fim,
        data_entrega_ini: inicial.data_entrega_ini,
        data_entrega_fim: inicial.data_entrega_fim,
        data_previsao_anterior_ini: inicial.data_previsao_anterior_ini,
        data_previsao_anterior_fim: inicial.data_previsao_anterior_fim,
        data_previsao_ini: inicial.data_previsao_ini,
        data_previsao_fim: inicial.data_previsao_fim,
      },
      empresaCsv: inicial.empresaCsv,
      ufCsv: inicial.ufCsv,
      clienteCsv: inicial.clienteCsv,
      condicaoCsv: inicial.condicaoCsv,
      carradaCsv: inicial.carradaCsv,
      statusPedido: inicial.statusPedido,
      resetOpcoes: true,
    });
    // carga inicial (inclui filtros restaurados do sessionStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste enquanto o usuário edita (F5 mantém mesmo antes de Aplicar)
  useEffect(() => {
    persistir(datas, empresaCsv, ufCsv, clienteCsv, condicaoCsv, carradaCsv, statusPedido);
  }, [
    datas,
    empresaCsv,
    ufCsv,
    clienteCsv,
    condicaoCsv,
    carradaCsv,
    statusPedido,
    persistir,
  ]);

  const limparFiltros = () => {
    const limpo = filtrosCarteiraDefaults();
    const nextDatas = datasCarteiraIniciais();
    setDatas(nextDatas);
    setEmpresaCsv('');
    setUfCsv('');
    setClienteCsv('');
    setCondicaoCsv('');
    setCarradaCsv('');
    setStatusPedido('');
    clearFiltrosCarteira();
    setOpcoesBase(VAZIO.opcoes);
    void carregarCom({
      datas: nextDatas,
      empresaCsv: '',
      ufCsv: '',
      clienteCsv: '',
      condicaoCsv: '',
      carradaCsv: '',
      statusPedido: '',
      resetOpcoes: true,
    });
    // regrava o default limpo (clear + save do padrão)
    saveFiltrosCarteira(limpo);
  };

  const [detalhe, setDetalhe] = useState<{
    titulo: string;
    subtitulo: string;
    pedidos: CarteiraDetalhePedido[];
  } | null>(null);

  const linhas: CarteiraFinanceiraLinha[] = payload.linhas;

  const abrirDetalhe = (dimensao: CarteiraDimensao, chave: string) => {
    const filtradas = filtrarLinhasPorDimensao(linhas, dimensao, chave);
    setDetalhe({
      titulo: DIM_TITULO[dimensao],
      subtitulo: chave,
      pedidos: consolidarPedidosDetalhe(filtradas),
    });
  };

  const resumo = useMemo(() => calcResumoLocal(linhas), [linhas]);
  const porUf = useMemo(() => aggPorUf(linhas), [linhas]);
  const porCarrada = useMemo(() => aggPorCarrada(linhas, 10), [linhas]);
  const porCliente = useMemo(() => aggPorCliente(linhas, 15), [linhas]);
  const porCondicao = useMemo(() => aggPorCondicao(linhas), [linhas]);
  const porStatus = useMemo(() => aggPorStatus(linhas), [linhas]);

  const onExport = async () => {
    setExportando(true);
    try {
      await exportCarteiraFinanceiraXlsx(linhas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(false);
    }
  };

  const onExportPdf = async () => {
    const el = pdfAreaRef.current;
    if (!el) return;
    setExportandoPdf(true);
    try {
      await exportCarteiraFinanceiraPdf(
        el,
        linhas,
        snapshotFiltros(datas, empresaCsv, ufCsv, clienteCsv, condicaoCsv, carradaCsv, statusPedido)
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setExportandoPdf(false);
    }
  };

  const opcoes = opcoesBase.uf.length || opcoesBase.empresa.length || opcoesBase.observacoes.length
    ? opcoesBase
    : payload.opcoes;
  const opcoesEmpresa = opcoes.empresa.length ? opcoes.empresa : csvToList(empresaCsv);
  const opcoesUf = opcoes.uf.length ? opcoes.uf : csvToList(ufCsv);
  const opcoesCliente = opcoes.cliente.length ? opcoes.cliente : csvToList(clienteCsv);
  const opcoesCondicao = opcoes.condicaoPagamento.length
    ? opcoes.condicaoPagamento
    : csvToList(condicaoCsv);
  const opcoesCarrada = opcoes.observacoes.length ? opcoes.observacoes : csvToList(carradaCsv);

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="card-panel shrink-0 overflow-visible">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Carteira Financeira
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Saldo a receber, a faturar e romaneado por pedido
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={exportando || exportandoPdf || loading || linhas.length === 0}
              onClick={() => void onExport()}
            >
              {exportando ? 'Exportando…' : 'Exportar Excel'}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={exportando || exportandoPdf || loading || !loaded || linhas.length === 0}
              onClick={() => void onExportPdf()}
              title="Exporta espelho visual dos cards, gráficos e tabela"
            >
              {exportandoPdf ? 'Gerando PDF…' : 'Exportar PDF'}
            </button>
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3 border-t border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 pt-3">
            <MultiSelectWithSearch
              label="Empresa"
              placeholder="Todas"
              options={opcoesEmpresa}
              value={empresaCsv}
              onChange={setEmpresaCsv}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="empresas"
              minWidth="140px"
            />
            <MultiSelectWithSearch
              label="UF"
              placeholder="Todas"
              options={opcoesUf}
              value={ufCsv}
              onChange={setUfCsv}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="UFs"
              minWidth="120px"
            />
            <MultiSelectWithSearch
              label="Cliente"
              placeholder="Todos"
              options={opcoesCliente}
              value={clienteCsv}
              onChange={setClienteCsv}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="clientes"
              minWidth="160px"
              minSearchChars={2}
            />
            <MultiSelectWithSearch
              label="Condição de Pagamento"
              placeholder="Todas"
              options={opcoesCondicao}
              value={condicaoCsv}
              onChange={setCondicaoCsv}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="condições"
              minWidth="160px"
            />
            <MultiSelectWithSearch
              label="Carrada/Rota"
              placeholder="Todas"
              options={opcoesCarrada}
              value={carradaCsv}
              onChange={setCarradaCsv}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="carradas"
              minWidth="160px"
            />
            <div>
              <label className={FILTRO_LABEL_CLASS}>Status de entrega</label>
              <select
                value={statusPedido}
                onChange={(e) => setStatusPedido(e.target.value)}
                className={FILTRO_INPUT_CLASS}
              >
                <option value="">Todos</option>
                <option value="Atrasado">Atrasado</option>
                <option value="Em dia">Em dia</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
            <FiltroDatasPopover
              filtros={datas}
              onChange={(updates) => setDatas((prev) => ({ ...prev, ...updates }))}
              blocos={['emissao', 'previsao_atual']}
            />
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={loading}
              onClick={() => void carregar()}
            >
              {loading ? 'Carregando…' : 'Aplicar'}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={limparFiltros}>
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {erro && (
        <div className="card-panel px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-rose-300 dark:border-rose-700">
          <p className="text-sm text-rose-700 dark:text-rose-300">{erro}</p>
          <button type="button" className="btn-secondary text-sm" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      )}

      <div ref={pdfAreaRef} className="flex flex-col gap-4">
        <CarteiraKpiCards resumo={resumo} loading={loading && !loaded} />

        {!loading && loaded && linhas.length === 0 && !erro && (
          <div className="card-panel py-12 text-center text-slate-500 text-sm" data-pdf-block>
            Sem dados para o filtro selecionado.
          </div>
        )}

        {(linhas.length > 0 || loading) && (
          <>
            <div className="flex flex-col gap-4">
              <div data-pdf-block className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <CarteiraBarrasAgrupadas
                  title="Por UF"
                  data={porUf}
                  layout="vertical"
                  height={Math.max(320, 280 + Math.min(porUf.length, 12) * 8)}
                  onBarClick={(chave) => abrirDetalhe('uf', chave)}
                />
                <CarteiraBarrasAgrupadas
                  title="Por Carradas/Rota (Top 10 + Outros)"
                  data={porCarrada}
                  layout="vertical"
                  onBarClick={(chave) => abrirDetalhe('carrada', chave)}
                />
              </div>
              <div data-pdf-block className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <CarteiraDonutStatus
                  data={porStatus}
                  onSliceClick={(chave) => abrirDetalhe('status', chave)}
                />
                <CarteiraPizzaCondicao
                  data={porCondicao}
                  onSliceClick={(chave) => abrirDetalhe('condicao', chave)}
                />
              </div>
              <div data-pdf-block>
                <CarteiraBarrasAgrupadas
                  title="Por Cliente (Top 15)"
                  data={porCliente}
                  layout="vertical"
                  height={Math.max(360, 300 + Math.min(porCliente.length, 15) * 8)}
                  onBarClick={(chave) => abrirDetalhe('cliente', chave)}
                />
              </div>
            </div>
            <CarteiraTabela linhas={linhas} />
          </>
        )}
      </div>

      <CarteiraDetalheModal
        aberto={detalhe != null}
        titulo={detalhe?.titulo ?? ''}
        subtitulo={detalhe?.subtitulo}
        pedidos={detalhe?.pedidos ?? []}
        onClose={() => setDetalhe(null)}
      />
    </div>
  );
}
