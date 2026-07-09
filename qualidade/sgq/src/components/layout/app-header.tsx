"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronDown,
  FileText,
  Gauge,
  Home,
  LogOut,
  Search,
  Settings,
  User,
  Wrench,
  BarChart3,
  ClipboardList,
  NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useConfigStore } from "@/lib/store/config-store";
import { useDocumentsStore } from "@/lib/store/documents-store";
import { useCalibrationsStore } from "@/lib/store/calibrations-store";
import { NovoDocumentoNav } from "@/components/documentos/novo-documento-nav";
import { ValidadeNotificacoesBell } from "@/components/documentos/validade-notificacoes-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const headerBtnClass =
  "app-header-btn border-white/30 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 hover:text-white aria-expanded:border-white/40 aria-expanded:bg-white/15 aria-expanded:text-white focus-visible:text-white";

type Module =
  | "documentos"
  | "calibracoes"
  | "registros"
  | "configuracoes";

const modules: { id: Module; label: string; href: string; icon: typeof FileText }[] = [
  { id: "documentos", label: "Documentos", href: "/documentos", icon: FileText },
  { id: "calibracoes", label: "Calibrações", href: "/calibracoes", icon: Gauge },
  {
    id: "registros",
    label: "Registros",
    href: "/registros",
    icon: NotebookPen,
  },
  { id: "configuracoes", label: "Configurações", href: "/configuracoes", icon: Settings },
];

function getActiveModule(pathname: string): Module {
  if (pathname.startsWith("/registros") || pathname.startsWith("/avaliacao-fornecedor")) {
    return "registros";
  }
  if (pathname.startsWith("/calibracoes")) return "calibracoes";
  if (pathname.startsWith("/configuracoes")) return "configuracoes";
  return "documentos";
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
}

function getNavItems(module: Module): NavItem[] {
  switch (module) {
    case "documentos":
      return [
        { label: "Início", href: "/documentos", icon: Home },
        { label: "Consulta", href: "/documentos/consulta", icon: Search },
      ];
    case "calibracoes":
      return [
        { label: "Início", href: "/calibracoes", icon: Home },
        { label: "Cadastros", href: "/calibracoes/cadastros/equipamentos", icon: ClipboardList },
        { label: "Consulta", href: "/calibracoes/consulta", icon: Search },
        { label: "Visão geral", href: "/calibracoes/visao-geral", icon: BarChart3 },
      ];
    case "registros":
      return [
        { label: "Início", href: "/registros", icon: Home },
        { label: "Consulta", href: "/registros/consulta", icon: Search },
      ];
    case "configuracoes":
      return [
        { label: "Início", href: "/configuracoes", icon: Home },
        { label: "Usuários", href: "/configuracoes/usuarios", icon: User },
        { label: "Setores", href: "/configuracoes/setores", icon: Wrench },
        { label: "Categorias", href: "/configuracoes/tipos-documento", icon: FileText },
      ];
  }
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const activeModule = getActiveModule(pathname);
  const currentModule = modules.find((m) => m.id === activeModule)!;
  const navItems = getNavItems(activeModule);

  const currentUserId = useConfigStore((s) => s.currentUserId);
  const getCurrentUser = useConfigStore((s) => s.getCurrentUser);
  const users = useConfigStore((s) => s.users);
  const setCurrentUserId = useConfigStore((s) => s.setCurrentUserId);

  const docPending = useDocumentsStore((s) =>
    s.getPendingTasks(currentUserId).length
  );
  const calibrationEquipment = useCalibrationsStore((s) => s.equipment);
  const getPendingCalibrations = useCalibrationsStore(
    (s) => s.getPendingCalibrations
  );
  const calPending = useMemo(
    () =>
      getPendingCalibrations("interna").length +
      getPendingCalibrations("externa").length,
    [calibrationEquipment, getPendingCalibrations]
  );

  const pendingCount =
    activeModule === "documentos"
      ? docPending
      : activeModule === "calibracoes"
        ? calPending
        : 0;

  const currentUser = getCurrentUser();

  return (
    <header className="app-header-bar sticky top-0 z-50 text-header-foreground shadow-md">
      <div className="flex h-14 w-full items-center gap-4 px-6 lg:px-8">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className={cn(headerBtnClass, "gap-2 font-medium")}
              />
            }
          >
            <currentModule.icon className="size-4" />
            {currentModule.label}
            <ChevronDown className="size-4 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {modules.map((mod) => (
              <DropdownMenuItem
                key={mod.id}
                onClick={() => {
                  window.location.href = mod.href;
                }}
              >
                <mod.icon className="size-4" />
                {mod.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${activeModule}` &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "app-header-nav-active"
                    : undefined
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {item.label === "Início" && pendingCount > 0 && (
                  <span className="ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-warning text-[11px] font-bold leading-none text-warning-foreground">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
          {activeModule === "documentos" && <NovoDocumentoNav />}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {activeModule === "documentos" ? (
            <ValidadeNotificacoesBell
              variant="header"
              onVerDocumento={(id) => router.push(`/documentos/${id}`)}
            />
          ) : null}
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className={cn(headerBtnClass, "gap-2")}
                />
              }
            >
              <User className="size-4" />
              <span className="hidden sm:inline">{currentUser?.nome ?? "Usuário"}</span>
              <ChevronDown className="size-4 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Simular usuário (dev)
              </div>
              {users
                .filter((u) => u.ativo)
                .map((u) => (
                  <DropdownMenuItem
                    key={u.id}
                    onClick={() => setCurrentUserId(u.id)}
                    className={cn(u.id === currentUserId && "bg-muted")}
                  >
                    {u.nome}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <LogOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
