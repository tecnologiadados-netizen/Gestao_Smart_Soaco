import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import ModalAbaBackdrop from '../ModalAbaBackdrop';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';

function fmtQtde(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Converte ISO (yyyy-mm-dd) ou similar para dd/mm/yyyy. */
function fmtDataBr(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const t = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return t;
}

export type EmpenhoLinhaSaldoProjetado = {
  pedido: string;
  qtde: number;
  dataEntrega: string | null;
  rota: string;
  saldoProjetado: number;
  ruptura: boolean;
};

/** Calcula saldo projetado linha a linha (ordem top-down) e marca a primeira ruptura. */
export function calcularEmpenhoSaldoProjetado(
  linhas: { pedido: string; qtde: number; dataEntrega: string | null; rota: string }[],
  saldoAtual: number
): EmpenhoLinhaSaldoProjetado[] {
  let running = saldoAtual;
  let rupturaMarcada = false;
  return linhas.map((e) => {
    running = Math.round((running - e.qtde) * 100) / 100;
    const ruptura = !rupturaMarcada && running <= 0 && e.qtde > 0;
    if (ruptura) rupturaMarcada = true;
    return { ...e, saldoProjetado: running, ruptura };
  });
}

type Props = {
  open: boolean;
  /** Chave estável para recarregar (ex.: `saldo-123`). Evita loop por função `load` instável. */
  detailKey: string | null;
  titulo: string;
  subtitulo: string;
  onClose: () => void;
  onLoad: () => Promise<{ error?: string }>;
  children: (ctx: { carregando: boolean; erro: string | null }) => ReactNode;
  /** Modal mais largo/alto (ex.: empenho com 2 cenários). */
  largo?: boolean;
  /** `aba` = overlay na aba; `fixed` = portal em tela cheia (modais empilhados). */
  backdropMode?: 'aba' | 'fixed';
  zIndex?: number;
  rotuloFechar?: string;
};

export default function ModalConsultaEstoqueDetalhe({
  open,
  detailKey,
  titulo,
  subtitulo,
  onClose,
  onLoad,
  children,
  largo = false,
  backdropMode = 'aba',
  zIndex = 14001,
  rotuloFechar = 'Fechar',
}: Props) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open || !detailKey) {
      setErro(null);
      setCarregando(false);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    setErro(null);
    void onLoad().then((r) => {
      if (cancelled) return;
      setCarregando(false);
      if (r.error) setErro(r.error);
      setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [open, detailKey, onLoad]);

  const dialog = (
    <div
      className={`flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800 ${
        largo
          ? 'my-auto max-h-[min(90vh,720px)] max-w-6xl'
          : 'max-h-[min(85vh,560px)] max-w-4xl'
      }`}
      role="dialog"
      aria-modal
      onClick={(e) => e.stopPropagation()}
    >
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{subtitulo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label={rotuloFechar}
          >
            ×
          </button>
        </div>
      </div>
      <div
        className={`min-h-0 flex-1 px-4 py-3 ${
          largo ? 'flex flex-col overflow-hidden' : 'overflow-auto'
        }`}
        key={tick}
      >
        {children({ carregando, erro })}
      </div>
      <div className="flex shrink-0 justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-600">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-500 dark:text-slate-200"
        >
          {rotuloFechar}
        </button>
      </div>
    </div>
  );

  useRegisterModalEscape({
    id: `consulta-estoque-detalhe:${detailKey ?? 'idle'}`,
    onClose,
    zIndex,
    enabled: open && backdropMode === 'fixed',
  });

  if (!open) return null;

  if (backdropMode === 'fixed') {
    return createPortal(
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/70 p-4"
        style={{ zIndex }}
        role="presentation"
        onClick={onClose}
      >
        {dialog}
      </div>,
      document.body
    );
  }

  return (
    <ModalAbaBackdrop
      onClose={onClose}
      className={largo ? 'items-start overflow-y-auto py-4' : undefined}
    >
      {dialog}
    </ModalAbaBackdrop>
  );
}

export { fmtQtde, fmtDataBr };
