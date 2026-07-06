import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

type ModalEntry = {
  id: string;
  onClose: () => void;
  /** Maior = mais à frente. */
  zIndex: number;
  /** Desempate para mesma camada. */
  order: number;
};

type ModalStackApi = {
  register: (entry: Omit<ModalEntry, 'order'>) => () => void;
};

const ModalStackContext = createContext<ModalStackApi | null>(null);

function getTop(entries: ModalEntry[]): ModalEntry | null {
  if (entries.length === 0) return null;
  return entries
    .slice()
    .sort((a, b) => b.zIndex - a.zIndex || b.order - a.order)[0]!;
}

export function ModalStackProvider({ children }: { children: React.ReactNode }) {
  const entriesRef = useRef<ModalEntry[]>([]);
  const orderRef = useRef(0);

  const register = useCallback((entry: Omit<ModalEntry, 'order'>) => {
    const order = (orderRef.current += 1);
    const full: ModalEntry = { ...entry, order };
    entriesRef.current = [...entriesRef.current, full];

    return () => {
      entriesRef.current = entriesRef.current.filter((e) => e.id !== entry.id);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;

      const top = getTop(entriesRef.current);
      if (!top) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      top.onClose();
    };

    // Capture: trata antes de outros listeners (ex.: popup Leaflet) e impede fechar tudo de uma vez.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const api = useMemo<ModalStackApi>(() => ({ register }), [register]);
  return <ModalStackContext.Provider value={api}>{children}</ModalStackContext.Provider>;
}

export function useRegisterModalEscape(opts: {
  id: string;
  onClose: () => void;
  zIndex: number;
  enabled?: boolean;
}) {
  const ctx = useContext(ModalStackContext);
  const enabled = opts.enabled ?? true;
  const onCloseRef = useRef(opts.onClose);
  onCloseRef.current = opts.onClose;

  useEffect(() => {
    if (!enabled) return;
    if (!ctx) return;
    return ctx.register({
      id: opts.id,
      onClose: () => onCloseRef.current(),
      zIndex: opts.zIndex,
    });
  }, [ctx, enabled, opts.id, opts.zIndex]);
}

/** z-index do popup de município no mapa (abaixo dos modais de detalhe). */
export const MODAL_Z_MAPA_POPUP = 12000;
