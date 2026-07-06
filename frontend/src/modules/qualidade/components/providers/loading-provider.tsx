import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { LoadingOverlay } from "@qualidade/components/ui/loading-overlay";

interface LoadingContextValue {
  isLoading: boolean;
  message: string;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  withLoading: <T>(fn: () => Promise<T> | T, message?: string) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

const MIN_LOADING_MS = 320;

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("Carregando...");

  const showLoading = useCallback((msg = "Carregando...") => {
    setMessage(msg);
    setIsLoading(true);
  }, []);

  const hideLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T> | T, msg = "Carregando...") => {
      const startedAt = Date.now();
      showLoading(msg);
      try {
        return await fn();
      } finally {
        const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }
        hideLoading();
      }
    },
    [hideLoading, showLoading]
  );

  const value = useMemo(
    () => ({ isLoading, message, showLoading, hideLoading, withLoading }),
    [hideLoading, isLoading, message, showLoading, withLoading]
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <LoadingOverlay open={isLoading} message={message} />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useLoading deve ser usado dentro de LoadingProvider");
  }
  return ctx;
}
