import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import {
  criarConversaAssistente,
  excluirConversaAssistente,
  listarConversasAssistente,
  listarFeedbacksConversa,
  listarMensagensAssistente,
  perguntarAssistente,
  registrarFeedbackAssistente,
  renomearConversaAssistente,
  type AssistenteConversa,
  type AssistenteMensagem,
  type TipoFeedbackAmigaco,
} from '../../api/assistente';

const STORAGE_KEY = 'amigaco:conversaAtivaId';

type Vista = 'chat' | 'historico';

function IconPencil() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4h8M4 20l8.5-2.5L20 10l-4.5-4.5L5.5 14.5 4 20z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H4v5M15 20h5v-5M15 4h5v5M9 20H4v-5" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function groupConversas(list: AssistenteConversa[]) {
  const agora = Date.now();
  const seteDias = 7 * 24 * 60 * 60 * 1000;
  const recentes: AssistenteConversa[] = [];
  const antigas: AssistenteConversa[] = [];
  for (const c of list) {
    const t = new Date(c.updatedAt).getTime();
    if (agora - t <= seteDias) recentes.push(c);
    else antigas.push(c);
  }
  return { recentes, antigas };
}

export default function AssistenteFlutuante() {
  const { hasPermission, nome, login } = useAuth();
  const location = useLocation();
  const podeUsar = hasPermission(PERMISSOES.ASSISTENTE_USAR);

  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [vista, setVista] = useState<Vista>('chat');
  const [conversas, setConversas] = useState<AssistenteConversa[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [mensagens, setMensagens] = useState<AssistenteMensagem[]>([]);
  const [titulo, setTitulo] = useState('Amigaço');
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [carregandoHist, setCarregandoHist] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, TipoFeedbackAmigaco>>({});
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const saudacao = useMemo(() => {
    const n = (nome || login || '').trim();
    return n ? `Olá ${n}, como posso te ajudar?` : 'Olá, como posso te ajudar?';
  }, [nome, login]);

  const persistConversaId = useCallback((id: string | null) => {
    setConversaId(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const carregarConversas = useCallback(async () => {
    setCarregandoHist(true);
    try {
      const list = await listarConversasAssistente();
      setConversas(list);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao listar conversas');
    } finally {
      setCarregandoHist(false);
    }
  }, []);

  const carregarMensagens = useCallback(
    async (id: string) => {
      try {
        const { conversa, data } = await listarMensagensAssistente(id);
        setMensagens(data);
        setTitulo(conversa.titulo);
        persistConversaId(conversa.id);
        try {
          const fb = await listarFeedbacksConversa(id);
          setFeedbacks(fb);
        } catch {
          setFeedbacks({});
        }
      } catch {
        persistConversaId(null);
        setMensagens([]);
        setFeedbacks({});
        setTitulo('Amigaço');
      }
    },
    [persistConversaId]
  );

  useEffect(() => {
    if (!podeUsar || !aberto) return;
    void carregarConversas();
  }, [podeUsar, aberto, carregarConversas]);

  useEffect(() => {
    if (!podeUsar || !aberto || !conversaId) return;
    void carregarMensagens(conversaId);
  }, [podeUsar, aberto, conversaId, carregarMensagens]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando, aberto]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 120);
    el.style.height = `${next}px`;
  }, [input]);

  const marcarFeedback = useCallback(
    async (mensagemId: string, tipo: TipoFeedbackAmigaco) => {
      if (feedbacks[mensagemId] === tipo) return;
      setFeedbackBusyId(mensagemId);
      setFeedbackMsg(null);
      try {
        const { mensagemFollowUp } = await registrarFeedbackAssistente({
          mensagemId,
          tipo,
          pathname: location.pathname,
        });
        setFeedbacks((prev) => ({ ...prev, [mensagemId]: tipo }));
        if (tipo === 'positivo') {
          setFeedbackMsg('Valeu! Seu 👍 ajuda a saber o que está funcionando.');
        } else {
          setFeedbackMsg(
            'Registrado — obrigado por ajudar na melhoria contínua do Amigaço.'
          );
          if (mensagemFollowUp) {
            setMensagens((prev) =>
              prev.some((m) => m.id === mensagemFollowUp.id)
                ? prev
                : [...prev, { ...mensagemFollowUp, meta: true }]
            );
          }
          setTimeout(() => inputRef.current?.focus(), 80);
        }
        window.setTimeout(() => setFeedbackMsg(null), 3200);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao enviar feedback');
      } finally {
        setFeedbackBusyId(null);
      }
    },
    [feedbacks, location.pathname]
  );

  if (!podeUsar) return null;

  const matchBusca = criarMatcherTextoLivre(busca);
  const filtradas = conversas.filter((c) => matchBusca(c.titulo));
  const { recentes, antigas } = groupConversas(filtradas);

  const novaConversa = async () => {
    setErro(null);
    try {
      const c = await criarConversaAssistente();
      setConversas((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
      persistConversaId(c.id);
      setMensagens([]);
      setFeedbacks({});
      setTitulo(c.titulo);
      setVista('chat');
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar conversa');
    }
  };

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    setErro(null);
    setInput('');
    const tempUser: AssistenteMensagem = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: texto,
      createdAt: new Date().toISOString(),
    };
    setMensagens((m) => [...m, tempUser]);
    try {
      const resp = await perguntarAssistente({
        conversaId,
        mensagem: texto,
        pathname: location.pathname,
      });
      persistConversaId(resp.conversaId);
      setTitulo(resp.titulo);
      const { data } = await listarMensagensAssistente(resp.conversaId);
      setMensagens(data);
      void carregarConversas();
    } catch (e) {
      setMensagens((m) => m.filter((x) => x.id !== tempUser.id));
      setInput(texto);
      setErro(e instanceof Error ? e.message : 'Erro ao perguntar');
    } finally {
      setEnviando(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const abrirConversa = (id: string) => {
    persistConversaId(id);
    setVista('chat');
    setMenuId(null);
  };

  const renomear = async (id: string) => {
    const atual = conversas.find((c) => c.id === id);
    const novo = window.prompt('Novo título', atual?.titulo ?? '');
    if (!novo?.trim()) return;
    try {
      const updated = await renomearConversaAssistente(id, novo.trim());
      setConversas((prev) => prev.map((c) => (c.id === id ? updated : c)));
      if (conversaId === id) setTitulo(updated.titulo);
      setMenuId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao renomear');
    }
  };

  const excluir = async (id: string) => {
    if (!window.confirm('Excluir esta conversa?')) return;
    try {
      await excluirConversaAssistente(id);
      setConversas((prev) => prev.filter((c) => c.id !== id));
      if (conversaId === id) {
        persistConversaId(null);
        setMensagens([]);
        setTitulo('Amigaço');
      }
      setMenuId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  };

  const painelClass = expandido
    ? 'fixed inset-4 z-[80] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(90vh,720px)] sm:w-[min(92vw,560px)]'
    : 'fixed bottom-24 right-4 z-[80] h-[min(70vh,560px)] w-[min(92vw,380px)] sm:right-6';

  return (
    <>
      {!aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="amigaco-fab group fixed bottom-5 right-4 z-[80] flex h-10 w-10 items-center overflow-hidden rounded-full bg-primary-600 p-1 text-white shadow-lg shadow-primary-900/30 ring-2 ring-soaco-gold/40 transition-all duration-200 hover:w-auto hover:gap-1.5 hover:bg-primary-700 hover:pr-3 sm:right-5"
          title="Amigaço — Assistente IA"
          aria-label="Abrir Amigaço"
        >
          <span className="amigaco-fab-img relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/20">
            <img
              src="/assistente-amigaco.png"
              alt=""
              className="h-8 w-8 object-cover transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
            />
          </span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-200 group-hover:max-w-24 group-hover:opacity-100">
            Amigaço
          </span>
        </button>
      )}

      {aberto && (
        <div
          className={`${painelClass} flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-soaco-graphite`}
          role="dialog"
          aria-label="Amigaço"
        >
          <header className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-2 py-2 dark:border-slate-700">
            {vista === 'historico' ? (
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => setVista('chat')}
                title="Voltar"
              >
                <IconBack />
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => void novaConversa()}
                title="Nova conversa"
              >
                <IconPencil />
              </button>
            )}
            {vista === 'chat' && (
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => {
                  setVista('historico');
                  void carregarConversas();
                }}
                title="Conversas"
              >
                <IconClock />
              </button>
            )}
            <h2 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-900 dark:text-slate-50">
              {vista === 'historico' ? 'Conversas' : titulo || 'Amigaço'}
            </h2>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setExpandido((v) => !v)}
              title={expandido ? 'Reduzir' : 'Expandir'}
            >
              {expandido ? <IconCollapse /> : <IconExpand />}
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setAberto(false)}
              title="Fechar"
              aria-label="Fechar"
            >
              ✕
            </button>
          </header>

          {erro && (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {erro}
            </div>
          )}

          {vista === 'historico' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 p-3">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar conversa"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {carregandoHist && (
                  <p className="px-2 text-xs text-slate-500">Carregando…</p>
                )}
                {!carregandoHist && filtradas.length === 0 && (
                  <p className="px-2 text-sm text-slate-500">Nenhuma conversa.</p>
                )}
                {recentes.length > 0 && (
                  <>
                    <p className="px-2 py-1 text-xs font-medium text-slate-400">Últimos 7 dias</p>
                    {recentes.map((c) => (
                      <HistoricoItem
                        key={c.id}
                        c={c}
                        menuId={menuId}
                        setMenuId={setMenuId}
                        onOpen={abrirConversa}
                        onRename={renomear}
                        onDelete={excluir}
                      />
                    ))}
                  </>
                )}
                {antigas.length > 0 && (
                  <>
                    <p className="px-2 py-1 text-xs font-medium text-slate-400">Mais antigos</p>
                    {antigas.map((c) => (
                      <HistoricoItem
                        key={c.id}
                        c={c}
                        menuId={menuId}
                        setMenuId={setMenuId}
                        onOpen={abrirConversa}
                        onRename={renomear}
                        onDelete={excluir}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                {mensagens.length === 0 && (
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {saudacao}
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Pergunte sobre regras e manuais do Gestão Smart (Consulta de Estoque,
                      Sequenciamento, etc.).
                    </p>
                    <p className="mt-2 rounded-lg border border-soaco-gold/40 bg-black/5 px-2.5 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      Use <span className="font-semibold">👍</span> quando a resposta ajudar e{' '}
                      <span className="font-semibold text-rose-600 dark:text-rose-400">Alucinou</span>{' '}
                      quando estiver errada — o feedback alimenta melhorias contínuas do Amigaço.
                    </p>
                  </div>
                )}
                {feedbackMsg && (
                  <p className="text-center text-[11px] text-emerald-600 dark:text-emerald-400">
                    {feedbackMsg}
                  </p>
                )}
                {mensagens.map((m) => {
                  const isAssistant = m.role === 'assistant';
                  const canFeedback = isAssistant && !m.id.startsWith('tmp-') && !m.meta;
                  const fb = feedbacks[m.id];
                  return (
                    <div
                      key={m.id}
                      className={`flex max-w-[92%] flex-col gap-1 ${
                        m.role === 'user' ? 'ml-auto items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                          m.role === 'user'
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {m.content}
                      </div>
                      {canFeedback && (
                        <div className="flex items-center gap-1 px-1">
                          <button
                            type="button"
                            disabled={feedbackBusyId === m.id}
                            title="Resposta útil"
                            onClick={() => void marcarFeedback(m.id, 'positivo')}
                            className={`rounded-md px-1.5 py-0.5 text-sm transition ${
                              fb === 'positivo'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            disabled={feedbackBusyId === m.id}
                            title="Marcar como alucinação"
                            onClick={() => void marcarFeedback(m.id, 'alucinou')}
                            className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium transition ${
                              fb === 'alucinou'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800 dark:hover:text-rose-300'
                            }`}
                          >
                            Alucinou
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {enviando && (
                  <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800">
                    Amigaço está pensando…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <form
                className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-700"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviar();
                }}
              >
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void enviar();
                      }
                    }}
                    placeholder="Pergunte algo"
                    className="max-h-[120px] min-h-[24px] flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-5 text-slate-800 outline-none dark:text-slate-100"
                    disabled={enviando}
                  />
                  <button
                    type="submit"
                    disabled={enviando || !input.trim()}
                    className="mb-0.5 shrink-0 rounded-full bg-primary-600 p-2 text-white hover:bg-primary-700 disabled:opacity-40"
                    title="Enviar"
                  >
                    <IconSend />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes amigaco-wiggle {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          25% { transform: rotate(-8deg) translateY(-2px); }
          75% { transform: rotate(8deg) translateY(-1px); }
        }
        .amigaco-fab:hover .amigaco-fab-img img {
          animation: amigaco-wiggle 0.45s ease-in-out;
        }
      `}</style>
    </>
  );
}

function HistoricoItem({
  c,
  menuId,
  setMenuId,
  onOpen,
  onRename,
  onDelete,
}: {
  c: AssistenteConversa;
  menuId: string | null;
  setMenuId: (id: string | null) => void;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="relative flex items-center gap-1 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/80">
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-sm text-slate-800 dark:text-slate-100"
        onClick={() => onOpen(c.id)}
      >
        {c.titulo}
      </button>
      <button
        type="button"
        className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
        onClick={() => setMenuId(menuId === c.id ? null : c.id)}
        aria-label="Opções"
      >
        ⋮
      </button>
      {menuId === c.id && (
        <div className="absolute right-2 top-9 z-10 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => onRename(c.id)}
          >
            Renomear
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => onDelete(c.id)}
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}
