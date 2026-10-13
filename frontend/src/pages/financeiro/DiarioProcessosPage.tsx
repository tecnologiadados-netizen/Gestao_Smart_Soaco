import { useCallback, useEffect, useState } from 'react';
import { PERMISSOES } from '../../config/permissoes';
import { useAuth } from '../../contexts/AuthContext';
import {
  aprovarProcessoDiario,
  atualizarDescricaoProcessoDiario,
  devolverProcessoDiario,
  enviarProcessoDiario,
  iniciarProcessoDiario,
  listarProcessosDiario,
  type DiarioProcesso,
  type StatusProcessoDiario,
} from '../../api/diarioFinanceiro';
import DiarioFinanceiroPage from './DiarioFinanceiroPage';

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

function formatarData(ymd: string): string {
  const [ano, mes, dia] = ymd.split('-');
  if (!ano || !mes || !dia) return ymd;
  return `${dia}/${mes}/${ano}`;
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
  const [descricao, setDescricao] = useState('');
  const [fluxo, setFluxo] = useState(false);

  const [iniciarAberto, setIniciarAberto] = useState(false);
  const [novaData, setNovaData] = useState(hojeYmd);
  const [novaDescricao, setNovaDescricao] = useState('');

  const [senhaAberta, setSenhaAberta] = useState(false);
  const [senha, setSenha] = useState('');
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

  const abrir = (processo: DiarioProcesso) => {
    setAberto(processo);
    setDescricao(processo.descricao);
  };

  const substituir = (processo: DiarioProcesso) => {
    setAberto(processo);
    setDescricao(processo.descricao);
    setProcessos((prev) => prev.map((p) => (p.id === processo.id ? processo : p)));
  };

  const iniciar = async () => {
    if (fluxo) return;
    setFluxo(true);
    setErro(null);
    try {
      const res = await iniciarProcessoDiario({ dataVencimento: novaData, descricao: novaDescricao });
      setIniciarAberto(false);
      setNovaDescricao('');
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

  const gravarDescricao = async () => {
    if (!aberto || !aberto.editavel || fluxo) return;
    const texto = descricao.trim();
    if (!texto) {
      setDescricao(aberto.descricao);
      return;
    }
    if (texto === aberto.descricao) return;
    setFluxo(true);
    setErro(null);
    try {
      substituir(await atualizarDescricaoProcessoDiario(aberto.id, texto));
    } catch (e) {
      setDescricao(aberto.descricao);
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
      substituir(await aprovarProcessoDiario(aberto.id, senha));
      setSenha('');
      setSenhaAberta(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setFluxo(false);
    }
  };

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
              setNovaDescricao('');
              setErro(null);
              setIniciarAberto(true);
            }}
            className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700"
          >
            Iniciar contas a pagar
          </button>
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
        <table className="min-w-[720px] w-full text-sm">
          <thead className="sticky top-0 z-10 bg-primary-600 text-white">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Código</th>
              <th className="px-3 py-2 text-left font-semibold">Data</th>
              <th className="px-3 py-2 text-left font-semibold">Descrição</th>
              <th className="px-3 py-2 text-left font-semibold">Usuário</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {processos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                  {loading ? 'Carregando…' : 'Nenhum contas a pagar iniciado.'}
                </td>
              </tr>
            ) : (
              processos.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 whitespace-nowrap">{p.codigo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatarData(p.dataVencimento)}</td>
                  <td className="px-3 py-2 max-w-[24rem] truncate" title={p.descricao}>
                    {p.descricao}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.usuario}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
            <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Descrição
              <input
                required
                maxLength={200}
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="flex h-[92vh] w-full max-w-[96rem] flex-col overflow-hidden rounded-xl bg-slate-100 shadow-xl dark:bg-slate-900">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Contas a pagar {aberto.codigo}
                  </h2>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSE[aberto.status]}`}>
                    {STATUS_LABEL[aberto.status]}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{formatarData(aberto.dataVencimento)}</span>
                </div>
                <label className="mt-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Descrição
                  <input
                    value={descricao}
                    maxLength={200}
                    disabled={!aberto.editavel || fluxo}
                    onChange={(e) => setDescricao(e.target.value)}
                    onBlur={() => void gravarDescricao()}
                    className="mt-1 h-8 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-2 text-sm disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900"
                  />
                </label>
                {aberto.motivoDevolucao ? (
                  <p className="mt-2 text-xs text-orange-700 dark:text-orange-300">Devolução: {aberto.motivoDevolucao}</p>
                ) : null}
                {aviso ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{aviso}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAberto(null);
                  setErro(null);
                }}
                className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Fechar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <DiarioFinanceiroPage
                key={aberto.id}
                modo={{ dataFixa: aberto.dataVencimento, editavel: aberto.editavel }}
              />
            </div>
            {erro ? (
              <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {erro}
              </div>
            ) : null}
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
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
                    setSenha('');
                    setErro(null);
                    setSenhaAberta(true);
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
        </div>
      ) : null}

      {senhaAberta ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800"
            onSubmit={(e) => {
              e.preventDefault();
              void aprovar();
            }}
          >
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Aprovar contas a pagar</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Informe a senha de quem está logado.</p>
            <input
              type="password"
              autoFocus
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-4 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
            {erro ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{erro}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSenhaAberta(false);
                  setSenha('');
                  setErro(null);
                }}
                className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={fluxo || !senha.trim()}
                className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {fluxo ? 'Aprovando…' : 'Confirmar'}
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
