import { Link } from 'react-router-dom';
import { getKpiPainel, pastaHubPath } from '../../config/kpisCatalog';

type Props = {
  /** Id do painel em `KPI_PAINEIS` (ex.: `cobertura-estoque`). */
  painelId: string;
  className?: string;
};

/** Link “Voltar” para a pasta do hub KPIs de onde o painel foi aberto. */
export default function KpiPainelVoltarLink({ painelId, className = '' }: Props) {
  const painel = getKpiPainel(painelId);
  if (!painel) return null;
  return (
    <Link
      to={pastaHubPath(painel.pastaId)}
      className={`inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-300 ${className}`}
      title="Voltar à pasta de KPIs"
    >
      ← Voltar
    </Link>
  );
}
