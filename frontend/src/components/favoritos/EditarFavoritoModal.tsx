import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFavoritos } from '../../contexts/FavoritosContext';

type EditarFavoritoModalProps = {
  open: boolean;
  onClose: () => void;
  favoritoId: number;
  nomeAtual: string;
  resumoFiltros?: string;
};

export default function EditarFavoritoModal({
  open,
  onClose,
  favoritoId,
  nomeAtual,
  resumoFiltros,
}: EditarFavoritoModalProps) {
  const { atualizarFavoritoNome } = useFavoritos();
  const [nome, setNome] = useState(nomeAtual);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNome(nomeAtual);
      setErro(null);
      setSalvando(false);
    }
  }, [open, nomeAtual]);

  if (!open) return null;

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await atualizarFavoritoNome(favoritoId, nome.trim());
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao renomear favorito.');
    } finally {
      setSalvando(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[17000] flex items-center justify-center overflow-y-auto bg-black/55 p-4 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-favorito-titulo"
        className="my-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <form onSubmit={handleSalvar}>
          <h2 id="editar-favorito-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Renomear favorito
          </h2>
          {resumoFiltros && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{resumoFiltros}</p>
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
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !nome.trim() || nome.trim() === nomeAtual.trim()}
              className="rounded-lg bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
