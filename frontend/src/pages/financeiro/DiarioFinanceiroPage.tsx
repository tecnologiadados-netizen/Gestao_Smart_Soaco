import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import {
  fetchDiarioContasPagar,
  reprogramarDiarioContasPagar,
  type DiarioContaPagarLinha,
  type DiarioContaPagarStatus,
} from '../../api/diarioFinanceiro';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';

type Atalho = 'hoje' | 'ontem' | 'amanha' | 'mes';

const FILTRO_INPUT_CLASS =
  'h-8 w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-2.5 text-xs focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const FILTRO_LABEL_CLASS = 'block text-[11px] leading-none text-slate-500 dark:text-slate-400 mb-1';
const FILTRO_BTN =
  'inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium border transition-colors disabled:opacity-60';

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function periodoAtalho(atalho: Atalho): { inicio: string; fim: string } {
  const hoje = new Date();
  if (atalho === 'hoje') {
    const y = ymdLocal(hoje);
    return { inicio: y, fim: y };
  }
  if (atalho === 'ontem') {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 1);
    const y = ymdLocal(d);
    return { inicio: y, fim: y };
  }
  if (atalho === 'amanha') {
    const d = new Date(hoje);
    d.setDate(d.getDate() + 1);
    const y = ymdLocal(d);
    return { inicio: y, fim: y };
  }
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return { inicio: ymdLocal(inicio), fim: ymdLocal(fim) };
}

function formatData(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function soma(linhas: DiarioContaPagarLinha[], campo: 'valor' | 'valorBaixado' | 'saldo'): number {
  return linhas.reduce((acc, l) => acc + (Number(l[campo]) || 0), 0);
}

const ATALHOS: { id: Atalho; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: 'amanha', label: 'Amanhã' },
  { id: 'mes', label: 'Este mês' },
];

const OPCOES_SITUACAO = ['Em aberto', 'Baixado'];
const OPCOES_ORIGEM = ['Nomus', 'Shop9'];

function selecionados(csv: string): Set<string> {
  return new Set(
    csv
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function chaveLinha(l: DiarioContaPagarLinha): string {
  return [
    l.origem,
    l.codigo,
    l.status,
    l.dataVencimento ?? '',
    l.dataBaixa ?? '',
    l.valor,
    l.saldo,
    l.idAgendamento ?? '',
    l.fornecedor ?? '',
    l.descricao ?? '',
    l.observacao ?? '',
  ].join('\u001f');
}

function idReprogramacao(l: DiarioContaPagarLinha): number | null {
  if (l.status !== 'Em aberto') return null;
  if (l.origem === 'Nomus') return l.idAgendamento && l.idAgendamento > 0 ? l.idAgendamento : null;
  return l.codigo > 0 ? l.codigo : null;
}

function podeReprogramar(l: DiarioContaPagarLinha): boolean {
  return idReprogramacao(l) != null;
}

function motivoBloqueio(l: DiarioContaPagarLinha): string | null {
  if (l.status === 'Baixado') return 'Título baixado não pode ser reprogramado.';
  if (l.origem === 'Nomus' && !(l.idAgendamento && l.idAgendamento > 0)) {
    return 'Lançamento sem agendamento financeiro. Não há id para alterar o vencimento.';
  }
  return null;
}

function dedupeReprogramar(linhas: DiarioContaPagarLinha[]): DiarioContaPagarLinha[] {
  const vistos = new Set<string>();
  const saida: DiarioContaPagarLinha[] = [];
  for (const l of linhas) {
    const id = idReprogramacao(l);
    if (id == null) continue;
    const chave = `${l.origem}:${id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(l);
  }
  return saida;
}

function empresaExibida(l: DiarioContaPagarLinha): string | null {
  if (l.filial?.trim()) return l.filial.trim();
  if (l.empresa?.trim()) return l.empresa.trim();
  return null;
}

function opcoesCampo(linhas: DiarioContaPagarLinha[], campo: 'fornecedor' | 'planoContas'): string[] {
  const set = new Set<string>();
  for (const l of linhas) {
    const v = l[campo];
    if (v?.trim()) set.add(v.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export default function DiarioFinanceiroPage() {
  const inicial = periodoAtalho('hoje');
  const [atalho, setAtalho] = useState<Atalho | null>('hoje');
  const [dataInicio, setDataInicio] = useState(inicial.inicio);
  const [dataFim, setDataFim] = useState(inicial.fim);
  const [faixaFiltrosVisivel, setFaixaFiltrosVisivel] = useState(true);
  const [fornecedores, setFornecedores] = useState('');
  const [empresas, setEmpresas] = useState('');
  const [planos, setPlanos] = useState('');
  const [origens, setOrigens] = useState('');
  const [situacoes, setSituacoes] = useState('');
  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState<DiarioContaPagarLinha[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set());
  const [modalAberto, setModalAberto] = useState(false);
  const [modalLinhas, setModalLinhas] = useState<DiarioContaPagarLinha[]>([]);
  const [novaData, setNovaData] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async (inicio: string, fim: string) => {
    setLoading(true);
    setErro(null);
    setAviso(null);
    try {
      const res = await fetchDiarioContasPagar({ dataInicio: inicio, dataFim: fim });
      setLinhas(res.linhas);
      setSelecionadas(new Set());
      const partes = [res.erroShop9, res.erroNomus].filter(Boolean);
      setAviso(partes.length > 0 ? partes.join(' · ') : null);
    } catch (e) {
      setLinhas([]);
      setSelecionadas(new Set());
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar(inicial.inicio, inicial.fim);
    // carga do dia corrente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregar]);

  const aplicarAtalho = (id: Atalho) => {
    const p = periodoAtalho(id);
    setAtalho(id);
    setDataInicio(p.inicio);
    setDataFim(p.fim);
    void carregar(p.inicio, p.fim);
  };

  const aplicarIntervalo = () => {
    setAtalho(null);
    void carregar(dataInicio, dataFim);
  };

  const opcoesFornecedor = useMemo(() => opcoesCampo(linhas, 'fornecedor'), [linhas]);
  const opcoesEmpresa = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhas) {
      const v = empresaExibida(l);
      if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [linhas]);
  const opcoesPlano = useMemo(() => opcoesCampo(linhas, 'planoContas'), [linhas]);

  const linhasFiltradas = useMemo(() => {
    const fFornecedor = selecionados(fornecedores);
    const fEmpresa = selecionados(empresas);
    const fPlano = selecionados(planos);
    const fOrigem = selecionados(origens);
    const fSituacao = selecionados(situacoes);
    const casaObs = criarMatcherTextoLivre(observacao);
    return linhas.filter((l) => {
      if (fSituacao.size > 0 && !fSituacao.has(l.status)) return false;
      if (fOrigem.size > 0 && !fOrigem.has(l.origem)) return false;
      if (fFornecedor.size > 0 && !fFornecedor.has(l.fornecedor ?? '')) return false;
      if (fEmpresa.size > 0 && !fEmpresa.has(empresaExibida(l) ?? '')) return false;
      if (fPlano.size > 0 && !fPlano.has(l.planoContas ?? '')) return false;
      if (observacao.trim()) {
        const texto = `${l.observacao ?? ''} ${l.descricao ?? ''}`;
        if (!casaObs(texto)) return false;
      }
      return true;
    });
  }, [linhas, fornecedores, empresas, planos, origens, situacoes, observacao]);

  const elegiveisVisiveis = useMemo(
    () => linhasFiltradas.filter(podeReprogramar),
    [linhasFiltradas],
  );
  const qtdSelecionadaVisivel = useMemo(
    () => elegiveisVisiveis.filter((l) => selecionadas.has(chaveLinha(l))).length,
    [elegiveisVisiveis, selecionadas],
  );
  const todosVisiveisMarcados =
    elegiveisVisiveis.length > 0 && qtdSelecionadaVisivel === elegiveisVisiveis.length;
  const headerCheckRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = headerCheckRef.current;
    if (!el) return;
    el.indeterminate = qtdSelecionadaVisivel > 0 && !todosVisiveisMarcados;
  }, [qtdSelecionadaVisivel, todosVisiveisMarcados]);

  const alternarTodos = () => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (todosVisiveisMarcados) {
        for (const l of elegiveisVisiveis) next.delete(chaveLinha(l));
      } else {
        for (const l of elegiveisVisiveis) next.add(chaveLinha(l));
      }
      return next;
    });
  };

  const alternarUm = (l: DiarioContaPagarLinha) => {
    if (!podeReprogramar(l)) return;
    const chave = chaveLinha(l);
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  };

  const abrirReprogramar = () => {
    const escolhidas = dedupeReprogramar(
      linhas.filter((l) => podeReprogramar(l) && selecionadas.has(chaveLinha(l))),
    );
    if (escolhidas.length === 0) return;
    setModalLinhas(escolhidas);
    setNovaData('');
    setErroModal(null);
    setModalAberto(true);
  };

  const confirmarReprogramar = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData) || salvando) return;
    const itens = modalLinhas.flatMap((l) => {
      const id = idReprogramacao(l);
      return id == null ? [] : [{ origem: l.origem, id }];
    });
    if (itens.length === 0) return;
    setSalvando(true);
    setErroModal(null);
    try {
      const res = await reprogramarDiarioContasPagar({ dataVencimento: novaData, itens });
      const partes: string[] = [];
      if (res.atualizados > 0) {
        partes.push(`${res.atualizados.toLocaleString('pt-BR')} vencimento(s) atualizado(s) para ${formatData(res.dataVencimento)}.`);
      }
      if (res.ignorados.length > 0) {
        partes.push(`${res.ignorados.length.toLocaleString('pt-BR')} título(s) não alterado(s) porque já estavam baixados ou o id não confere.`);
      }
      if (res.erroNomus) partes.push(`Nomus: ${res.erroNomus}`);
      if (res.erroShop9) partes.push(`Shop9: ${res.erroShop9}`);
      const texto = partes.join(' ');
      if (res.atualizados > 0) {
        setSelecionadas(new Set());
        setAviso(texto || null);
        setModalAberto(false);
        await carregar(dataInicio, dataFim);
      } else {
        setErroModal(texto || 'Nenhum vencimento foi alterado.');
      }
    } catch (e) {
      setErroModal(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const totais = useMemo(
    () => ({
      qtd: linhasFiltradas.length,
      valor: soma(linhasFiltradas, 'valor'),
      baixado: soma(linhasFiltradas, 'valorBaixado'),
      saldo: soma(linhasFiltradas, 'saldo'),
    }),
    [linhasFiltradas],
  );

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="card-panel shrink-0 overflow-visible">
        <div className="px-4 pt-3 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Diário Financeiro</h1>
        </div>
        <div className="px-4 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700">
          <button
            type="button"
            className="px-3 py-2 text-sm font-medium border-b-2 border-primary-600 text-primary-700 dark:text-primary-300"
          >
            Contas a pagar
          </button>
          <button
            type="button"
            onClick={() => setFaixaFiltrosVisivel((v) => !v)}
            aria-expanded={faixaFiltrosVisivel}
            aria-label={faixaFiltrosVisivel ? 'Ocultar filtros' : 'Mostrar filtros'}
            title={faixaFiltrosVisivel ? 'Ocultar filtros' : 'Mostrar filtros'}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <svg
              className={`h-4 w-4 transition-transform ${faixaFiltrosVisivel ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {faixaFiltrosVisivel ? 'Ocultar' : 'Filtros'}
          </button>
        </div>

        {faixaFiltrosVisivel ? (
          <div className="px-3 py-2 flex flex-wrap items-end gap-2">
            <div>
              <span className={FILTRO_LABEL_CLASS}>Período</span>
              <div className="inline-flex h-8 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                {ATALHOS.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => aplicarAtalho(a.id)}
                    disabled={loading}
                    className={`inline-flex h-8 items-center px-3 text-xs font-medium transition-colors disabled:opacity-60 ${
                      i > 0 ? 'border-l border-slate-300 dark:border-slate-600' : ''
                    } ${
                      atalho === a.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-[9.25rem]">
              <label className={FILTRO_LABEL_CLASS}>Vencimento de</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setAtalho(null);
                  setDataInicio(e.target.value);
                }}
                className={FILTRO_INPUT_CLASS}
                disabled={loading}
              />
            </div>
            <div className="w-[9.25rem]">
              <label className={FILTRO_LABEL_CLASS}>até</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setAtalho(null);
                  setDataFim(e.target.value);
                }}
                className={FILTRO_INPUT_CLASS}
                disabled={loading}
              />
            </div>
            <button
              type="button"
              onClick={aplicarIntervalo}
              disabled={loading || !dataInicio || !dataFim}
              className={`${FILTRO_BTN} border-primary-600 bg-primary-600 text-white hover:bg-primary-700`}
            >
              {loading ? 'Buscando…' : 'Buscar'}
            </button>
            <FiltroMulti
              label="Fornecedor"
              placeholder="Todos"
              options={opcoesFornecedor}
              value={fornecedores}
              onChange={setFornecedores}
              optionLabel="fornecedores"
              minWidth="150px"
              disabled={loading || opcoesFornecedor.length === 0}
            />
            <FiltroMulti
              label="Empresa"
              placeholder="Todas"
              options={opcoesEmpresa}
              value={empresas}
              onChange={setEmpresas}
              optionLabel="empresas"
              minWidth="140px"
              disabled={loading || opcoesEmpresa.length === 0}
            />
            <FiltroMulti
              label="Plano de contas"
              placeholder="Todos"
              options={opcoesPlano}
              value={planos}
              onChange={setPlanos}
              optionLabel="planos"
              minWidth="160px"
              disabled={loading || opcoesPlano.length === 0}
            />
            <FiltroMulti
              label="Origem"
              placeholder="Todas"
              options={OPCOES_ORIGEM}
              value={origens}
              onChange={setOrigens}
              optionLabel="origens"
              minWidth="110px"
              disabled={loading}
            />
            <FiltroMulti
              label="Situação"
              placeholder="Todas"
              options={OPCOES_SITUACAO}
              value={situacoes}
              onChange={setSituacoes}
              optionLabel="situações"
              minWidth="120px"
              disabled={loading}
            />
            <div className="w-44">
              <label className={FILTRO_LABEL_CLASS}>Observações</label>
              <input
                type="search"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Descrição ou comentário"
                className={FILTRO_INPUT_CLASS}
              />
            </div>
          </div>
        ) : null}
      </div>

      {erro && (
        <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 px-4 py-2 text-sm">
          {erro}
        </div>
      )}
      {aviso && !erro && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 px-4 py-2 text-sm">
          {aviso}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Resumo label="Lançamentos" valor={totais.qtd.toLocaleString('pt-BR')} />
        <Resumo label="Valor" valor={formatMoeda(totais.valor)} />
        <Resumo label="Baixado" valor={formatMoeda(totais.baixado)} />
        <Resumo label="Saldo" valor={formatMoeda(totais.saldo)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {selecionadas.size.toLocaleString('pt-BR')} selecionado(s). Título baixado não pode ser reprogramado.
        </p>
        <button
          type="button"
          onClick={abrirReprogramar}
          disabled={selecionadas.size === 0}
          className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Reprogramar
        </button>
      </div>

      <div
        className={`card-panel min-h-0 overflow-auto !p-0 ${
          faixaFiltrosVisivel ? 'max-h-[calc(100svh-18.5rem)]' : 'max-h-[calc(100svh-14rem)]'
        }`}
      >
        <table className="min-w-[1100px] w-full text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="sticky left-0 z-20 w-8 bg-slate-100 px-2 py-2 dark:bg-slate-800">
                <input
                  ref={headerCheckRef}
                  type="checkbox"
                  checked={todosVisiveisMarcados}
                  onChange={alternarTodos}
                  disabled={elegiveisVisiveis.length === 0}
                  aria-label="Selecionar todos os títulos em aberto"
                  className="rounded border-slate-400 text-primary-600 focus:ring-primary-500 disabled:opacity-40"
                />
              </th>
              {[
                'Origem',
                'Situação',
                'Vencimento',
                'Baixa',
                'Fornecedor',
                'Empresa',
                'Plano de contas',
                'Descrição',
                'Observações',
                'Forma pgto',
                'Conta bancária',
                'Valor',
                'Baixado',
                'Saldo',
              ].map((col) => (
                <th
                  key={col}
                  className={`px-2 py-2 font-medium whitespace-nowrap ${
                    col === 'Valor' || col === 'Baixado' || col === 'Saldo' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.length === 0 && !loading && (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                  Nenhum contas a pagar neste vencimento.
                </td>
              </tr>
            )}
            {linhasFiltradas.map((l, i) => {
              const chave = chaveLinha(l);
              const bloqueio = motivoBloqueio(l);
              const marcado = selecionadas.has(chave);
              return (
              <tr
                key={`${chave}-${i}`}
                className="border-t border-slate-100 dark:border-slate-700/80 text-slate-800 dark:text-slate-100"
              >
                <td className="sticky left-0 z-[1] bg-white px-2 py-1.5 dark:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={bloqueio != null}
                    onChange={() => alternarUm(l)}
                    aria-label={
                      bloqueio
                        ? bloqueio
                        : `Selecionar título ${l.codigo}`
                    }
                    title={bloqueio ?? `Selecionar título ${l.codigo}`}
                    className="rounded border-slate-400 text-primary-600 focus:ring-primary-500 disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l.origem}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatData(l.dataVencimento)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatData(l.dataBaixa)}</td>
                <td className="px-2 py-1.5 max-w-[14rem] truncate" title={l.fornecedor ?? ''}>
                  {l.fornecedor ?? '—'}
                </td>
                <td className="px-2 py-1.5 max-w-[12rem] truncate" title={empresaExibida(l) ?? ''}>
                  {empresaExibida(l) ?? '—'}
                </td>
                <td className="px-2 py-1.5 max-w-[14rem] truncate" title={l.planoContas ?? ''}>
                  {l.planoContas ?? '—'}
                </td>
                <td className="px-2 py-1.5 max-w-[16rem] truncate" title={l.descricao ?? ''}>
                  {l.descricao ?? '—'}
                </td>
                <td className="px-2 py-1.5 max-w-[14rem] truncate" title={l.observacao ?? ''}>
                  {l.observacao ?? '—'}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l.formaPagamento ?? '—'}</td>
                <td className="px-2 py-1.5 max-w-[10rem] truncate" title={l.contaBancaria ?? ''}>
                  {l.contaBancaria ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{formatMoeda(l.valor)}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{formatMoeda(l.valorBaixado)}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{formatMoeda(l.saldo)}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalAberto ? (
        <ModalReprogramar
          linhas={modalLinhas}
          novaData={novaData}
          onChangeData={setNovaData}
          onClose={() => {
            if (!salvando) setModalAberto(false);
          }}
          onConfirm={() => void confirmarReprogramar()}
          salvando={salvando}
          erro={erroModal}
        />
      ) : null}
    </div>
  );
}

function FiltroMulti({
  label,
  placeholder,
  options,
  value,
  onChange,
  optionLabel,
  minWidth,
  disabled,
}: {
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  optionLabel: string;
  minWidth: string;
  disabled?: boolean;
}) {
  return (
    <MultiSelectWithSearch
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={onChange}
      labelClass={FILTRO_LABEL_CLASS}
      inputClass={FILTRO_INPUT_CLASS}
      optionLabel={optionLabel}
      valueSeparator="|"
      minWidth={minWidth}
      disabled={disabled}
      dropdownZIndex={200}
    />
  );
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card-panel px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{valor}</div>
    </div>
  );
}

function ModalReprogramar({
  linhas,
  novaData,
  onChangeData,
  onClose,
  onConfirm,
  salvando,
  erro,
}: {
  linhas: DiarioContaPagarLinha[];
  novaData: string;
  onChangeData: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  salvando: boolean;
  erro: string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !salvando) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, salvando]);

  const total = linhas.reduce((acc, l) => acc + (Number(l.saldo) || 0), 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reprogramar-titulo"
        className="relative z-[81] flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 id="reprogramar-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Reprogramar vencimento
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {linhas.length.toLocaleString('pt-BR')} título(s) em aberto. A data de vencimento é alterada no
            Nomus pelo id do agendamento e no Shop9 pela Ordem. Na primeira vez, a descrição recebe o vencimento original.
          </p>
        </div>
        <div className="px-5 pb-3">
          <label className={FILTRO_LABEL_CLASS} htmlFor="reprogramar-nova-data">
            Novo vencimento
          </label>
          <input
            id="reprogramar-nova-data"
            type="date"
            value={novaData}
            onChange={(e) => onChangeData(e.target.value)}
            disabled={salvando}
            className={`${FILTRO_INPUT_CLASS} max-w-[12rem]`}
          />
          {erro ? <p className="mt-2 text-xs text-red-700 dark:text-red-300">{erro}</p> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto border-y border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                {['Origem', 'Código', 'Fornecedor', 'Empresa', 'Vencimento atual', 'Saldo'].map((col) => (
                  <th
                    key={col}
                    className={`px-3 py-2 font-medium whitespace-nowrap ${col === 'Saldo' ? 'text-right' : 'text-left'}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr
                  key={`${chaveLinha(l)}-${i}`}
                  className="border-t border-slate-100 text-slate-800 dark:border-slate-700 dark:text-slate-100"
                >
                  <td className="px-3 py-1.5 whitespace-nowrap">{l.origem}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{idReprogramacao(l) ?? l.codigo}</td>
                  <td className="px-3 py-1.5 max-w-[16rem] truncate" title={l.fornecedor ?? ''}>
                    {l.fornecedor ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 max-w-[12rem] truncate" title={empresaExibida(l) ?? ''}>
                    {empresaExibida(l) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatData(l.dataVencimento)}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{formatMoeda(l.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saldo dos selecionados: {formatMoeda(total)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={salvando || !novaData}
              className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {salvando ? 'Reprogramando…' : 'Reprogramar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DiarioContaPagarStatus }) {
  const aberto = status === 'Em aberto';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
        aberto
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      }`}
    >
      {status}
    </span>
  );
}
