import { useEffect, useState } from 'react';
import {
  fetchCrmInadimplenteTarefaConfig,
  salvarCrmInadimplenteTarefaConfig,
  type UsuarioDestinatarioPendencia,
} from '../../../../api/crmFinanceiro';

export default function ConfiguracoesInadimplentesPanel({
  podeEditarResponsavel,
}: {
  podeEditarResponsavel: boolean;
}) {
  const [usuarios, setUsuarios] = useState<UsuarioDestinatarioPendencia[]>([]);
  const [responsavelId, setResponsavelId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    setCarregando(true);
    setErro('');
    void fetchCrmInadimplenteTarefaConfig()
      .then((cfg) => {
        setUsuarios(cfg.usuarios);
        setResponsavelId(cfg.responsavelUsuarioId);
      })
      .catch((e) => {
        setErro(e instanceof Error ? e.message : 'Falha ao carregar configurações.');
      })
      .finally(() => setCarregando(false));
  }, []);

  async function handleSalvar() {
    setSalvando(true);
    setErro('');
    setInfo('');
    try {
      const saved = await salvarCrmInadimplenteTarefaConfig(responsavelId);
      setResponsavelId(saved.responsavelUsuarioId);
      setInfo('Responsável padrão salvo. Novas tarefas serão atribuídas a este usuário.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar responsável.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configurações</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Defina quem recebe as tarefas novas sincronizadas do Nomus e do Shop9. Isso não altera o
          responsável das tarefas já existentes.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Responsável pelas novas tarefas
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            disabled={!podeEditarResponsavel || carregando}
            value={responsavelId ?? ''}
            onChange={(e) => setResponsavelId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 min-w-[220px] rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          >
            <option value="">Nenhum (tarefa sem dono)</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome?.trim() || u.login}
              </option>
            ))}
          </select>
          {podeEditarResponsavel ? (
            <button
              type="button"
              disabled={salvando || carregando}
              onClick={() => void handleSalvar()}
              className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold dark:border-slate-600"
            >
              {salvando ? 'Salvando…' : 'Salvar responsável'}
            </button>
          ) : (
            <span className="text-xs text-slate-500">Sem permissão para alterar o responsável.</span>
          )}
        </div>
      </div>

      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{erro}</p>
      ) : null}
      {info ? <p className="text-xs text-slate-500">{info}</p> : null}
    </section>
  );
}
