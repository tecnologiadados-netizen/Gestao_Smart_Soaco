/**
 * Estrutura do menu de navegação.
 * Usado nas permissões de usuário e no menu lateral do Gestor.
 */
import {
  LayoutDashboard,
  Briefcase,
  Network,
  ClipboardList,
  FileSpreadsheet,
  Database,
  BarChart3,
  Settings,
} from "lucide-react";
import { rhPath } from "@rh/lib/rh-paths";

export interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

export interface NavCategory {
  label: string;
  icon: React.ElementType;
  variant: "operational" | "analytical";
  items: NavItem[];
}

export const navCategories: NavCategory[] = [
  {
    label: "OPERACIONAL",
    icon: Database,
    variant: "operational",
    items: [
      { title: "Orgânico", url: rhPath("/organico"), icon: ClipboardList },
      { title: "Faltas e Atestados", url: rhPath("/faltas-atestados"), icon: FileSpreadsheet },
    ],
  },
  {
    label: "ANALÍTICO",
    icon: BarChart3,
    variant: "analytical",
    items: [
      { title: "Dashboard", url: rhPath("/dashboard"), icon: LayoutDashboard },
      { title: "Cargos & Salários", url: rhPath("/cargos"), icon: Briefcase },
      { title: "Organograma", url: rhPath("/organograma"), icon: Network },
    ],
  },
];

export const CONFIGURACOES_NAV_ITEM: NavItem = {
  title: "Configurações",
  url: rhPath("/configuracoes"),
  icon: Settings,
};

/** Lista plana de todos os itens do menu (para permissões e menu recolhido). */
export const allNavItems: NavItem[] = navCategories.flatMap((c) => c.items);
