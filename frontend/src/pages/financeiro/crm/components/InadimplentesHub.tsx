import { useState } from 'react';
import ConfiguracoesInadimplentesPanel from './ConfiguracoesInadimplentesPanel';
import PainelInadimplenciaPanel from './PainelInadimplenciaPanel';
import RegistroInadimplentesPanel from './RegistroInadimplentesPanel';
import TarefasInadimplentesPanel from './TarefasInadimplentesPanel';

type Subguia = 'tarefas' | 'painel' | 'registros' | 'configuracoes';

const TABS: { id: Subguia; label: string }[] = [
  { id: 'painel', label: 'Painel de inadimplência' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'registros', label: 'Registros' },
  { id: 'configuracoes', label: 'Configurações' },
];

export default function InadimplentesHub({
  podeEditarResponsavel,
}: {
  podeEditarResponsavel: boolean;
}) {
  const [subguia, setSubguia] = useState<Subguia>('painel');

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/80">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubguia(tab.id)}
            className={`rounded-md px-3 py-1 text-sm font-semibold ${
              subguia === tab.id
                ? 'bg-blue-700 text-white shadow'
                : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {subguia === 'tarefas' ? <TarefasInadimplentesPanel /> : null}
      {subguia === 'painel' ? <PainelInadimplenciaPanel /> : null}
      {subguia === 'registros' ? <RegistroInadimplentesPanel /> : null}
      {subguia === 'configuracoes' ? (
        <ConfiguracoesInadimplentesPanel podeEditarResponsavel={podeEditarResponsavel} />
      ) : null}
    </div>
  );
}
