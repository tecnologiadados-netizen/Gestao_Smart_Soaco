import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export const SAVING_OVERLAY_DEFAULT_MESSAGE = "Salvando informações…";

type SavingOverlayContextValue = {
  isSaving: boolean;
  message: string;
  startSaving: (message?: string) => () => void;
  runWithSaving: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
};

const SavingOverlayContext = createContext<SavingOverlayContextValue | null>(null);

function SavingOverlayVisual({ visible, message }: { visible: boolean; message: string }) {
  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="rh-saving-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div className="rh-saving-overlay__backdrop" aria-hidden="true" />
      <div className="rh-saving-overlay__panel">
        <div className="rh-saving-loader" aria-hidden="true">
          <span className="rh-saving-loader__ring rh-saving-loader__ring--outer" />
          <span className="rh-saving-loader__ring" />
          <span className="rh-saving-loader__core" />
        </div>
        <p className="rh-saving-overlay__message">{message}</p>
      </div>
    </div>,
    document.body,
  );
}

export function SavingOverlayProvider({ children }: { children: ReactNode }) {
  const activeCountRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(SAVING_OVERLAY_DEFAULT_MESSAGE);

  const startSaving = useCallback((nextMessage?: string) => {
    activeCountRef.current += 1;
    if (nextMessage?.trim()) setMessage(nextMessage.trim());
    setVisible(true);

    return () => {
      activeCountRef.current = Math.max(0, activeCountRef.current - 1);
      if (activeCountRef.current === 0) {
        setVisible(false);
        setMessage(SAVING_OVERLAY_DEFAULT_MESSAGE);
      }
    };
  }, []);

  const runWithSaving = useCallback(
    async <T,>(fn: () => Promise<T>, nextMessage?: string): Promise<T> => {
      const stop = startSaving(nextMessage);
      try {
        return await fn();
      } finally {
        stop();
      }
    },
    [startSaving],
  );

  const value = useMemo<SavingOverlayContextValue>(
    () => ({
      isSaving: visible,
      message,
      startSaving,
      runWithSaving,
    }),
    [visible, message, startSaving, runWithSaving],
  );

  return (
    <SavingOverlayContext.Provider value={value}>
      {children}
      <SavingOverlayVisual visible={visible} message={message} />
    </SavingOverlayContext.Provider>
  );
}

export function useSavingOverlay(): SavingOverlayContextValue {
  const ctx = useContext(SavingOverlayContext);
  if (!ctx) {
    throw new Error("useSavingOverlay deve ser usado dentro de SavingOverlayProvider.");
  }
  return ctx;
}

/** Retorna no-op quando o provider não estiver montado (ex.: testes). */
export function useSavingOverlayOptional(): SavingOverlayContextValue | null {
  return useContext(SavingOverlayContext);
}
