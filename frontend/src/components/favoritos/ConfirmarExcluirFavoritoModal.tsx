import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useFavoritos } from '../../contexts/FavoritosContext';

type ConfirmarExcluirFavoritoModalProps = {
  open: boolean;
  onClose: () => void;
  favoritoId: number;
  nome: string;
};

export default function ConfirmarExcluirFavoritoModal({
  open,
  onClose,
  favoritoId,
  nome,
}: ConfirmarExcluirFavoritoModalProps) {
  const { removerFavorito } = useFavoritos();
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!open) return null;

  async function handleExcluir() {
    setExcluindo(true);
    setErro(null);
    try {
      await removerFavorito(favoritoId);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao excluir favorito.');
    } finally {
      setExcluindo(false);
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
        aria-labelledby="excluir-favorito-titulo"
        className="my-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 id="excluir-favorito-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
          Excluir favorito
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Remover <span className="font-medium text-slate-800 dark:text-slate-200">{nome}</span> dos favoritos?
          Esta ação não pode ser desfeita.
        </p>
        {erro && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{erro}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={excluindo}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleExcluir()}
            disabled={excluindo}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
