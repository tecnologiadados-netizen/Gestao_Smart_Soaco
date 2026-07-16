import { allNavItems, CONFIGURACOES_NAV_ITEM } from "@rh/lib/nav-items";

export type PermissionItem = {
  url: string;
  title: string;
  supportsEdit: boolean;
};

const baseNavPermissions: PermissionItem[] = allNavItems.map((item) => ({
  url: item.url,
  title: item.title,
  supportsEdit: item.url !== "/dashboard",
}));

export const dashboardGuidePermissions: PermissionItem[] = [
  { url: "/dashboard#executivo", title: "Dashboard Executivo", supportsEdit: false },
  { url: "/dashboard#absenteismo", title: "Absenteísmo (por faltas)", supportsEdit: false },
  { url: "/dashboard#absenteismo-horas", title: "Pontualidade", supportsEdit: true },
  {
    url: "/dashboard#diagnostico-ausencias-justificadas",
    title: "Diagnóstico Geral - Ausências justificadas",
    supportsEdit: false,
  },
];

export const DASHBOARD_EXECUTIVO_URL = "/dashboard#executivo";
export const DASHBOARD_ABSENTEISMO_URL = "/dashboard#absenteismo";
export const DASHBOARD_PONTUALIDADE_URL = "/dashboard#absenteismo-horas";
export const DASHBOARD_DIAGNOSTICO_AUSENCIAS_JUSTIFICADAS_URL = "/dashboard#diagnostico-ausencias-justificadas";

/** Catálogo exibido em Configurações. */
export const permissionItems: PermissionItem[] = [
  ...baseNavPermissions.filter((p) => p.url !== "/dashboard"),
  { url: CONFIGURACOES_NAV_ITEM.url, title: CONFIGURACOES_NAV_ITEM.title, supportsEdit: true },
  ...dashboardGuidePermissions,
];

