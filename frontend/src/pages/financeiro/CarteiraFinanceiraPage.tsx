import { useCallback, useEffect, useMemo, useState } from 'react';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import {
  fetchCarteiraFinanceira,
  type CarteiraFinanceiraLinha,
  type CarteiraFinanceiraPayload,
  type CarteiraMapaPonto,
} from '../../api/financeiro';
import CarteiraKpiCards from './carteira/CarteiraKpiCards';
import { CarteiraBarrasAgrupadas, CarteiraDonutStatus } from './carteira/CarteiraCharts';
import CarteiraMapa from './carteira/CarteiraMapa';
import CarteiraTabela from './carteira/CarteiraTabela';
import {
  aggPorCarrada,
  aggPorCliente,
  aggPorCondicao,
  aggPorStatus,
  aggPorUf,
  calcResumoLocal,
} from './carteira/carteiraAggregates';
import { exportCarteiraFinanceiraXlsx } from './carteira/exportCarteiraFinanceiraXlsx';

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
  mapaPontos: [],
  semLocalizacao: 0,
  opcoes: { uf: [], cliente: [], empresa: [], condicaoPagamento: [], tipoF: [] },
};

export default function CarteiraFinanceiraPage() {
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [empresaCsv, setEmpresaCsv] = useState('');
  const [ufCsv, setUfCsv] = useState('');
  const [clienteCsv, setClienteCsv] = useState('');
  const [condicaoCsv, setCondicaoCsv] = useState('');
  const [statusPedido, setStatusPedido] = useState('');
  const [municipioFiltro, setMunicipioFiltro] = useState<string | null>(null);

  const [payload, setPayload] = useState<CarteiraFinanceiraPayload>(VAZIO);
  const [opcoesBase, setOpcoesBase] = useState(VAZIO.opcoes);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (overrides?: {
    clienteCsv?: string;
    municipioFiltro?: string | null;
  }) => {
    setLoading(true);
    setErro(null);
    const clienteVal = overrides?.clienteCsv ?? clienteCsv;
    const municipioVal =
      overrides && 'municipioFiltro' in overrides ? overrides.municipioFiltro : municipioFiltro;
    try {
      const data = await fetchCarteiraFinanceira({
        dataInicio,
        dataFim,
        empresa: csvToList(empresaCsv),
        uf: csvToList(ufCsv),
        cliente: csvToList(clienteVal),
        condicaoPagamento: csvToList(condicaoCsv),
        statusPedido: statusPedido || undefined,
        municipio: municipioVal ? [municipioVal] : undefined,
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
      }));
      setLoaded(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setPayload(VAZIO);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, empresaCsv, ufCsv, clienteCsv, condicaoCsv, statusPedido, municipioFiltro]);

  useEffect(() => {
    void carregar();
    // carga inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limparFiltros = () => {
    setDataInicio(defaultDataInicio());
    setDataFim(defaultDataFim());
    setEmpresaCsv('');
    setUfCsv('');
    setClienteCsv('');
    setCondicaoCsv('');
    setStatusPedido('');
    setMunicipioFiltro(null);
  };

  const onClienteClick = (chave: string) => {
    setClienteCsv(chave);
    setMunicipioFiltro(null);
    void carregar({ clienteCsv: chave, municipioFiltro: null });
  };

  const onMunicipioClick = (municipio: string) => {
    setMunicipioFiltro(municipio);
    void carregar({ municipioFiltro: municipio });
  };

  const linhas: CarteiraFinanceiraLinha[] = payload.linhas;
  const resumo = useMemo(() => calcResumoLocal(linhas), [linhas]);
  const porUf = useMemo(() => aggPorUf(linhas), [linhas]);
  const porCarrada = useMemo(() => aggPorCarrada(linhas, 10), [linhas]);
  const porCliente = useMemo(() => aggPorCliente(linhas, 15), [linhas]);
  const porCondicao = useMemo(() => aggPorCondicao(linhas), [linhas]);
  const porStatus = useMemo(() => aggPorStatus(linhas), [linhas]);
  const mapaPontos: CarteiraMapaPonto[] = payload.mapaPontos;

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
  const opcoesEmpresa = opcoes.empresa.length
    ? opcoes.empresa
    : csvToList(empresaCsv);
  const opcoesUf = opcoes.uf.length ? opcoes.uf : csvToList(ufCsv);
  const opcoesCliente = opcoes.cliente.length ? opcoes.cliente : csvToList(clienteCsv);
  const opcoesCondicao = opcoes.condicaoPagamento.length
    ? opcoes.condicaoPagamento
    : csvToList(condicaoCsv);

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
            <div>
              <label className={FILTRO_LABEL_CLASS}>Data início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={FILTRO_INPUT_CLASS}
              />
            </div>
            <div>
              <label className={FILTRO_LABEL_CLASS}>Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={FILTRO_INPUT_CLASS}
              />
            </div>
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

          {municipioFiltro && (
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Filtro município:{' '}
              <span className="font-medium">{municipioFiltro}</span>
              <button
                type="button"
                className="ml-2 text-primary-600 underline"
                onClick={() => {
                  setMunicipioFiltro(null);
                  void carregar({ municipioFiltro: null });
                }}
              >
                limpar
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
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
            <CarteiraBarrasAgrupadas title="Por UF" data={porUf} layout="horizontal" height={Math.max(280, porUf.length * 36)} />
            <CarteiraBarrasAgrupadas title="Por Carradas/Rota (Top 10 + Outros)" data={porCarrada} layout="vertical" />
            <CarteiraBarrasAgrupadas
              title="Por Cliente (Top 15)"
              data={porCliente}
              layout="horizontal"
              height={Math.max(320, porCliente.length * 32)}
              onBarClick={onClienteClick}
            />
            <CarteiraBarrasAgrupadas title="Por Condição de Pagamento" data={porCondicao} layout="vertical" />
            <CarteiraMapa
              pontos={mapaPontos}
              semLocalizacao={payload.semLocalizacao}
              onSelectMunicipio={onMunicipioClick}
            />
            <CarteiraDonutStatus data={porStatus} />
          </div>
          <CarteiraTabela linhas={linhas} />
        </>
      )}
    </div>
  );
}
