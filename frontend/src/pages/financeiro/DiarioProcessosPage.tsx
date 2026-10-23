import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Plus } from 'lucide-react';
import { PERMISSOES } from '../../config/permissoes';
import { useAuth } from '../../contexts/AuthContext';
import {
  aprovarProcessoDiario,
  devolverProcessoDiario,
  enviarProcessoDiario,
  iniciarProcessoDiario,
  listarHistoricoProcessoDiario,
  listarProcessosDiario,
  type DiarioProcesso,
  type DiarioProcessoHistorico,
  type StatusProcessoDiario,
} from '../../api/diarioFinanceiro';
import DiarioFinanceiroPage, { type DiarioAprovacaoSelecao } from './DiarioFinanceiroPage';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';

const STATUS_LABEL: Record<StatusProcessoDiario, string> = {
  rascunho: 'Rascunho',
  em_aprovacao: 'Em aprovação',
  aprovado: 'Aprovado',
  em_correcao: 'Em correção',
};

const STATUS_CLASSE: Record<StatusProcessoDiario, string> = {
  rascunho: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
  em_aprovacao: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  aprovado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  em_correcao: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
};

function hojeYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const DIAS_SEMANA = ['Domingo', 'Segunda Feira', 'Terça Feira', 'Quarta Feira', 'Quinta Feira', 'Sexta Feira', 'Sábado'] as const;

function formatarData(ymd: string): string {
  const [ano, mes, dia] = ymd.split('-');
  if (!ano || !mes || !dia) return ymd;
  return `${dia}/${mes}/${ano}`;
}

function descricaoPadraoContasPagar(ymd: string): string {
  const [ano, mes, dia] = ymd.split('-').map((parte) => Number(parte));
  if (!ano || !mes || !dia) return '';
  const data = new Date(ano, mes - 1, dia);
  if (Number.isNaN(data.getTime())) return '';
  const dd = String(dia).padStart(2, '0');
  const mm = String(mes).padStart(2, '0');
  return `Contas a Pagar - ${dd}/${mm} - ${DIAS_SEMANA[data.getDay()]}`;
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarMoeda(valor: number): string {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function DiarioProcessosPage() {
  const { hasPermission } = useAuth();
  const podeAprovar =
    hasPermission(PERMISSOES.FINANCEIRO_DIARIO_APROVAR) || hasPermission(PERMISSOES.FINANCEIRO_VER);

  const [processos, setProcessos] = useState<DiarioProcesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState<DiarioProcesso | null>(null);
  const [fluxo, setFluxo] = useState(false);
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroDescricao, setFiltroDescricao] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusProcessoDiario | ''>('');
  const [historicoProcesso, setHistoricoProcesso] = useState<DiarioProcesso | null>(null);
  const [historico, setHistorico] = useState<DiarioProcessoHistorico[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoErro, setHistoricoErro] = useState<string | null>(null);

  const [iniciarAberto, setIniciarAberto] = useState(false);
  const [novaData, setNovaData] = useState(hojeYmd);

  const [aprovacaoAberta, setAprovacaoAberta] = useState(false);
  const [contasAprovacao, setContasAprovacao] = useState<DiarioAprovacaoSelecao[]>([]);
  const [devolverAberto, setDevolverAberto] = useState(false);
  const [motivo, setMotivo] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setProcessos(await listarProcessosDiario());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const processosFiltrados = useMemo(() => {
    const codigo = criarMatcherTextoLivre(filtroCodigo);
    const descricao = criarMatcherTextoLivre(filtroDescricao);
    const usuario = criarMatcherTextoLivre(filtroUsuario);
    return processos.filter((processo) => {
      if (filtroCodigo.trim() && !codigo(String(processo.codigo))) return false;
      if (filtroDataInicio && processo.dataVencimento < filtroDataInicio) return false;
      if (filtroDataFim && processo.dataVencimento > filtroDataFim) return false;
      if (filtroDescricao.trim() && !descricao(descricaoPadraoContasPagar(processo.dataVencimento))) return false;
      if (filtroUsuario.trim() && !usuario(processo.usuario)) return false;
      if (filtroStatus && processo.status !== filtroStatus) return false;
      return true;
    });
  }, [
    filtroCodigo,
    filtroDataFim,
    filtroDataInicio,
    filtroDescricao,
    filtroStatus,
    filtroUsuario,
    processos,
  ]);

  const limparFiltros = () => {
    setFiltroCodigo('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroDescricao('');
    setFiltroUsuario('');
    setFiltroStatus('');
  };

  const abrirHistorico = async (processo: DiarioProcesso) => {
    setHistoricoProcesso(processo);
    setHistorico([]);
    setHistoricoErro(null);
    setHistoricoLoading(true);
    try {
      setHistorico(await listarHistoricoProcessoDiario(processo.id));
    } catch (e) {
      setHistoricoErro(e instanceof Error ? e.message : String(e));
    } finally {
      setHistoricoLoading(false);
    }
  };

  const abrir = (processo: DiarioProcesso) => {
    setContasAprovacao([]);
    setAberto(processo);
  };

  const substituir = (processo: DiarioProcesso) => {
    setAberto(processo);
    setProcessos((prev) => prev.map((p) => (p.id === processo.id ? processo : p)));
  };

  const iniciar = async () => {
    if (fluxo) return;
    const descricao = descricaoPadraoContasPagar(novaData);
    if (!descricao) {
      setErro('Informe a data de vencimento.');
      return;
    }
    setFluxo(true);
    setErro(null);
    try {
      const res = await iniciarProcessoDiario({ dataVencimento: novaData, descricao });
      setIniciarAberto(false);
      setProcessos((prev) => {
        const sem = prev.filter((p) => p.id !== res.processo.id);
        return [res.processo, ...sem].sort((a, b) => b.dataVencimento.localeCompare(a.dataVencimento) || b.codigo - a.codigo);
      });
      if (res.existente) setAviso('Já existe um contas a pagar neste dia. O processo existente foi aberto.');
      else setAviso(null);
      abrir(res.processo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setFluxo(false);
    }
  };

  const enviar = async () => {
    if (!aberto || fluxo) return;
    setFluxo(true);
    setErro(null);
    try {
      substituir(await enviarProcessoDiario(aberto.id));
      setAviso(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setFluxo(false);
    }
  };

  const aprovar = async () => {
    if (!aberto || fluxo) return;
    setFluxo(true);
    setErro(null);
    try {
      const resultado = await aprovarProcessoDiario(
        aberto.id,
        contasAprovacao.map(({ linha, banco }) => ({
          origem: linha.origem,
          codigo: linha.codigo,
          banco: banco.trim(),
        })),
      );
      substituir(resultado.processo);
      setAviso(`${resultado.aprovados.toLocaleString('pt-BR')} conta(s) aprovada(s) e enviada(s).`);
      setAprovacaoAberta(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setFluxo(false);
    }
  };

  const receberSelecaoAprovacao = useCallback((itens: DiarioAprovacaoSelecao[]) => {
    setContasAprovacao(itens);
  }, []);

  const devolver = async () => {
    if (!aberto || fluxo) return;
    setFluxo(true);
    setErro(null);
    try {
      substituir(await devolverProcessoDiario(aberto.id, motivo));
      setMotivo('');
      setDevolverAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setFluxo(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="card-panel shrink-0">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Diário Financeiro</h1>
          <button
            type="button"
            onClick={() => {
              setNovaData(hojeYmd());
              setErro(null);
              setIniciarAberto(true);
            }}
            aria-label="Iniciar contas a pagar"
            title="Iniciar contas a pagar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="card-panel shrink-0">
        <div className="flex flex-wrap items-end gap-2 px-3 py-2">
          <label className="w-24">
            <span className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">Código</span>
            <input
              type="search"
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
              placeholder="Ex.: 8 ou 8%"
              className="h-8 w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
          <label className="w-36">
            <span className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">Vencimento de</span>
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="h-8 w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
          <label className="w-36">
            <span className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">Até</span>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              className="h-8 w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
          <label className="min-w-48 flex-1">
            <span className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">Descrição</span>
            <input
              type="search"
              value={filtroDescricao}
              onChange={(e) => setFiltroDescricao(e.target.value)}
              placeholder="Digite parte do texto; use % para refinar"
              className="h-8 w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
          <label className="w-40">
            <span className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">Usuário</span>
            <input
              type="search"
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
              placeholder="Nome; use %"
              className="h-8 w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
          <label className="w-40">
            <span className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">Status</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as StatusProcessoDiario | '')}
              className="h-8 w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={limparFiltros}
            className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Limpar
          </button>
          <span className="pb-2 text-xs text-slate-500 dark:text-slate-400">
            {processosFiltrados.length.toLocaleString('pt-BR')} resultado(s)
          </span>
        </div>
      </div>

      {erro && !aberto ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </div>
      ) : null}
      {aviso && !aberto ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          {aviso}
        </div>
      ) : null}

      <div className="card-panel min-h-0 overflow-auto !p-0">
        <table className="min-w-[980px] w-full table-fixed text-sm [&_th]:whitespace-normal [&_th]:break-words [&_th]:[overflow-wrap:anywhere]">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-[23%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[140px]" />
            <col className="w-[170px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-primary-600 text-white">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Código</th>
              <th className="px-3 py-2 text-left font-semibold">Data</th>
              <th className="px-3 py-2 text-left font-semibold">Criado em</th>
              <th className="px-3 py-2 text-left font-semibold">Descrição</th>
              <th className="px-3 py-2 text-left font-semibold">Usuário</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-right font-semibold">Total aprovado</th>
              <th className="px-3 py-2 text-left font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody className="[&_td]:align-top [&_td]:whitespace-normal [&_td]:break-words [&_td]:overflow-visible [&_td]:text-clip [&_td]:[overflow-wrap:anywhere]">
            {processosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                  {loading
                    ? 'Carregando…'
                    : processos.length === 0
                      ? 'Nenhum contas a pagar iniciado.'
                      : 'Nenhum processo encontrado com os filtros informados.'}
                </td>
              </tr>
            ) : (
              processosFiltrados.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 whitespace-nowrap">{p.codigo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatarData(p.dataVencimento)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatarDataHora(p.criadoEm)}</td>
                  <td className="px-3 py-2 max-w-[24rem] truncate" title={descricaoPadraoContasPagar(p.dataVencimento)}>
                    {descricaoPadraoContasPagar(p.dataVencimento)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.usuario}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {p.status === 'aprovado' ? (
                      <span className="inline-flex min-w-[7rem] justify-end rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 font-semibold tabular-nums text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                        {formatarMoeda(p.totalAprovado)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAviso(null);
                          abrir(p);
                        }}
                        className="inline-flex h-7 items-center rounded-lg border border-primary-600 px-2.5 text-xs font-medium text-primary-700 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-slate-700"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={() => void abrirHistorico(p)}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <History className="h-3.5 w-3.5" />
                        Histórico
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {historicoProcesso ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-800">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Histórico do contas a pagar #{historicoProcesso.codigo}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {descricaoPadraoContasPagar(historicoProcesso.dataVencimento)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoricoProcesso(null)}
                className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Fechar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {historicoLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Carregando histórico…</p>
              ) : historicoErro ? (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {historicoErro}
                </p>
              ) : historico.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Nenhuma movimentação registrada.</p>
              ) : (
                <ol className="space-y-3">
                  {[...historico].reverse().map((item) => (
                    <li key={item.id} className="rounded-lg border border-slate-200 px-3 py-3 dark:border-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.acao}</span>
                        <time className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                          {formatarDataHora(item.criadoEm)}
                        </time>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        Usuário: <span className="font-medium">{item.usuario}</span>
                        {' · '}
                        Status: {item.statusAnterior
                          ? `${STATUS_LABEL[item.statusAnterior as StatusProcessoDiario] ?? item.statusAnterior} → `
                          : ''}
                        {STATUS_LABEL[item.statusNovo as StatusProcessoDiario] ?? item.statusNovo}
                      </p>
                      {item.detalhe ? (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">{item.detalhe}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {iniciarAberto ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800"
            onSubmit={(e) => {
              e.preventDefault();
              void iniciar();
            }}
          >
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Iniciar contas a pagar</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Um processo por dia de vencimento.</p>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Data de vencimento
              <input
                type="date"
                required
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Descrição</p>
              <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                {descricaoPadraoContasPagar(novaData) || 'Informe a data de vencimento.'}
              </p>
            </div>
            {erro ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{erro}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIniciarAberto(false)}
                className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={fluxo}
                className="h-8 rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {fluxo ? 'Iniciando…' : 'Iniciar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {aberto ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-white dark:bg-slate-900">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {descricaoPadraoContasPagar(aberto.dataVencimento)}
                </h2>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSE[aberto.status]}`}>
                  {STATUS_LABEL[aberto.status]}
                </span>
              </div>
              {aberto.motivoDevolucao ? (
                <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">Devolução: {aberto.motivoDevolucao}</p>
              ) : null}
              {aviso ? <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{aviso}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setAberto(null);
                setErro(null);
                setAviso(null);
              }}
              className="inline-flex h-8 shrink-0 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
            >
              Fechar
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <DiarioFinanceiroPage
              key={aberto.id}
              modo={{
                dataFixa: aberto.dataVencimento,
                editavel: aberto.editavel,
                aprovacao: podeAprovar && aberto.status === 'em_aprovacao',
                processoId: aberto.id,
                resultadoAprovacao: aberto.status === 'aprovado',
                onAprovacaoChange: receberSelecaoAprovacao,
              }}
            />
          </div>
          {erro ? (
            <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {erro}
            </div>
          ) : null}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
            {aberto.editavel ? (
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={fluxo}
                className="h-8 rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Enviar para aprovação
              </button>
            ) : null}
            {podeAprovar && aberto.status === 'em_aprovacao' ? (
              <button
                type="button"
                onClick={() => {
                  if (contasAprovacao.length === 0) {
                    setErro('Marque ao menos uma conta para aprovar.');
                    return;
                  }
                  if (contasAprovacao.some((item) => !item.banco.trim())) {
                    setErro('Informe o Banco de todas as contas marcadas antes de aprovar.');
                    return;
                  }
                  setErro(null);
                  setAprovacaoAberta(true);
                }}
                disabled={fluxo}
                className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Aprovar
              </button>
            ) : null}
            {podeAprovar && (aberto.status === 'em_aprovacao' || aberto.status === 'aprovado') ? (
              <button
                type="button"
                onClick={() => {
                  setMotivo('');
                  setErro(null);
                  setDevolverAberto(true);
                }}
                disabled={fluxo}
                className="h-8 rounded-lg border border-orange-500 px-3 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50 dark:text-orange-200 dark:hover:bg-slate-700"
              >
                Devolver para correção
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {aprovacaoAberta ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <form
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800"
            onSubmit={(e) => {
              e.preventDefault();
              void aprovar();
            }}
          >
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Aprovar contas a pagar</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Confira o lote parcial. Somente estas {contasAprovacao.length.toLocaleString('pt-BR')} conta(s) serão aprovadas e enviadas.
            </p>
            <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-600">
              <table className="w-full min-w-[680px] text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="px-2 py-2 text-left">Origem / código</th>
                    <th className="px-2 py-2 text-left">Pessoa</th>
                    <th className="px-2 py-2 text-left">Empresa</th>
                    <th className="px-2 py-2 text-left">Banco</th>
                    <th className="px-2 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {contasAprovacao.map(({ linha, banco }) => (
                    <tr key={`${linha.origem}:${linha.codigo}`} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-2 py-1.5 whitespace-nowrap">{linha.origem} · {linha.codigo}</td>
                      <td className="max-w-[15rem] truncate px-2 py-1.5" title={linha.fornecedor ?? ''}>{linha.fornecedor ?? '—'}</td>
                      <td className="max-w-[12rem] truncate px-2 py-1.5" title={linha.filial ?? linha.empresa ?? ''}>{linha.filial ?? linha.empresa ?? '—'}</td>
                      <td className="max-w-[12rem] truncate px-2 py-1.5 font-medium" title={banco}>{banco}</td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        {Number(linha.saldo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-50 font-semibold dark:bg-slate-700">
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-right">Total</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {contasAprovacao.reduce((total, item) => total + (Number(item.linha.saldo) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {erro ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{erro}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAprovacaoAberta(false);
                  setErro(null);
                }}
                className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={fluxo}
                className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {fluxo ? 'Aprovando…' : 'Confirmar e enviar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {devolverAberto ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800"
            onSubmit={(e) => {
              e.preventDefault();
              void devolver();
            }}
          >
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Devolver para correção</h2>
            <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Motivo (opcional)
              <textarea
                value={motivo}
                maxLength={500}
                onChange={(e) => setMotivo(e.target.value)}
                className="mt-1 min-h-[5rem] w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            {erro ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{erro}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDevolverAberto(false);
                  setMotivo('');
                  setErro(null);
                }}
                className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={fluxo}
                className="h-8 rounded-lg bg-orange-600 px-3 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {fluxo ? 'Devolvendo…' : 'Devolver'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
