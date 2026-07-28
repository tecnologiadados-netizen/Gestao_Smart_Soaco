import { useCallback, useEffect, useMemo, useState } from 'react';
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

const DIM_TITULO: Record<CarteiraDimensao, string> = {
  uf: 'Por UF',
  carrada: 'Por Carrada/Rota',
  cliente: 'Por Cliente',
  condicao: 'Por Condição de Pagamento',
  status: 'Por Status',
};

const FILTRO_INPUT_CLASS =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const FILTRO_LABEL_CLASS = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function defaultDataInicio(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

function defaultDataFim(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvToList(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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

export default function CarteiraFinanceiraPage() {
  const [datas, setDatas] = useState<DatasCarteira>(datasCarteiraIniciais);
  const [empresaCsv, setEmpresaCsv] = useState('');
  const [ufCsv, setUfCsv] = useState('');
  const [clienteCsv, setClienteCsv] = useState('');
  const [condicaoCsv, setCondicaoCsv] = useState('');
  const [carradaCsv, setCarradaCsv] = useState('');
  const [statusPedido, setStatusPedido] = useState('');

  const [payload, setPayload] = useState<CarteiraFinanceiraPayload>(VAZIO);
  const [opcoesBase, setOpcoesBase] = useState(VAZIO.opcoes);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await fetchCarteiraFinanceira({
        dataInicio: datas.data_emissao_ini || undefined,
        dataFim: datas.data_emissao_fim || undefined,
        dataPrevisaoIni: datas.data_previsao_ini || undefined,
        dataPrevisaoFim: datas.data_previsao_fim || undefined,
        empresa: csvToList(empresaCsv),
        uf: csvToList(ufCsv),
        cliente: csvToList(clienteCsv),
        condicaoPagamento: csvToList(condicaoCsv),
        observacoes: csvToList(carradaCsv),
        statusPedido: statusPedido || undefined,
      });
      setPayload(data);
      if (data.erro) setErro(data.erro);
      setOpcoesBase((prev) => ({
        uf: prev.uf.length ? prev.uf : data.opcoes.uf,
        cliente: prev.cliente.length >= data.opcoes.cliente.length ? prev.cliente : data.opcoes.cliente,
        empresa: prev.empresa.length ? prev.empresa : data.opcoes.empresa,
        condicaoPagamento: prev.condicaoPagamento.length
          ? prev.condicaoPagamento
          : data.opcoes.condicaoPagamento,
        tipoF: prev.tipoF.length ? prev.tipoF : data.opcoes.tipoF,
        observacoes: prev.observacoes.length ? prev.observacoes : data.opcoes.observacoes,
      }));
      setLoaded(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setPayload(VAZIO);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [datas, empresaCsv, ufCsv, clienteCsv, condicaoCsv, carradaCsv, statusPedido]);

  useEffect(() => {
    void carregar();
    // carga inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limparFiltros = () => {
    setDatas(datasCarteiraIniciais());
    setEmpresaCsv('');
    setUfCsv('');
    setClienteCsv('');
    setCondicaoCsv('');
    setCarradaCsv('');
    setStatusPedido('');
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

  const opcoes = opcoesBase.uf.length || opcoesBase.empresa.length ? opcoesBase : payload.opcoes;
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
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={exportando || loading || linhas.length === 0}
            onClick={() => void onExport()}
          >
            {exportando ? 'Exportando…' : 'Exportar Excel'}
          </button>
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
              <label className={FILTRO_LABEL_CLASS}>Status do Pedido</label>
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

      <CarteiraKpiCards resumo={resumo} loading={loading && !loaded} />

      {!loading && loaded && linhas.length === 0 && !erro && (
        <div className="card-panel py-12 text-center text-slate-500 text-sm">
          Sem dados para o filtro selecionado.
        </div>
      )}

      {(linhas.length > 0 || loading) && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
            <CarteiraDonutStatus
              data={porStatus}
              onSliceClick={(chave) => abrirDetalhe('status', chave)}
            />
            <CarteiraPizzaCondicao
              data={porCondicao}
              onSliceClick={(chave) => abrirDetalhe('condicao', chave)}
            />
            <div className="xl:col-span-2">
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
          <CarteiraDetalheModal
            aberto={detalhe != null}
            titulo={detalhe?.titulo ?? ''}
            subtitulo={detalhe?.subtitulo}
            pedidos={detalhe?.pedidos ?? []}
            onClose={() => setDetalhe(null)}
          />
        </>
      )}
    </div>
  );
}
