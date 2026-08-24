import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  podeAcessarDigitacaoConferencia,
  podeAcessarGestaoMesa,
} from '../../utils/recebimentoPermissoes';

type Variante = 'mesa' | 'digitacao';

const COPY: Record<
  Variante,
  { titulo: string; papel: string; descricao: string }
> = {
  mesa: {
    titulo: 'Gestão Mesa',
    papel: 'Perfil Mesa',
    descricao:
      'Aqui a Mesa vai importar documentos de pré-entrada, atribuir conferentes, comparar quantidade conferida com a NF, reenviar recontagem e finalizar a conferência.',
  },
  digitacao: {
    titulo: 'Digitação conferência',
    papel: 'Perfil Conferente',
    descricao:
      'Aqui o conferente vai ver só as conferências atribuídas a ele, informar código do produto e quantidade física (às cegas) e devolver o documento para a Mesa validar.',
  },
};

export default function RecebimentoPlaceholderPage({ variante }: { variante: Variante }) {
  const { hasPermission } = useAuth();
  const permitido =
    variante === 'mesa' ? podeAcessarGestaoMesa(hasPermission) : podeAcessarDigitacaoConferencia(hasPermission);

  if (!permitido) return <Navigate to="/sem-acesso" replace />;

  const copy = COPY[variante];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Recebimento · {copy.papel}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">{copy.titulo}</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{copy.descricao}</p>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
          Tela em construção. O menu e as permissões já estão ativos; o fluxo operacional entra na próxima entrega.
        </p>
      </div>
    </div>
  );
}
