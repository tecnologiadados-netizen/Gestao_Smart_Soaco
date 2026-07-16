import { useState } from 'react';
import { createPortal } from 'react-dom';
import { buildFavoritoUrl } from '../../config/telasFavoritaveis';
import { useFavoritos } from '../../contexts/FavoritosContext';
import type { TelaFavorita } from '../../api/favoritos';

type SalvarFavoritoModalProps = {
  open: boolean;
  onClose: () => void;
  rota: string;
  filtros: Record<string, string>;
  resumoFiltros?: string;
};

export default function SalvarFavoritoModal({
  open,
  onClose,
  rota,
  filtros,
  resumoFiltros,
}: SalvarFavoritoModalProps) {
  const { salvarFavorito } = useFavoritos();
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<TelaFavorita | null>(null);

  if (!open) return null;

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const fav = await salvarFavorito({ nome: nome.trim(), rota, filtros });
      setCriado(fav);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar favorito.');
    } finally {
      setSalvando(false);
    }
  }

  function fechar() {
    setNome('');
    setErro(null);
    setCriado(null);
    onClose();
  }

  function copiarLink() {
    if (!criado) return;
    const url = `${window.location.origin}${buildFavoritoUrl(criado.rota, criado.id)}`;
    void navigator.clipboard.writeText(url);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[17000] flex items-center justify-center overflow-y-auto bg-black/55 p-4 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="salvar-favorito-titulo"
        className="my-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        {criado ? (
          <>
            <h2 id="salvar-favorito-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Favorito salvo
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Use o link abaixo como página inicial da TV ou favorito do navegador:
            </p>
            <code className="mt-3 block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {window.location.origin}
              {buildFavoritoUrl(criado.rota, criado.id)}
            </code>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={copiarLink}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Copiar link
              </button>
              <button
                type="button"
                onClick={fechar}
                className="rounded-lg bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-500"
              >
                Fechar
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSalvar}>
            <h2 id="salvar-favorito-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Salvar nos favoritos
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Salva a tela atual com os filtros aplicados.
            </p>
            {resumoFiltros && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{resumoFiltros}</p>
            )}
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Nome do favorito
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: TV Bebedouros"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                autoFocus
                maxLength={120}
              />
            </label>
            {erro && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{erro}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={fechar}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando || !nome.trim()}
                className="rounded-lg bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
