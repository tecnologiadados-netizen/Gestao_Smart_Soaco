import { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import KpiCard from '../../components/kpis/KpiCard';
import {
  getKpiPainel,
  listarPastasVisiveis,
  pastaHubPath,
  type KpiPainelDef,
} from '../../config/kpisCatalog';
import { useKpisFavoritos } from '../../hooks/useKpisFavoritos';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import KpisAjudaModal from './KpisAjudaModal';

function primeiroNome(nome: string | null): string {
  const t = (nome ?? '').trim();
  if (!t) return 'bem-vindo';
  return t.split(/\s+/)[0]!;
}

export default function KpisHubPage() {
  const { nome, login, hasPermission } = useAuth();
  const [busca, setBusca] = useState('');
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const { favoritos, isFavorito, toggleFavorito } = useKpisFavoritos(login);

  const pastas = useMemo(() => listarPastasVisiveis(hasPermission), [hasPermission]);

  const paineisFavoritos = useMemo(() => {
    const list: KpiPainelDef[] = [];
    for (const id of favoritos) {
      const painel = getKpiPainel(id);
      if (painel && painel.permissoes.some((p) => hasPermission(p))) list.push(painel);
    }
    return list;
  }, [favoritos, hasPermission]);

  const match = useMemo(() => criarMatcherTextoLivre(busca), [busca]);

  const pastasFiltradas = useMemo(
    () => pastas.filter((p) => match(p.label) || (p.descricao ? match(p.descricao) : false)),
    [pastas, match]
  );

  const favoritosFiltrados = useMemo(
    () => paineisFavoritos.filter((p) => match(p.label) || match(p.capaTitulo)),
    [paineisFavoritos, match]
  );

  return (
    <div className="px-4 py-5 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              Olá, {primeiroNome(nome)}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Muito bom te ver aqui!</p>
          </div>
          <ComoLerBtn onClick={() => setAjudaAberta(true)} title="Como ler o hub KPIs" />
        </header>

        <div className="max-w-md">
          <label className="sr-only" htmlFor="kpis-busca">
            Buscar pastas e painéis
          </label>
          <input
            id="kpis-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pasta ou painel (use % como curinga)"
            className="input-app"
          />
        </div>

        {favoritosFiltrados.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-soaco-gray">
              <svg className="h-3.5 w-3.5 text-accent-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Favoritos
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {favoritosFiltrados.map((painel) => (
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
          </section>
        )}

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-soaco-gray">Pastas</h2>
          {pastasFiltradas.length === 0 ? (
            <div className="card-panel border-dashed px-6 py-10 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {pastas.length === 0
                  ? 'Nenhum painel liberado para o seu grupo. Peça ao administrador a permissão KPIs correspondente.'
                  : 'Nenhuma pasta corresponde à busca.'}
              </p>
              {pastas.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Em Usuários → Grupos, marque <span className="font-medium">KPIs</span> e o painel desejado.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pastasFiltradas.map((pasta) => (
                <KpiCard
                  key={pasta.id}
                  to={pastaHubPath(pasta.id)}
                  label={pasta.label}
                  descricao={pasta.descricao}
                  variant="pasta"
                  ctaLabel="Abrir"
                />
              ))}
            </div>
          )}
        </section>

        <KpisAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
      </div>
    </div>
  );
}
