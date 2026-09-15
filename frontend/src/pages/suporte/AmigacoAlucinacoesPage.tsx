import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  atualizarAlucinacaoAmigaco,
  listarAlucinacoesAmigaco,
  type AmigacoAlucinacao,
} from '../../api/assistente';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';

type FiltroResolvido = 'pendentes' | 'resolvidos' | 'todos';

function fmtData(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR');
}

function trecho(s: string | null | undefined, n = 120): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

export default function AmigacoAlucinacoesPage() {
  const [itens, setItens] = useState<AmigacoAlucinacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroResolvido>('pendentes');
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<AmigacoAlucinacao | null>(null);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await listarAlucinacoesAmigaco({ resolvido: filtro });
      setItens(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (selecionado) setNota(selecionado.notaInterna ?? '');
  }, [selecionado]);

  const match = useMemo(() => criarMatcherTextoLivre(busca), [busca]);
  const filtrados = useMemo(
    () =>
      itens.filter(
        (r) =>
          match(r.perguntaUsuario ?? '') ||
          match(r.respostaAssistente) ||
          match(r.usuarioLogin) ||
          match(r.usuarioNome ?? '') ||
          match(r.pathname ?? '') ||
          match(r.tituloConversa)
      ),
    [itens, match]
  );

  const marcar = async (resolvido: boolean) => {
    if (!selecionado) return;
    setSalvando(true);
    setErro(null);
    try {
      const updated = await atualizarAlucinacaoAmigaco(selecionado.id, {
        resolvido,
        notaInterna: nota,
      });
      setSelecionado(updated);
      setItens((prev) => {
        const next = prev.map((x) => (x.id === updated.id ? updated : x));
        if (filtro === 'pendentes' && updated.resolvido) {
          return next.filter((x) => x.id !== updated.id);
        }
        if (filtro === 'resolvidos' && !updated.resolvido) {
          return next.filter((x) => x.id !== updated.id);
        }
        return next;
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Suporte
        </p>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Alucinações Amigaço
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Feedbacks negativos dos usuários. Use como fonte para ajustar o glossário e os manuais do
          FAQ.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['pendentes', 'resolvidos', 'todos'] as FiltroResolvido[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              filtro === f
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar (pergunta, resposta, usuário…)"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={() => void carregar()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-200"
        >
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_minmax(280px,380px)]">
        <div className="scrollbar-app min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40">
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Carregando…</p>
          ) : filtrados.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhum registro neste filtro.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-primary-600 text-white">
                <tr>
                  <th className="px-3 py-2 font-semibold">Data</th>
                  <th className="px-3 py-2 font-semibold">Usuário</th>
                  <th className="px-3 py-2 font-semibold">Tela</th>
                  <th className="px-3 py-2 font-semibold">Pergunta</th>
                  <th className="px-3 py-2 font-semibold">Resposta</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelecionado(r)}
                    className={`cursor-pointer border-b border-slate-100 dark:border-slate-700 ${
                      selecionado?.id === r.id
                        ? 'bg-primary-50 dark:bg-primary-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                      {fmtData(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                      {r.usuarioNome || r.usuarioLogin}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2 font-mono text-slate-500">
                      {r.pathname || '—'}
                    </td>
                    <td className="max-w-[200px] px-3 py-2 text-slate-700 dark:text-slate-200">
                      {trecho(r.perguntaUsuario, 80)}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-slate-600 dark:text-slate-300">
                      {trecho(r.respostaAssistente, 80)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          r.resolvido
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                        }`}
                      >
                        {r.resolvido ? 'Resolvido' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
          {!selecionado ? (
            <p className="text-sm text-slate-500">Selecione um registro para ver o contexto completo.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Conversa</p>
                <p className="text-slate-800 dark:text-slate-100">{selecionado.tituloConversa}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Usuário</p>
                <p className="text-slate-800 dark:text-slate-100">
                  {selecionado.usuarioNome || selecionado.usuarioLogin} ({selecionado.usuarioLogin})
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Tela</p>
                <p className="font-mono text-xs text-slate-600 dark:text-slate-300">
                  {selecionado.pathname || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Pergunta</p>
                <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-100">
                  {selecionado.perguntaUsuario || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Resposta do Amigaço</p>
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                  {selecionado.respostaAssistente}
                </p>
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-400">Nota interna</span>
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="O que foi corrigido no glossário / FAQ…"
                />
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {!selecionado.resolvido ? (
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void marcar(true)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Marcar resolvido
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void marcar(false)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-200 disabled:opacity-50"
                  >
                    Reabrir
                  </button>
                )}
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void marcar(selecionado.resolvido)}
                  className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Salvar nota
                </button>
              </div>
              {selecionado.resolvidoEm && (
                <p className="text-xs text-slate-500">
                  Resolvido em {fmtData(selecionado.resolvidoEm)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
