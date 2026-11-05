import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ComoLerBtn } from '../../../components/AjudaTelaModal';
import { PainelProducaoShell } from '../../../components/painel-producao/PainelProducaoShell';
import LoaderCirculo from '../../../components/LoaderCirculo';
import {
  fetchPainelFaturamento,
  fetchPainelFaturamentoLinhas,
  fetchPainelFaturamentoDia,
  type FaturamentoConsulta,
  type FaturamentoDia,
  type FaturamentoDocumento,
  type FaturamentoValores,
} from '../../../api/painelProducao';
import FaturamentoAjudaModal from './FaturamentoAjudaModal';
import { exportarFaturamentoExcel } from './exportFaturamentoXlsx';
import { formatMesShort } from '../../../utils/painelProducaoFormat';

function iso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function periodoDoMes(mes: string): { ini: string; fim: string } {
  const [ano, m] = mes.split('-').map(Number);
  const inicio = new Date(ano, m - 1, 1);
  const ultimo = new Date(ano, m, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = ultimo > hoje ? hoje : ultimo;
  return { ini: iso(inicio), fim: iso(fim < inicio ? inicio : fim) };
}

function hojeIso(): string {
  return iso(new Date());
}

function periodoPadrao(): { ini: string; fim: string } {
  const h = new Date();
  return periodoDoMes(`${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`);
}

function rotuloBarra(valor: number): string {
  if (valor >= 1_000_000) {
    return `${(valor / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  }
  if (valor >= 1000) return `${Math.round(valor / 1000)} mil`;
  return formatMoeda(valor);
}

function formatMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatDia(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function MovimentosDia({ linhas }: { linhas: FaturamentoDocumento[] }) {
  const soma = linhas.reduce(
    (acc, d) => {
      acc.faturado += d.faturado;
      acc.desconto += d.desconto;
      acc.devolvido += d.devolvido;
      acc.liquido += d.liquido;
      return acc;
    },
    { faturado: 0, desconto: 0, devolvido: 0, liquido: 0 }
  );
  return (
    <table className="apuracao-table faturamento-table faturamento-movimentos">
      <thead>
        <tr>
          <th>NF</th>
          <th>Documento</th>
          <th>Pedido</th>
          <th>Tipo</th>
          <th>Faturado</th>
          <th>Desconto</th>
          <th>Devolvido</th>
          <th>Líquido</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((doc, i) => (
          <tr key={`${doc.tipo}-${doc.numero}-${i}`}>
            <td>{doc.numero || '—'}</td>
            <td>{doc.documento || '—'}</td>
            <td>{doc.pedido || '—'}</td>
            <td>{doc.tipo === 'devolucao' ? 'Devolução' : 'Faturamento'}</td>
            <td className="faturamento-num">{formatMoeda(doc.faturado)}</td>
            <td className="faturamento-num">{formatMoeda(doc.desconto)}</td>
            <td className="faturamento-num">{formatMoeda(doc.devolvido)}</td>
            <td className="faturamento-num">{formatMoeda(doc.liquido)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4}>Soma</td>
          <td className="faturamento-num">{formatMoeda(soma.faturado)}</td>
          <td className="faturamento-num">{formatMoeda(soma.desconto)}</td>
          <td className="faturamento-num">{formatMoeda(soma.devolvido)}</td>
          <td className="faturamento-num">{formatMoeda(soma.liquido)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

const CARDS: { chave: keyof FaturamentoValores; rotulo: string; sub: string; accent: string }[] = [
  { chave: 'faturado', rotulo: 'Faturado', sub: 'Saídas sem desconto', accent: 'fat-kpi-faturado' },
  { chave: 'desconto', rotulo: 'Desconto', sub: 'Abatido nas saídas', accent: 'fat-kpi-desconto' },
  { chave: 'devolvido', rotulo: 'Devolvido', sub: 'Devoluções do período', accent: 'fat-kpi-devolvido' },
  { chave: 'liquido', rotulo: 'Líquido', sub: 'Faturado − desconto − devolvido', accent: 'fat-kpi-liquido' },
];

export default function PainelFaturamentoPage() {
  const inicial = periodoPadrao();
  const [ini, setIni] = useState(inicial.ini);
  const [fim, setFim] = useState(inicial.fim);
  const [dados, setDados] = useState<FaturamentoConsulta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ajuda, setAjuda] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [docsErro, setDocsErro] = useState<string | null>(null);
  const [docsCarregando, setDocsCarregando] = useState(false);
  const [, setCacheTick] = useState(0);
  const cacheRef = useRef(new Map<string, FaturamentoDocumento[]>());
  const periodoAntesRef = useRef<{ ini: string; fim: string } | null>(null);

  const carregar = useCallback(async (inicio: string, final: string) => {
    if (!inicio || !final || inicio > final) {
      setErro('O início do período precisa ser até o fim.');
      return;
    }
    setCarregando(true);
    setErro(null);
    cacheRef.current.clear();
    setDiaAberto(null);
    try {
      setDados(await fetchPainelFaturamento(inicio, final));
    } catch (err) {
      setDados(null);
      setErro(err instanceof Error ? err.message : 'Falha ao consultar o faturamento.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const graficoRef = useRef<HTMLDivElement>(null);
  const limiteIni = dados?.disponivel.ini ?? '';
  const limiteFim = dados?.disponivel.fim && dados.disponivel.fim < hojeIso() ? dados.disponivel.fim : hojeIso();

  useEffect(() => {
    if (!dados?.disponivel) return;
    const hoje = hojeIso();
    const teto = dados.disponivel.fim < hoje ? dados.disponivel.fim : hoje;
    if (ini < dados.disponivel.ini) setIni(dados.disponivel.ini);
    if (fim > teto) setFim(teto);
  }, [dados, ini, fim]);

  useEffect(() => {
    void carregar(ini, fim);
  }, [ini, fim, carregar]);

  const mesesGrafico = (dados?.meses ?? []).filter(
    (item) => item.faturado !== 0 || item.desconto !== 0 || item.devolvido !== 0
  );

  useEffect(() => {
    const el = graficoRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [mesesGrafico.length, dados?.ini, dados?.fim]);

  const abrirDia = useCallback(async (dia: FaturamentoDia) => {
    if (diaAberto === dia.dia) {
      setDiaAberto(null);
      return;
    }
    setDiaAberto(dia.dia);
    setDocsErro(null);
    if (cacheRef.current.has(dia.dia)) return;
    setDocsCarregando(true);
    try {
      const resp = await fetchPainelFaturamentoDia(dia.dia);
      cacheRef.current.set(dia.dia, resp.documentos);
      setCacheTick((n) => n + 1);
    } catch (err) {
      setDocsErro(err instanceof Error ? err.message : 'Falha ao abrir o dia.');
    } finally {
      setDocsCarregando(false);
    }
  }, [diaAberto]);

  async function exportar() {
    if (exportando) return;
    setExportando(true);
    try {
      const resp = await fetchPainelFaturamentoLinhas(ini, fim);
      await exportarFaturamentoExcel(`${ini}_${fim}`, resp.linhas);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao gerar o Excel.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <PainelProducaoShell>
    <div className="dashboard faturamento-page">
      <header className="header">
        <div className="title-bar">Faturamento</div>
        <div className="filters">
          <ComoLerBtn onClick={() => setAjuda(true)} title="Como ler o faturamento" />
          <div className="filter-group">
            <label htmlFor="faturamento-ini">De</label>
            <input
              id="faturamento-ini"
              type="date"
              className="faturamento-data"
              value={ini < limiteIni ? limiteIni : ini}
              min={limiteIni || undefined}
              max={fim < limiteFim ? fim : limiteFim}
              disabled={carregando}
              onChange={(e) => {
                if (!e.target.value) return;
                periodoAntesRef.current = null;
                const valor = limiteIni && e.target.value < limiteIni ? limiteIni : e.target.value;
                setIni(valor > limiteFim ? limiteFim : valor);
              }}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="faturamento-fim">Até</label>
            <input
              id="faturamento-fim"
              type="date"
              className="faturamento-data"
              value={fim > limiteFim ? limiteFim : fim}
              min={ini > limiteIni ? ini : limiteIni || ini}
              max={limiteFim}
              disabled={carregando}
              onChange={(e) => {
                if (!e.target.value) return;
                periodoAntesRef.current = null;
                const valor = e.target.value > limiteFim ? limiteFim : e.target.value;
                setFim(limiteIni && valor < limiteIni ? limiteIni : valor);
              }}
            />
          </div>
        </div>
      </header>

      {erro && <p className="faturamento-erro">{erro}</p>}

      <div className="faturamento-kpis">
        {CARDS.map((card) => (
          <div key={card.chave} className={`kpi-card-modern ${card.accent}`}>
            <div className="kpi-card-body">
              <div className="kpi-label">{card.rotulo}</div>
              <div className="kpi-value">{dados ? formatMoeda(dados.totais[card.chave]) : '—'}</div>
              <div className="kpi-sub">{card.sub}</div>
            </div>
            <span className="kpi-accent" aria-hidden />
          </div>
        ))}
      </div>

      {dados && dados.meses.length > 0 && (
        <div className="card apuracao-card faturamento-chart-card">
          <div className="apuracao-card-header">
            <div>
              <h2>Faturamento mensal</h2>
              <p>Líquido dos meses dentro do período. Clique na barra para filtrar o mês; clique de novo para voltar ao período anterior.</p>
            </div>
          </div>
          <div className="faturamento-chart-scroll" ref={graficoRef}>
          <div className="faturamento-chart" style={{ width: Math.max(mesesGrafico.length * 76, 0), minWidth: '100%' }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={mesesGrafico.map((item) => ({ ...item, label: formatMesShort(item.mes) }))}
                margin={{ top: 22, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="label" interval={0} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)} mi` : v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v)
                  }
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,174,0,0.08)' }}
                  formatter={(value) => [formatMoeda(Number(value ?? 0)), 'Líquido']}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    background: '#1a2332',
                    border: '1px solid rgba(255,174,0,0.55)',
                    borderRadius: 8,
                    color: '#f3f6fa',
                  }}
                  labelStyle={{ color: '#ffae00', fontWeight: 700 }}
                  itemStyle={{ color: '#f3f6fa' }}
                />
                <Bar
                  dataKey="liquido"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={42}
                  cursor="pointer"
                  onClick={(bar) => {
                    const alvo = (bar as { mes?: string }).mes;
                    if (!alvo) return;
                    const periodo = periodoDoMes(alvo);
                    const jaNesteMes = ini === periodo.ini && fim === periodo.fim;
                    if (jaNesteMes && periodoAntesRef.current) {
                      setIni(periodoAntesRef.current.ini);
                      setFim(periodoAntesRef.current.fim);
                      periodoAntesRef.current = null;
                      return;
                    }
                    if (!jaNesteMes) {
                      if (!periodoAntesRef.current) periodoAntesRef.current = { ini, fim };
                      setIni(periodo.ini);
                      setFim(periodo.fim);
                    }
                  }}
                >
                  <LabelList
                    dataKey="liquido"
                    position="top"
                    formatter={(value) => rotuloBarra(Number(value ?? 0))}
                    style={{ fill: '#e8edf4', fontSize: 11, fontWeight: 700 }}
                  />
                  {mesesGrafico.map((item) => (
                      <Cell key={item.mes} fill={item.mes === ini.slice(0, 7) && item.mes === fim.slice(0, 7) ? '#ffae00' : '#4c6ef5'} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          </div>
        </div>
      )}

      <main className="apuracao-main">
        <div className="card apuracao-card">
          <div className="apuracao-card-header">
            <div>
              <h2>Conferência dia a dia</h2>
              <p>Clique no dia para ver as notas e as devoluções que formam o valor.</p>
            </div>
            <button
              type="button"
              className="apuracao-refresh-btn"
              onClick={() => void exportar()}
              disabled={carregando || exportando || !dados}
            >
              {exportando ? 'Gerando…' : 'Excel'}
            </button>
          </div>
          {carregando ? (
            <div className="faturamento-loading">
              <LoaderCirculo tamanho={48} cores={['#FFAD00', '#9BA3E8']} />
            </div>
          ) : (
            <div className="apuracao-table-wrap">
              <table className="apuracao-table faturamento-table">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Faturado</th>
                    <th>Desconto</th>
                    <th>Devolvido</th>
                    <th>Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {(dados?.dias ?? []).map((dia) => {
                    const aberto = diaAberto === dia.dia;
                    const movimentos = cacheRef.current.get(dia.dia);
                    return (
                      <Fragment key={dia.dia}>
                        <tr
                          className={`faturamento-row${aberto ? ' is-open' : ''}`}
                          onClick={() => void abrirDia(dia)}
                        >
                          <td>
                            <span className={`faturamento-seta${aberto ? ' is-open' : ''}`} aria-hidden />
                            {formatDia(dia.dia)}
                          </td>
                          <td className="faturamento-num">{formatMoeda(dia.faturado)}</td>
                          <td className="faturamento-num">{formatMoeda(dia.desconto)}</td>
                          <td className="faturamento-num">{formatMoeda(dia.devolvido)}</td>
                          <td className="faturamento-num faturamento-liquido">{formatMoeda(dia.liquido)}</td>
                        </tr>
                        {aberto && (
                          <tr className="faturamento-detalhe">
                            <td colSpan={5}>
                              {docsCarregando && !movimentos && (
                                <div className="faturamento-loading">
                                  <LoaderCirculo tamanho={32} cores={['#FFAD00', '#9BA3E8']} />
                                </div>
                              )}
                              {docsErro && !movimentos && <p className="faturamento-erro">{docsErro}</p>}
                              {movimentos && <MovimentosDia linhas={movimentos} />}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {dados && dados.dias.length === 0 && (
                    <tr>
                      <td colSpan={5} className="apuracao-empty">
                        Nenhum faturamento ou devolução neste mês.
                      </td>
                    </tr>
                  )}
                </tbody>
                {dados && dados.dias.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="faturamento-num">{formatMoeda(dados.totais.faturado)}</td>
                      <td className="faturamento-num">{formatMoeda(dados.totais.desconto)}</td>
                      <td className="faturamento-num">{formatMoeda(dados.totais.devolvido)}</td>
                      <td className="faturamento-num">{formatMoeda(dados.totais.liquido)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </main>

      <FaturamentoAjudaModal aberto={ajuda} onClose={() => setAjuda(false)} />
    </div>
    </PainelProducaoShell>
  );
}
