import { useCallback, useEffect, useRef, useState } from 'react';
import { Users, Building2, X } from 'lucide-react';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import KpiPainelVoltarLink from '../../components/kpis/KpiPainelVoltarLink';
import {
  fetchGrupoEconomicoDetalhe,
  fetchGruposEconomicos,
  type GrupoEconomicoDetalhe,
  type GrupoEconomicoLinha,
  type GrupoEconomicoResumo,
} from '../../api/grupoEconomico';
import GrupoEconomicoAjudaModal from './GrupoEconomicoAjudaModal';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR');
}

export default function GrupoEconomicoPage() {
  const [buscaDraft, setBuscaDraft] = useState('');
  const [somenteAtivosDraft, setSomenteAtivosDraft] = useState(true);
  const [busca, setBusca] = useState('');
  const [somenteAtivos, setSomenteAtivos] = useState(true);

  const [resumo, setResumo] = useState<GrupoEconomicoResumo>({ totalGrupos: 0, totalPessoas: 0 });
  const [grupos, setGrupos] = useState<GrupoEconomicoLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<GrupoEconomicoDetalhe | null>(null);
  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoEconomicoLinha | null>(null);

  const detalheCacheRef = useRef(new Map<string, GrupoEconomicoDetalhe>());

  const carregar = useCallback(async (f: { busca: string; somenteAtivos: boolean }) => {
    setLoading(true);
    setErro(null);
    try {
      const data = await fetchGruposEconomicos(f);
      setResumo(data.resumo);
      setGrupos(data.grupos);
      if (data.error) setErro(data.error);
    } catch (e) {
      setResumo({ totalGrupos: 0, totalPessoas: 0 });
      setGrupos([]);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar grupos econômicos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar({ busca, somenteAtivos });
  }, [carregar, busca, somenteAtivos]);

  const filtrar = () => {
    detalheCacheRef.current.clear();
    setBusca(buscaDraft.trim());
    setSomenteAtivos(somenteAtivosDraft);
  };

  const abrirDetalhe = async (grupo: GrupoEconomicoLinha) => {
    setGrupoSelecionado(grupo);
    setModalAberto(true);
    setDetalheErro(null);

    const cacheKey = `${grupo.id}|${somenteAtivos ? 1 : 0}`;
    const cached = detalheCacheRef.current.get(cacheKey);
    if (cached) {
      setDetalhe(cached);
      return;
    }

    setDetalheLoading(true);
    setDetalhe(null);
    try {
      const data = await fetchGrupoEconomicoDetalhe(grupo.id, { somenteAtivos });
      detalheCacheRef.current.set(cacheKey, data);
      setDetalhe(data);
    } catch (e) {
      setDetalheErro(e instanceof Error ? e.message : 'Erro ao carregar membros.');
    } finally {
      setDetalheLoading(false);
    }
  };

  const fecharModal = () => {
    setModalAberto(false);
    setGrupoSelecionado(null);
    setDetalhe(null);
    setDetalheErro(null);
  };

  return (
    <div className="relative px-4 py-5 md:px-6">
      <CarregandoInformacoesOverlay show={loading} />
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <KpiPainelVoltarLink painelId="grupo-economico" />
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Grupo Econômico</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Grupos de pessoas do Nomus e seus membros ativos.
            </p>
          </div>
          <ComoLerBtn onClick={() => setAjudaAberta(true)} title="Como ler Grupo Econômico" />
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <article className="card-panel border-l-4 border-primary-600 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grupos</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {fmtNum(resumo.totalGrupos)}
                </p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600/10 text-primary-700 dark:text-primary-300">
                <Building2 className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </article>
          <article className="card-panel border-l-4 border-accent-500 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pessoas</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {fmtNum(resumo.totalPessoas)}
                </p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500/15 text-accent-600 dark:text-accent-300">
                <Users className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </article>
        </div>

        <section className="card-panel space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label className={labelClass} htmlFor="ge-busca">
                Buscar grupo ou pessoa (use % como curinga)
              </label>
              <input
                id="ge-busca"
                type="search"
                value={buscaDraft}
                onChange={(e) => setBuscaDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') filtrar();
                }}
                placeholder="Ex.: Claudino, Grupo%, %Magazine"
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={somenteAtivosDraft}
                onChange={(e) => setSomenteAtivosDraft(e.target.checked)}
                className="rounded border-slate-300"
              />
              Somente ativos
            </label>
            <button type="button" className={btnPrimary} onClick={filtrar} disabled={loading}>
              Filtrar
            </button>
          </div>
          {erro ? <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p> : null}
        </section>

        <section className="card-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Grupo</th>
                  <th className="px-3 py-2.5 font-semibold">Descrição</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Pessoas</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                {grupos.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      Nenhum grupo econômico encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  grupos.map((g) => (
                    <tr
                      key={g.id}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      onClick={() => void abrirDetalhe(g)}
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{g.grupo}</td>
                      <td className="max-w-[18rem] truncate px-3 py-2.5 text-slate-600 dark:text-slate-300" title={g.descricao}>
                        {g.descricao || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                        {fmtNum(g.qtdMembros)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            g.ativo
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {g.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={(e) => {
                            e.stopPropagation();
                            void abrirDetalhe(g);
                          }}
                        >
                          Ver pessoas
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalAberto ? (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-900/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ge-modal-titulo"
          onClick={fecharModal}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
              <div className="min-w-0">
                <h2 id="ge-modal-titulo" className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {detalhe?.grupo.grupo ?? grupoSelecionado?.grupo ?? 'Grupo econômico'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {(detalhe?.grupo.descricao || grupoSelecionado?.descricao || '').trim() || 'Sem descrição'}
                  {' · '}
                  {fmtNum(detalhe?.membros.length ?? grupoSelecionado?.qtdMembros ?? 0)} pessoa(s)
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={fecharModal}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {detalheLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Carregando pessoas…</p>
              ) : detalheErro ? (
                <p className="py-8 text-center text-sm text-rose-600">{detalheErro}</p>
              ) : !detalhe || detalhe.membros.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Nenhuma pessoa ativa neste grupo.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-2 py-2 font-semibold">Nome</th>
                      <th className="px-2 py-2 font-semibold">Razão social</th>
                      <th className="px-2 py-2 font-semibold">Documento</th>
                      <th className="px-2 py-2 font-semibold">Código</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                    {detalhe.membros.map((m) => (
                      <tr key={m.id}>
                        <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">{m.nome || '—'}</td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{m.razaoSocial || '—'}</td>
                        <td className="px-2 py-2 tabular-nums text-slate-700 dark:text-slate-200">{m.documento || '—'}</td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{m.codigo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <GrupoEconomicoAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
    </div>
  );
}
