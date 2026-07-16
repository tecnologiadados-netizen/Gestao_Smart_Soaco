import {
  buildRhCommentTagAccess,
  buildRhCommentVisibilityAccess,
  normalizeRhCommentTagId,
  type RhOrganicoCommentVisibilityId,
} from './rh-organico-comment-tags.js';

export type LegacyRoutePermission = {
  url: string;
  title?: string;
  canView?: boolean;
  canEdit?: boolean;
};

export type PermissionAccess = {
  view: boolean;
  edit: boolean;
};

export type PermissionCrud = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

export type OrganicoCommentPermissions = PermissionAccess & {
  tags: Record<string, boolean>;
  visibilities: Record<RhOrganicoCommentVisibilityId, boolean>;
};

export type OrganicoDocumentPermissions = PermissionCrud & {
  download: boolean;
  audit: boolean;
  deleteGlobalForOne: boolean;
  deleteGlobalForAll: boolean;
  categories: Record<string, boolean>;
  classifications: Record<string, boolean>;
};

export type RhGroupPermissions = {
  version: 2;
  routes: Array<{
    url: string;
    title: string;
    canView: boolean;
    canEdit: boolean;
  }>;
  organico: {
    allowedSectors: string[];
    colaboradores: PermissionAccess;
    formTabs: Record<string, PermissionAccess>;
    comentarios: OrganicoCommentPermissions;
    fotos: PermissionAccess;
    documentos: OrganicoDocumentPermissions;
    justificarAlteracoesSecullum: boolean;
    notificarCadastroComplementarSecullum: boolean;
  };
  faltas: {
    route: PermissionAccess;
    ausencias: PermissionCrud;
    sancoes: PermissionCrud;
    cadastros: PermissionAccess;
    tiposRegras: PermissionAccess;
    regrasAlertas: PermissionAccess;
  };
  dashboard: {
    route: PermissionAccess;
    modulos: Record<string, PermissionAccess>;
  };
  cargos: PermissionAccess;
  organograma: PermissionAccess & {
    /** Fotos configuráveis da Empresa e das Diretorias. */
    fotos: PermissionAccess;
  };
  configuracoes: PermissionAccess;
};

function hasAccess(access: PermissionAccess): boolean {
  return access.view || access.edit;
}

function hasCrudAccess(access: PermissionCrud): boolean {
  return access.view || access.create || access.edit || access.delete;
}

const DEFAULT_ROUTE_ITEMS = [
  { url: "/dashboard#executivo", title: "Dashboard Executivo" },
  { url: "/dashboard#absenteismo", title: "Absenteísmo (por faltas)" },
  { url: "/dashboard#absenteismo-horas", title: "Pontualidade" },
  {
    url: "/dashboard#diagnostico-ausencias-justificadas",
    title: "Diagnóstico Geral - Ausências justificadas",
  },
  { url: "/cargos", title: "Cargos e Salários" },
  { url: "/organograma", title: "Organograma" },
  { url: "/organico", title: "Orgânico" },
  { url: "/faltas-atestados", title: "Faltas e Atestados" },
  { url: "/configuracoes", title: "Configurações" },
] as const;

const ORGANICO_TAB_IDS = [
  "identificacao",
  "cargo",
  "formacao",
  "pessoal",
  "beneficios",
  "remuneracao",
  "banco",
  "contrato",
  "trajetoria",
] as const;

const DASHBOARD_MODULE_IDS = [
  "executivo",
  "absenteismo",
  "absenteismo-horas",
  "diagnostico-ausencias-justificadas",
] as const;

function access(view = false, edit = false): PermissionAccess {
  return { view, edit };
}

function crud(view = false, create = false, edit = false, del = false): PermissionCrud {
  return { view, create, edit, delete: del };
}

function commentPermissions(view = false, edit = false): OrganicoCommentPermissions {
  return {
    view,
    edit,
    tags: buildRhCommentTagAccess(true),
    visibilities: buildRhCommentVisibilityAccess(true),
  };
}

function buildDefaultRoutes() {
  return DEFAULT_ROUTE_ITEMS.map((item) => ({
    url: item.url,
    title: item.title,
    canView: false,
    canEdit: false,
  }));
}

function documentPermissions(): OrganicoDocumentPermissions {
  return {
    view: false,
    create: false,
    edit: false,
    delete: false,
    download: false,
    audit: false,
    deleteGlobalForOne: false,
    deleteGlobalForAll: false,
    categories: buildRhDocumentCategoryAccess(false),
    classifications: buildRhDocumentClassificationAccess(false),
  };
}

const RH_DOCUMENT_CATEGORY_IDS = [
  "admission",
  "identification",
  "contract",
  "payroll",
  "medical",
  "disciplinary",
  "termination",
] as const;

const RH_DOCUMENT_CLASSIFICATION_IDS = ["internal", "confidential", "highly_confidential"] as const;

function buildRhDocumentCategoryAccess(defaultValue = false): Record<string, boolean> {
  return Object.fromEntries(RH_DOCUMENT_CATEGORY_IDS.map((id) => [id, defaultValue]));
}

function buildRhDocumentClassificationAccess(defaultValue = false): Record<string, boolean> {
  return Object.fromEntries(RH_DOCUMENT_CLASSIFICATION_IDS.map((id) => [id, defaultValue]));
}

function readNestedBooleanAccess(
  input: unknown,
  knownKeys: readonly string[],
  fallback: Record<string, boolean>,
): Record<string, boolean> {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const keys = [...new Set([...knownKeys, ...Object.keys(raw)])];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      raw[key] === true ? true : raw[key] === false ? false : fallback[key] ?? false,
    ]),
  );
}

function readDocumentPermissions(input: unknown, fallback: OrganicoDocumentPermissions): OrganicoDocumentPermissions {
  const crud = readCrud(input, fallback);
  if (!input || typeof input !== "object") {
    return {
      ...crud,
      download: fallback.download,
      audit: fallback.audit,
      deleteGlobalForOne: fallback.deleteGlobalForOne,
      deleteGlobalForAll: fallback.deleteGlobalForAll,
      categories: { ...fallback.categories },
      classifications: { ...fallback.classifications },
    };
  }
  const source = input as Record<string, unknown>;
  const hasDeleteGlobalForOne = Object.prototype.hasOwnProperty.call(source, "deleteGlobalForOne");
  const hasDeleteGlobalForAll = Object.prototype.hasOwnProperty.call(source, "deleteGlobalForAll");
  const hasDownload = Object.prototype.hasOwnProperty.call(source, "download");
  const hasAudit = Object.prototype.hasOwnProperty.call(source, "audit");
  return {
    ...crud,
    download: hasDownload ? source.download === true : fallback.download,
    audit: hasAudit ? source.audit === true : fallback.audit,
    deleteGlobalForOne: hasDeleteGlobalForOne ? source.deleteGlobalForOne === true : crud.delete,
    deleteGlobalForAll: hasDeleteGlobalForAll ? source.deleteGlobalForAll === true : crud.delete,
    categories: readNestedBooleanAccess(source.categories, RH_DOCUMENT_CATEGORY_IDS, fallback.categories),
    classifications: readNestedBooleanAccess(
      source.classifications,
      RH_DOCUMENT_CLASSIFICATION_IDS,
      fallback.classifications,
    ),
  };
}

function buildDefaultPermissions(): RhGroupPermissions {
  return {
    version: 2,
    routes: buildDefaultRoutes(),
    organico: {
      allowedSectors: [],
      colaboradores: access(),
      formTabs: Object.fromEntries(ORGANICO_TAB_IDS.map((id) => [id, access()])),
      comentarios: commentPermissions(),
      fotos: access(),
      documentos: documentPermissions(),
      justificarAlteracoesSecullum: false,
      notificarCadastroComplementarSecullum: false,
    },
    faltas: {
      route: access(),
      ausencias: crud(),
      sancoes: crud(),
      cadastros: access(),
      tiposRegras: access(),
      regrasAlertas: access(),
    },
    dashboard: {
      route: access(),
      modulos: Object.fromEntries(DASHBOARD_MODULE_IDS.map((id) => [id, access()])),
    },
    cargos: access(),
    organograma: {
      ...access(),
      fotos: access(),
    },
    configuracoes: access(),
  };
}

function normalizeRouteEntries(input: unknown) {
  const defaults = buildDefaultRoutes();
  if (!Array.isArray(input)) return defaults;
  return defaults.map((item) => {
    const source = input.find((entry) => {
      if (!entry || typeof entry !== "object") return false;
      return String((entry as Record<string, unknown>).url ?? "").trim() === item.url;
    }) as Record<string, unknown> | undefined;
    if (!source) return item;
    return {
      url: item.url,
      title: item.title,
      canView: source.canView === true,
      canEdit: source.canEdit === true,
    };
  });
}

function routeByUrl(routes: RhGroupPermissions["routes"], url: string) {
  return routes.find((entry) => entry.url === url);
}

function readAccess(input: unknown, fallback: PermissionAccess): PermissionAccess {
  if (!input || typeof input !== "object") return { ...fallback };
  const source = input as Record<string, unknown>;
  return {
    view: source.view === true || source.canView === true || fallback.view,
    edit: source.edit === true || source.canEdit === true || fallback.edit,
  };
}

function readAccessFromAccessOrCrud(input: unknown, fallback: PermissionAccess): PermissionAccess {
  if (!input || typeof input !== "object") return { ...fallback };
  const source = input as Record<string, unknown>;
  const legacyWrite = source.create === true || source.delete === true || source.remove === true;
  return {
    view: source.view === true || source.canView === true || legacyWrite || fallback.view,
    edit: source.edit === true || source.canEdit === true || legacyWrite || fallback.edit,
  };
}

function readCommentPermissions(input: unknown, fallback: OrganicoCommentPermissions): OrganicoCommentPermissions {
  const normalizedAccess = readAccessFromAccessOrCrud(input, fallback);
  if (!input || typeof input !== "object") {
    return {
      view: normalizedAccess.view,
      edit: normalizedAccess.edit,
      tags: { ...fallback.tags },
      visibilities: { ...fallback.visibilities },
    };
  }

  const source = input as Record<string, unknown>;
  const rawTags = source.tags && typeof source.tags === "object" ? (source.tags as Record<string, unknown>) : {};
  const normalizedRawTags = Object.fromEntries(
    Object.entries(rawTags).map(([key, value]) => [normalizeRhCommentTagId(key), value]),
  ) as Record<string, unknown>;
  const rawVisibilities =
    source.visibilities && typeof source.visibilities === "object" ? (source.visibilities as Record<string, unknown>) : {};
  const visibilitiesExplicitlyConfigured = Object.keys(rawVisibilities).length > 0;

  return {
    view: normalizedAccess.view,
    edit: normalizedAccess.edit,
    tags: Object.fromEntries(
      [...new Set([...Object.keys(fallback.tags), ...Object.keys(normalizedRawTags)])].map((key) => [
        key,
        normalizedRawTags[key] === true ? true : normalizedRawTags[key] === false ? false : fallback.tags[key] ?? true,
      ]),
    ) as Record<string, boolean>,
    visibilities: Object.fromEntries(
      Object.entries(fallback.visibilities).map(([key, legacyDefault]) => [
        key,
        visibilitiesExplicitlyConfigured ? rawVisibilities[key] === true : legacyDefault,
      ]),
    ) as Record<RhOrganicoCommentVisibilityId, boolean>,
  };
}

function readCrud(input: unknown, fallback: PermissionCrud): PermissionCrud {
  if (!input || typeof input !== "object") return { ...fallback };
  const source = input as Record<string, unknown>;
  return {
    view: source.view === true || fallback.view,
    create: source.create === true || fallback.create,
    edit: source.edit === true || fallback.edit,
    delete: source.delete === true || source.remove === true || fallback.delete,
  };
}

function applyLegacy(routes: RhGroupPermissions["routes"]): RhGroupPermissions {
  const next = buildDefaultPermissions();
  const organico = routeByUrl(routes, "/organico");
  const faltas = routeByUrl(routes, "/faltas-atestados");
  const cargos = routeByUrl(routes, "/cargos");
  const organograma = routeByUrl(routes, "/organograma");
  const configuracoes = routeByUrl(routes, "/configuracoes");
  const dashboard = routeByUrl(routes, "/dashboard");
  const dashboardExecutivo = routeByUrl(routes, "/dashboard#executivo");
  const dashboardAbs = routeByUrl(routes, "/dashboard#absenteismo");
  const dashboardHoras = routeByUrl(routes, "/dashboard#absenteismo-horas");
  const dashboardDiagnosticoAusencias = routeByUrl(routes, "/dashboard#diagnostico-ausencias-justificadas");

  const organicoView = !!(organico?.canView || organico?.canEdit);
  const organicoEdit = !!organico?.canEdit;
  next.organico.colaboradores = access(organicoView, organicoEdit);
  for (const id of ORGANICO_TAB_IDS) {
    next.organico.formTabs[id] = access(organicoView, organicoEdit);
  }
  next.organico.comentarios = commentPermissions(organicoView, organicoEdit);
  next.organico.fotos = access(organicoView, organicoEdit);
  next.organico.documentos = {
    view: organicoView,
    create: organicoEdit,
    edit: organicoEdit,
    delete: organicoEdit,
    download: organicoView,
    audit: organicoView,
    deleteGlobalForOne: organicoEdit,
    deleteGlobalForAll: organicoEdit,
    categories: buildRhDocumentCategoryAccess(organicoView),
    classifications: buildRhDocumentClassificationAccess(organicoView),
  };

  const faltasView = !!(faltas?.canView || faltas?.canEdit);
  const faltasEdit = !!faltas?.canEdit;
  next.faltas.route = access(faltasView, faltasEdit);
  next.faltas.ausencias = crud(faltasView, faltasEdit, faltasEdit, faltasEdit);
  next.faltas.sancoes = crud(faltasView, faltasEdit, faltasEdit, faltasEdit);
  next.faltas.cadastros = access(faltasView, faltasEdit);
  next.faltas.tiposRegras = access(faltasView, faltasEdit);
  next.faltas.regrasAlertas = access(faltasView, faltasEdit);

  const fallbackDashView = !!(dashboard?.canView || dashboard?.canEdit);
  const fallbackDashEdit = !!dashboard?.canEdit;
  next.dashboard.modulos.executivo = access(
    !!(dashboardExecutivo?.canView || dashboardExecutivo?.canEdit || fallbackDashView),
    !!(dashboardExecutivo?.canEdit || fallbackDashEdit),
  );
  next.dashboard.modulos.absenteismo = access(
    !!(dashboardAbs?.canView || dashboardAbs?.canEdit || fallbackDashView),
    !!(dashboardAbs?.canEdit || fallbackDashEdit),
  );
  next.dashboard.modulos["absenteismo-horas"] = access(
    !!(dashboardHoras?.canView || dashboardHoras?.canEdit || fallbackDashView),
    !!(dashboardHoras?.canEdit || fallbackDashEdit),
  );
  next.dashboard.modulos["diagnostico-ausencias-justificadas"] = access(
    !!(
      dashboardDiagnosticoAusencias?.canView ||
      dashboardDiagnosticoAusencias?.canEdit ||
      fallbackDashView
    ),
    !!(dashboardDiagnosticoAusencias?.canEdit || fallbackDashEdit),
  );
  syncCompositeAccess(next);

  next.cargos = access(!!(cargos?.canView || cargos?.canEdit), !!cargos?.canEdit);
  const organogramaView = !!(organograma?.canView || organograma?.canEdit);
  const organogramaEdit = !!organograma?.canEdit;
  next.organograma = {
    ...access(organogramaView, organogramaEdit),
    fotos: access(organogramaView, organogramaEdit),
  };
  next.configuracoes = access(!!(configuracoes?.canView || configuracoes?.canEdit), !!configuracoes?.canEdit);
  next.routes = deriveRoutesFromPermissions(next);
  return next;
}

function deriveRoutesFromPermissions(next: RhGroupPermissions): RhGroupPermissions["routes"] {
  return buildDefaultRoutes().map((item) => {
    switch (item.url) {
      case "/organico": {
        const canView =
          hasAccess(next.organico.colaboradores) ||
          hasAccess(next.organico.comentarios) ||
          hasAccess(next.organico.fotos) ||
          hasCrudAccess(next.organico.documentos) ||
          Object.values(next.organico.formTabs).some(hasAccess);
        const canEdit =
          next.organico.colaboradores.edit ||
          next.organico.comentarios.edit ||
          next.organico.fotos.edit ||
          next.organico.documentos.create ||
          next.organico.documentos.edit ||
          next.organico.documentos.delete ||
          Object.values(next.organico.formTabs).some((tab) => tab.edit);
        return { ...item, canView, canEdit };
      }
      case "/faltas-atestados": {
        const canView =
          hasCrudAccess(next.faltas.ausencias) ||
          hasCrudAccess(next.faltas.sancoes) ||
          hasAccess(next.faltas.cadastros) ||
          hasAccess(next.faltas.tiposRegras) ||
          hasAccess(next.faltas.regrasAlertas);
        const canEdit =
          next.faltas.ausencias.create ||
          next.faltas.ausencias.edit ||
          next.faltas.ausencias.delete ||
          next.faltas.sancoes.create ||
          next.faltas.sancoes.edit ||
          next.faltas.sancoes.delete ||
          next.faltas.cadastros.edit ||
          next.faltas.tiposRegras.edit ||
          next.faltas.regrasAlertas.edit;
        return { ...item, canView, canEdit };
      }
      case "/dashboard#executivo": {
        const mod = next.dashboard.modulos.executivo;
        return { ...item, canView: mod.view || mod.edit, canEdit: mod.edit };
      }
      case "/dashboard#absenteismo": {
        const mod = next.dashboard.modulos.absenteismo;
        return { ...item, canView: mod.view || mod.edit, canEdit: mod.edit };
      }
      case "/dashboard#absenteismo-horas": {
        const mod = next.dashboard.modulos["absenteismo-horas"];
        return { ...item, canView: mod.view || mod.edit, canEdit: mod.edit };
      }
      case "/dashboard#diagnostico-ausencias-justificadas": {
        const mod = next.dashboard.modulos["diagnostico-ausencias-justificadas"];
        return { ...item, canView: mod.view || mod.edit, canEdit: mod.edit };
      }
      case "/cargos":
        return { ...item, canView: next.cargos.view || next.cargos.edit, canEdit: next.cargos.edit };
      case "/organograma":
        return {
          ...item,
          canView: next.organograma.view || next.organograma.edit || hasAccess(next.organograma.fotos),
          canEdit: next.organograma.edit || next.organograma.fotos.edit,
        };
      case "/configuracoes":
        return { ...item, canView: next.configuracoes.view || next.configuracoes.edit, canEdit: next.configuracoes.edit };
      default:
        return item;
    }
  });
}

function syncCompositeAccess(next: RhGroupPermissions): void {
  next.faltas.route = {
    view:
      hasCrudAccess(next.faltas.ausencias) ||
      hasCrudAccess(next.faltas.sancoes) ||
      hasAccess(next.faltas.cadastros) ||
      hasAccess(next.faltas.tiposRegras) ||
      hasAccess(next.faltas.regrasAlertas),
    edit:
      next.faltas.ausencias.create ||
      next.faltas.ausencias.edit ||
      next.faltas.ausencias.delete ||
      next.faltas.sancoes.create ||
      next.faltas.sancoes.edit ||
      next.faltas.sancoes.delete ||
      next.faltas.cadastros.edit ||
      next.faltas.tiposRegras.edit ||
      next.faltas.regrasAlertas.edit,
  };

  next.dashboard.route = {
    view: Object.values(next.dashboard.modulos).some(hasAccess),
    edit: Object.values(next.dashboard.modulos).some((item) => item.edit),
  };
}

export function normalizeRhPermissions(input: unknown): RhGroupPermissions {
  if (Array.isArray(input)) {
    return applyLegacy(normalizeRouteEntries(input));
  }

  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const routes = normalizeRouteEntries(source.routes);
  const legacy = applyLegacy(routes);
  const next = buildDefaultPermissions();
  const organico = source.organico && typeof source.organico === "object" ? (source.organico as Record<string, unknown>) : {};
  const faltas = source.faltas && typeof source.faltas === "object" ? (source.faltas as Record<string, unknown>) : {};
  const dashboard = source.dashboard && typeof source.dashboard === "object" ? (source.dashboard as Record<string, unknown>) : {};
  const hasOrganicoConfig = Object.keys(organico).length > 0;
  const hasFaltasConfig = Object.keys(faltas).length > 0;
  const hasDashboardConfig = Object.keys(dashboard).length > 0;

  next.organico.allowedSectors = Array.isArray(organico.allowedSectors)
    ? organico.allowedSectors.map((item) => String(item).trim()).filter(Boolean)
    : hasOrganicoConfig
      ? []
      : legacy.organico.allowedSectors;
  next.organico.colaboradores = hasOrganicoConfig
    ? readAccess(organico.colaboradores, access())
    : legacy.organico.colaboradores;
  next.organico.comentarios = hasOrganicoConfig
    ? readCommentPermissions(organico.comentarios, commentPermissions())
    : legacy.organico.comentarios;
  next.organico.fotos = hasOrganicoConfig
    ? readAccessFromAccessOrCrud(organico.fotos, access())
    : legacy.organico.fotos;
  next.organico.documentos = hasOrganicoConfig
    ? readDocumentPermissions(organico.documentos, documentPermissions())
    : legacy.organico.documentos;
  next.organico.justificarAlteracoesSecullum = hasOrganicoConfig
    ? organico.justificarAlteracoesSecullum === true
    : legacy.organico.justificarAlteracoesSecullum;
  next.organico.notificarCadastroComplementarSecullum = hasOrganicoConfig
    ? organico.notificarCadastroComplementarSecullum === true
    : legacy.organico.notificarCadastroComplementarSecullum;
  const rawTabs = organico.formTabs && typeof organico.formTabs === "object" ? (organico.formTabs as Record<string, unknown>) : {};
  for (const id of ORGANICO_TAB_IDS) {
    next.organico.formTabs[id] = hasOrganicoConfig ? readAccess(rawTabs[id], access()) : legacy.organico.formTabs[id];
  }

  next.faltas.route = hasFaltasConfig ? readAccess(faltas.route, access()) : legacy.faltas.route;
  next.faltas.ausencias = hasFaltasConfig ? readCrud(faltas.ausencias, crud()) : legacy.faltas.ausencias;
  next.faltas.sancoes = hasFaltasConfig ? readCrud(faltas.sancoes, crud()) : legacy.faltas.sancoes;
  next.faltas.cadastros = hasFaltasConfig ? readAccess(faltas.cadastros, access()) : legacy.faltas.cadastros;
  next.faltas.tiposRegras = hasFaltasConfig
    ? Object.prototype.hasOwnProperty.call(faltas, "tiposRegras")
      ? readAccess(faltas.tiposRegras, access())
      : { ...next.faltas.cadastros }
    : legacy.faltas.tiposRegras;
  next.faltas.regrasAlertas = hasFaltasConfig
    ? Object.prototype.hasOwnProperty.call(faltas, "regrasAlertas")
      ? readAccess(faltas.regrasAlertas, access())
      : {
          view: hasCrudAccess(next.faltas.ausencias),
          edit:
            next.faltas.ausencias.create || next.faltas.ausencias.edit || next.faltas.ausencias.delete,
        }
    : legacy.faltas.regrasAlertas;

  const rawModules = dashboard.modulos && typeof dashboard.modulos === "object" ? (dashboard.modulos as Record<string, unknown>) : {};
  for (const id of DASHBOARD_MODULE_IDS) {
    next.dashboard.modulos[id] = hasDashboardConfig ? readAccess(rawModules[id], access()) : legacy.dashboard.modulos[id];
  }
  next.dashboard.route = hasDashboardConfig ? readAccess(dashboard.route, access()) : legacy.dashboard.route;

  next.cargos = Object.hasOwn(source, "cargos") ? readAccess(source.cargos, access()) : legacy.cargos;
  if (Object.hasOwn(source, "organograma")) {
    const organograma =
      source.organograma && typeof source.organograma === "object"
        ? (source.organograma as Record<string, unknown>)
        : {};
    const acessoOrganograma = readAccess(source.organograma, access());
    next.organograma = {
      ...acessoOrganograma,
      fotos: Object.hasOwn(organograma, "fotos")
        ? readAccess(organograma.fotos, access())
        : { ...acessoOrganograma },
    };
  } else {
    next.organograma = legacy.organograma;
  }
  next.configuracoes = Object.hasOwn(source, "configuracoes") ? readAccess(source.configuracoes, access()) : legacy.configuracoes;
  syncCompositeAccess(next);
  next.routes = deriveRoutesFromPermissions(next);
  return next;
}

export function canViewRoute(permissions: RhGroupPermissions, path: string): boolean {
  const route = routeByUrl(permissions.routes, path);
  return !!route && (route.canView || route.canEdit);
}

export function canEditRoute(permissions: RhGroupPermissions, path: string): boolean {
  const route = routeByUrl(permissions.routes, path);
  return !!route?.canEdit;
}

/**
 * Recalcula permissão a partir dos blocos `organico`, `cargos`, `faltas`, etc.
 * (espelha `deriveRoutesFromPermissions`.) Usado como fallback em `requireRhAccess`
 * quando o array `routes` no JSON do grupo estiver desatualizado ou incompatível.
 */
export function granularPermissionFallback(
  permissions: RhGroupPermissions,
  targetUrl: string,
  mode: "view" | "edit",
): boolean {
  switch (targetUrl) {
    case "/organico": {
      if (mode === "edit") {
        return (
          permissions.organico.colaboradores.edit ||
          permissions.organico.comentarios.edit ||
          permissions.organico.fotos.edit ||
          permissions.organico.documentos.create ||
          permissions.organico.documentos.edit ||
          permissions.organico.documentos.delete ||
          Object.values(permissions.organico.formTabs).some((t) => t.edit)
        );
      }
      return (
        hasAccess(permissions.organico.colaboradores) ||
        hasAccess(permissions.organico.comentarios) ||
        hasAccess(permissions.organico.fotos) ||
        hasCrudAccess(permissions.organico.documentos) ||
        Object.values(permissions.organico.formTabs).some(hasAccess)
      );
    }
    case "/cargos":
      return mode === "edit"
        ? permissions.cargos.edit
        : permissions.cargos.view || permissions.cargos.edit;
    case "/organograma":
      return mode === "edit"
        ? permissions.organograma.edit || permissions.organograma.fotos.edit
        : permissions.organograma.view ||
            permissions.organograma.edit ||
            hasAccess(permissions.organograma.fotos);
    case "/configuracoes":
      return mode === "edit"
        ? permissions.configuracoes.edit
        : permissions.configuracoes.view || permissions.configuracoes.edit;
    case "/dashboard#executivo": {
      const m = permissions.dashboard.modulos.executivo;
      return mode === "edit" ? m.edit : m.view || m.edit;
    }
    case "/dashboard#absenteismo": {
      const m = permissions.dashboard.modulos.absenteismo;
      return mode === "edit" ? m.edit : m.view || m.edit;
    }
    case "/dashboard#absenteismo-horas": {
      const m = permissions.dashboard.modulos["absenteismo-horas"];
      return mode === "edit" ? m.edit : m.view || m.edit;
    }
    case "/dashboard#diagnostico-ausencias-justificadas": {
      const m = permissions.dashboard.modulos["diagnostico-ausencias-justificadas"];
      return mode === "edit" ? m.edit : m.view || m.edit;
    }
    case "/faltas-atestados": {
      const canViewFaltas =
        hasCrudAccess(permissions.faltas.ausencias) ||
        hasCrudAccess(permissions.faltas.sancoes) ||
        hasAccess(permissions.faltas.cadastros) ||
        hasAccess(permissions.faltas.tiposRegras) ||
        hasAccess(permissions.faltas.regrasAlertas);
      const canEditFaltas =
        permissions.faltas.ausencias.create ||
        permissions.faltas.ausencias.edit ||
        permissions.faltas.ausencias.delete ||
        permissions.faltas.sancoes.create ||
        permissions.faltas.sancoes.edit ||
        permissions.faltas.sancoes.delete ||
        permissions.faltas.cadastros.edit ||
        permissions.faltas.tiposRegras.edit ||
        permissions.faltas.regrasAlertas.edit;
      return mode === "edit" ? canEditFaltas : canViewFaltas;
    }
    default:
      return false;
  }
}

export function hasSectorAccess(permissions: RhGroupPermissions, setor: string | null | undefined): boolean {
  const allowed = permissions.organico.allowedSectors;
  if (allowed.length === 0) return true;
  const normalized = String(setor ?? "").trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return false;
  return allowed.some((item) => item.toLocaleLowerCase("pt-BR") === normalized);
}

export function canViewOrganicoCommentClassification(
  permissions: RhGroupPermissions,
  tagId: string,
  visibility: string,
): boolean {
  if (!hasAccess(permissions.organico.comentarios)) return false;
  const normalizedTagId = normalizeRhCommentTagId(tagId);
  if (!(visibility in permissions.organico.comentarios.visibilities)) return false;
  const exactTagPermission = permissions.organico.comentarios.tags[tagId];
  const normalizedTagPermission = permissions.organico.comentarios.tags[normalizedTagId];
  const hasTagAccess =
    exactTagPermission === false
      ? false
      : exactTagPermission === true
        ? true
        : normalizedTagPermission === false
          ? false
          : normalizedTagPermission === true
            ? true
            : true;
  return (
    hasTagAccess &&
    permissions.organico.comentarios.visibilities[visibility as RhOrganicoCommentVisibilityId] === true
  );
}
