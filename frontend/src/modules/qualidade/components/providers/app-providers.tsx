import { LoadingProvider } from "@qualidade/components/providers/loading-provider";
import { ThemeProvider } from "@qualidade/components/providers/theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LoadingProvider>{children}</LoadingProvider>
    </ThemeProvider>
  );
}
