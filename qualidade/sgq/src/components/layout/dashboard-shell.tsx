"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { StoreHydration } from "@/components/providers/store-hydration";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed") === "1";

  if (embed) {
    return (
      <StoreHydration>
        <div className="flex min-h-0 flex-col bg-background">
          <main className="w-full flex-1 px-3 py-2 sm:px-4 sm:py-3">{children}</main>
        </div>
      </StoreHydration>
    );
  }

  return (
    <StoreHydration>
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="w-full flex-1 px-6 py-5 lg:px-8">{children}</main>
      </div>
    </StoreHydration>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[12rem] items-center justify-center p-4 text-sm text-muted-foreground">
          Carregando…
        </div>
      }
    >
      <DashboardShellInner>{children}</DashboardShellInner>
    </Suspense>
  );
}
