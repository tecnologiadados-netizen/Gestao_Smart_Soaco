import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import KpiCard from '../../components/kpis/KpiCard';
import { getKpiPasta, listarPaineisDaPasta } from '../../config/kpisCatalog';
import { useKpisFavoritos } from '../../hooks/useKpisFavoritos';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import KpisAjudaModal from './KpisAjudaModal';

export default function KpisPastaPage() {
  const { pastaId = '' } = useParams<{ pastaId: string }>();
  const { login, hasPermission } = useAuth();
  const [busca, setBusca] = useState('');
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const { isFavorito, toggleFavorito } = useKpisFavoritos(login);

  const pasta = getKpiPasta(pastaId);
  const paineis = useMemo(
    () => (pasta ? listarPaineisDaPasta(pasta.id, hasPermission) : []),
    [pasta, hasPermission]
  );

  const match = useMemo(() => criarMatcherTextoLivre(busca), [busca]);
  const paineisFiltrados = useMemo(
    () => paineis.filter((p) => match(p.label) || match(p.capaTitulo)),
    [paineis, match]
  );

  if (!pasta) {
    return <Navigate to="/kpis" replace />;
  }

  if (paineis.length === 0) {
    return <Navigate to="/kpis" replace />;
  }

  return (
    <div className="px-4 py-5 md:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Link to="/kpis" className="hover:text-primary-600 dark:hover:text-primary-300">
            KPIs
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">{pasta.label}</span>
        </nav>

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{pasta.label}</h1>
            {pasta.descricao && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{pasta.descricao}</p>
            )}
          </div>
          <ComoLerBtn onClick={() => setAjudaAberta(true)} title="Como ler o hub KPIs" />
        </header>

        <div className="max-w-md">
          <label className="sr-only" htmlFor="kpis-pasta-busca">
            Buscar painéis
          </label>
          <input
            id="kpis-pasta-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar painel (use % como curinga)"
            className="input-app"
          />
        </div>

        {paineisFiltrados.length === 0 ? (
          <div className="card-panel border-dashed px-6 py-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum painel corresponde à busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {paineisFiltrados.map((painel) => (
              <KpiCard
                key={painel.id}
                to={painel.to}
                label={painel.label}
                variant="painel"
                favorito={isFavorito(painel.id)}
                onToggleFavorito={() => toggleFavorito(painel.id)}
                ctaLabel="Abrir"
              />
            ))}
          </div>
        )}

        <KpisAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
      </div>
    </div>
  );
}
