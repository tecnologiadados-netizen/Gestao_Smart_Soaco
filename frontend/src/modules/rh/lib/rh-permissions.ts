import { permissionItems } from "@rh/lib/permission-catalog";
import {
  buildCommentTagAccess,
  buildCommentVisibilityAccess,
  normalizeOrganicoCommentTagId,
  type OrganicoCommentVisibilityId,
} from "@rh/lib/organico-comment-tags";
import {
  buildDocumentCategoryAccess,
  buildDocumentClassificationAccess,
  type OrganicoDocumentCategoryId,
  type OrganicoDocumentClassificationId,
} from "@rh/lib/organico-documents";

export type LegacyRoutePermission = {
  url: string;
  title: string;
  canView: boolean;
  canEdit: boolean;
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
  visibilities: Record<OrganicoCommentVisibilityId, boolean>;
};

export type OrganicoDocumentPermissions = PermissionCrud & {
  download: boolean;
  audit: boolean;
  /** Excluir pasta global apenas no colaborador atual. Requer `delete`. */
  deleteGlobalForOne: boolean;
  /** Excluir pasta global para todos os colaboradores. Requer `delete`. */
  deleteGlobalForAll: boolean;
  categories: Record<OrganicoDocumentCategoryId, boolean>;
  classifications: Record<OrganicoDocumentClassificationId, boolean>;
};

export const ORGANICO_TAB_OPTIONS = [
  { id: "identificacao", label: "Identificação" },
  { id: "cargo", label: "Cargo e Trabalho" },
  { id: "formacao", label: "Formação" },
  { id: "pessoal", label: "Pessoal" },
  { id: "beneficios", label: "Benefícios" },
  { id: "remuneracao", label: "Remuneração" },
  { id: "banco", label: "Dados Bancários" },
  { id: "contrato", label: "Contrato" },
  { id: "trajetoria", label: "Trajetória" },
] as const;

export type OrganicoTabId = (typeof ORGANICO_TAB_OPTIONS)[number]["id"];

export const DASHBOARD_MODULE_OPTIONS = [
  { id: "executivo", label: "Dashboard Executivo", url: "/dashboard#executivo" },
  { id: "absenteismo", label: "Absenteísmo (por faltas)", url: "/dashboard#absenteismo" },
  { id: "absenteismo-horas", label: "Pontualidade", url: "/dashboard#absenteismo-horas" },
  {
    id: "diagnostico-ausencias-justificadas",
    label: "Diagnóstico Geral - Ausências justificadas",
    url: "/dashboard#diagnostico-ausencias-justificadas",
  },
] as const;

export type DashboardModuleId = (typeof DASHBOARD_MODULE_OPTIONS)[number]["id"];

export type RhGroupPermissions = {
  version: 2;
  routes: LegacyRoutePermission[];
  organico: {
    allowedSectors: string[];
    colaboradores: PermissionAccess;
    formTabs: Record<OrganicoTabId, PermissionAccess>;
    comentarios: OrganicoCommentPermissions;
    fotos: PermissionAccess;
    documentos: OrganicoDocumentPermissions;
    /** Ver banner / pendências e registrar motivo para alterações CTPS ou cargo (Secullum). Master ignora o flag. */
    justificarAlteracoesSecullum: boolean;
    /** Toast quando a Secullum incluir colaborador novo (cadastro complementar no Orgânico). Master ignora o flag. */
    notificarCadastroComplementarSecullum: boolean;
  };
  faltas: {
    route: PermissionAccess;
    ausencias: PermissionCrud;
    sancoes: PermissionCrud;
    cadastros: PermissionAccess;
    tiposRegras: PermissionAccess;
    /** Aba Regras de alertas: ativar/desativar regras e resolver inconsistências. */
    regrasAlertas: PermissionAccess;
  };
  dashboard: {
    route: PermissionAccess;
    modulos: Record<DashboardModuleId, PermissionAccess>;
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

function buildAccess(view = false, edit = false): PermissionAccess {
  return { view, edit };
}

function buildCrud(view = false, create = false, edit = false, del = false): PermissionCrud {
  return { view, create, edit, delete: del };
}

function buildCommentPermissions(view = false, edit = false): OrganicoCommentPermissions {
  return {
    view,
    edit,
    tags: buildCommentTagAccess(true),
    visibilities: buildCommentVisibilityAccess(true),
  };
}

function buildDocumentPermissions(): OrganicoDocumentPermissions {
  return {
    view: false,
    create: false,
    edit: false,
    delete: false,
    download: false,
    audit: false,
    deleteGlobalForOne: false,
    deleteGlobalForAll: false,
    categories: buildDocumentCategoryAccess(false),
    classifications: buildDocumentClassificationAccess(false),
  };
}

function cloneRoutePermission(item: LegacyRoutePermission): LegacyRoutePermission {
  return {
    url: item.url,
    title: item.title,
    canView: !!item.canView,
    canEdit: !!item.canEdit,
  };
}

export function buildDefaultRoutePermissions(): LegacyRoutePermission[] {
  return permissionItems.map((item) => ({
    url: item.url,
    title: item.title,
    canView: false,
    canEdit: false,
  }));
}

export function buildDefaultGroupPermissions(): RhGroupPermissions {
  return {
    version: 2,
    routes: buildDefaultRoutePermissions(),
    organico: {
      allowedSectors: [],
      colaboradores: buildAccess(),
      formTabs: {
        identificacao: buildAccess(),
        cargo: buildAccess(),
        formacao: buildAccess(),
        pessoal: buildAccess(),
        beneficios: buildAccess(),
        remuneracao: buildAccess(),
        banco: buildAccess(),
        contrato: buildAccess(),
        trajetoria: buildAccess(),
      },
      comentarios: buildCommentPermissions(),
      fotos: buildAccess(),
      documentos: buildDocumentPermissions(),
      justificarAlteracoesSecullum: false,
      notificarCadastroComplementarSecullum: false,
    },
    faltas: {
      route: buildAccess(),
      ausencias: buildCrud(),
      sancoes: buildCrud(),
      cadastros: buildAccess(),
      tiposRegras: buildAccess(),
      regrasAlertas: buildAccess(),
    },
    dashboard: {
      route: buildAccess(),
      modulos: {
        executivo: buildAccess(),
        absenteismo: buildAccess(),
        "absenteismo-horas": buildAccess(),
        "diagnostico-ausencias-justificadas": buildAccess(),
      },
    },
    cargos: buildAccess(),
    organograma: {
      ...buildAccess(),
      fotos: buildAccess(),
    },
    configuracoes: buildAccess(),
  };
}

function readAccess(input: unknown, fallback?: PermissionAccess): PermissionAccess {
  const base = fallback ?? buildAccess();
  if (!input || typeof input !== "object") return { ...base };
  const source = input as Record<string, unknown>;
  return {
    view: source.view === true || source.canView === true || base.view,
    edit: source.edit === true || source.canEdit === true || base.edit,
  };
}

function readAccessFromAccessOrCrud(input: unknown, fallback?: PermissionAccess): PermissionAccess {
  const base = fallback ?? buildAccess();
  if (!input || typeof input !== "object") return { ...base };
  const source = input as Record<string, unknown>;
  const legacyWrite = source.create === true || source.delete === true || source.remove === true;
  return {
    view: source.view === true || source.canView === true || legacyWrite || base.view,
    edit: source.edit === true || source.canEdit === true || legacyWrite || base.edit,
  };
}

function readCommentPermissions(input: unknown, fallback?: OrganicoCommentPermissions): OrganicoCommentPermissions {
  const base = fallback ?? buildCommentPermissions();
  const access = readAccessFromAccessOrCrud(input, base);
  if (!input || typeof input !== "object") {
    return {
      view: access.view,
      edit: access.edit,
      tags: { ...base.tags },
      visibilities: { ...base.visibilities },
    };
  }

  const source = input as Record<string, unknown>;
  const rawTags = source.tags && typeof source.tags === "object" ? (source.tags as Record<string, unknown>) : {};
  const normalizedRawTags = Object.fromEntries(
    Object.entries(rawTags).map(([key, value]) => [normalizeOrganicoCommentTagId(key), value]),
  ) as Record<string, unknown>;
  const rawVisibilities =
    source.visibilities && typeof source.visibilities === "object" ? (source.visibilities as Record<string, unknown>) : {};
  /** Se o objeto `visibilities` existir no JSON com ao menos uma chave, só `true` explícito libera ver; chaves omitidas = não ver. */
  const visibilitiesExplicitlyConfigured = Object.keys(rawVisibilities).length > 0;

  return {
    view: access.view,
    edit: access.edit,
    tags: Object.fromEntries(
      [...new Set([...Object.keys(base.tags), ...Object.keys(normalizedRawTags)])].map((key) => [
        key,
        normalizedRawTags[key] === true ? true : normalizedRawTags[key] === false ? false : base.tags[key] ?? true,
      ]),
    ) as Record<string, boolean>,
    visibilities: Object.fromEntries(
      Object.entries(base.visibilities).map(([key, legacyDefault]) => [
        key,
        visibilitiesExplicitlyConfigured ? rawVisibilities[key] === true : legacyDefault,
      ]),
    ) as Record<OrganicoCommentVisibilityId, boolean>,
  };
}

function readDocumentPermissions(input: unknown, fallback?: OrganicoDocumentPermissions): OrganicoDocumentPermissions {
  const base = fallback ?? buildDocumentPermissions();
  const crud = readCrud(input, base);
  if (!input || typeof input !== "object") {
    return {
      ...crud,
      download: base.download,
      audit: base.audit,
      deleteGlobalForOne: base.deleteGlobalForOne,
      deleteGlobalForAll: base.deleteGlobalForAll,
      categories: { ...base.categories },
      classifications: { ...base.classifications },
    };
  }

  const source = input as Record<string, unknown>;
  const rawCategories =
    source.categories && typeof source.categories === "object" ? (source.categories as Record<string, unknown>) : {};
  const rawClassifications =
    source.classifications && typeof source.classifications === "object"
      ? (source.classifications as Record<string, unknown>)
      : {};
  const hasDeleteGlobalForOne = Object.prototype.hasOwnProperty.call(source, "deleteGlobalForOne");
  const hasDeleteGlobalForAll = Object.prototype.hasOwnProperty.call(source, "deleteGlobalForAll");

  return {
    ...crud,
    download: source.download === true || base.download,
    audit: source.audit === true || base.audit,
    deleteGlobalForOne: hasDeleteGlobalForOne ? source.deleteGlobalForOne === true : crud.delete,
    deleteGlobalForAll: hasDeleteGlobalForAll ? source.deleteGlobalForAll === true : crud.delete,
    categories: Object.fromEntries(
      Object.entries(base.categories).map(([key, value]) => [
        key,
        rawCategories[key] === true ? true : rawCategories[key] === false ? false : value,
      ]),
    ) as Record<OrganicoDocumentCategoryId, boolean>,
    classifications: Object.fromEntries(
      Object.entries(base.classifications).map(([key, value]) => [
        key,
        rawClassifications[key] === true ? true : rawClassifications[key] === false ? false : value,
      ]),
    ) as Record<OrganicoDocumentClassificationId, boolean>,
  };
}

function readCrud(input: unknown, fallback?: PermissionCrud): PermissionCrud {
  const base = fallback ?? buildCrud();
  if (!input || typeof input !== "object") return { ...base };
  const source = input as Record<string, unknown>;
  return {
    view: source.view === true || base.view,
    create: source.create === true || base.create,
    edit: source.edit === true || base.edit,
    delete: source.delete === true || source.remove === true || base.delete,
  };
}

function pickLegacyRoute(routes: LegacyRoutePermission[], url: string): LegacyRoutePermission | undefined {
  return routes.find((entry) => entry.url === url);
}

function normalizeLegacyRoutes(input: unknown): LegacyRoutePermission[] {
  if (!Array.isArray(input)) return buildDefaultRoutePermissions();
  const defaults = buildDefaultRoutePermissions();
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

function deriveRoutesFromPermissions(next: RhGroupPermissions): LegacyRoutePermission[] {
  const defaults = buildDefaultRoutePermissions();
  return defaults.map((item) => {
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
      case "/dashboard": {
        const canView = Object.values(next.dashboard.modulos).some(hasAccess);
        const canEdit = Object.values(next.dashboard.modulos).some((mod) => mod.edit);
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
    edit: Object.values(next.dashboard.modulos).some((mod) => mod.edit),
  };
}

function applyLegacyToPermissions(routes: LegacyRoutePermission[]): RhGroupPermissions {
  const next = buildDefaultGroupPermissions();
  const organico = pickLegacyRoute(routes, "/organico");
  const faltas = pickLegacyRoute(routes, "/faltas-atestados");
  const cargos = pickLegacyRoute(routes, "/cargos");
  const organograma = pickLegacyRoute(routes, "/organograma");
  const configuracoes = pickLegacyRoute(routes, "/configuracoes");
  const dashboard = pickLegacyRoute(routes, "/dashboard");
  const dashboardExecutivo = pickLegacyRoute(routes, "/dashboard#executivo");
  const dashboardAbs = pickLegacyRoute(routes, "/dashboard#absenteismo");
  const dashboardHoras = pickLegacyRoute(routes, "/dashboard#absenteismo-horas");
  const dashboardDiagnosticoAusencias = pickLegacyRoute(routes, "/dashboard#diagnostico-ausencias-justificadas");

  const organicoView = !!(organico?.canView || organico?.canEdit);
  const organicoEdit = !!organico?.canEdit;
  next.organico.colaboradores = buildAccess(organicoView, organicoEdit);
  for (const tab of ORGANICO_TAB_OPTIONS) {
    next.organico.formTabs[tab.id] = buildAccess(organicoView, organicoEdit);
  }
  next.organico.comentarios = buildCommentPermissions(organicoView, organicoEdit);
  next.organico.fotos = buildAccess(organicoView, organicoEdit);
  next.organico.documentos = buildDocumentPermissions();

  const faltasView = !!(faltas?.canView || faltas?.canEdit);
  const faltasEdit = !!faltas?.canEdit;
  next.faltas.route = buildAccess(faltasView, faltasEdit);
  next.faltas.ausencias = buildCrud(faltasView, faltasEdit, faltasEdit, faltasEdit);
  next.faltas.sancoes = buildCrud(faltasView, faltasEdit, faltasEdit, faltasEdit);
  next.faltas.cadastros = buildAccess(faltasView, faltasEdit);
  next.faltas.tiposRegras = buildAccess(faltasView, faltasEdit);
  next.faltas.regrasAlertas = buildAccess(faltasView, faltasEdit);

  next.cargos = buildAccess(!!(cargos?.canView || cargos?.canEdit), !!cargos?.canEdit);
  const organogramaView = !!(organograma?.canView || organograma?.canEdit);
  const organogramaEdit = !!organograma?.canEdit;
  next.organograma = {
    ...buildAccess(organogramaView, organogramaEdit),
    fotos: buildAccess(organogramaView, organogramaEdit),
  };
  next.configuracoes = buildAccess(!!(configuracoes?.canView || configuracoes?.canEdit), !!configuracoes?.canEdit);

  const fallbackDashView = !!(dashboard?.canView || dashboard?.canEdit);
  const fallbackDashEdit = !!dashboard?.canEdit;
  next.dashboard.route = buildAccess(fallbackDashView, fallbackDashEdit);
  next.dashboard.modulos.executivo = buildAccess(
    !!(dashboardExecutivo?.canView || dashboardExecutivo?.canEdit || fallbackDashView),
    !!(dashboardExecutivo?.canEdit || fallbackDashEdit),
  );
  next.dashboard.modulos.absenteismo = buildAccess(
    !!(dashboardAbs?.canView || dashboardAbs?.canEdit || fallbackDashView),
    !!(dashboardAbs?.canEdit || fallbackDashEdit),
  );
  next.dashboard.modulos["absenteismo-horas"] = buildAccess(
    !!(dashboardHoras?.canView || dashboardHoras?.canEdit || fallbackDashView),
    !!(dashboardHoras?.canEdit || fallbackDashEdit),
  );
  next.dashboard.modulos["diagnostico-ausencias-justificadas"] = buildAccess(
    !!(dashboardDiagnosticoAusencias?.canView || dashboardDiagnosticoAusencias?.canEdit || fallbackDashView),
    !!(dashboardDiagnosticoAusencias?.canEdit || fallbackDashEdit),
  );

  next.routes = deriveRoutesFromPermissions(next);
  return next;
}

export function normalizeGroupPermissions(input: unknown): RhGroupPermissions {
  if (Array.isArray(input)) {
    return applyLegacyToPermissions(normalizeLegacyRoutes(input));
  }

  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const maybeRoutes = normalizeLegacyRoutes(source.routes);
  const legacy = applyLegacyToPermissions(maybeRoutes);
  const next = buildDefaultGroupPermissions();

  const organico = source.organico && typeof source.organico === "object" ? (source.organico as Record<string, unknown>) : {};
  const faltas = source.faltas && typeof source.faltas === "object" ? (source.faltas as Record<string, unknown>) : {};
  const dashboard = source.dashboard && typeof source.dashboard === "object" ? (source.dashboard as Record<string, unknown>) : {};
  const hasOrganicoConfig = Object.keys(organico).length > 0;
  const hasFaltasConfig = Object.keys(faltas).length > 0;
  const hasDashboardConfig = Object.keys(dashboard).length > 0;

  next.organico.allowedSectors = Array.isArray(organico.allowedSectors)
    ? organico.allowedSectors.map((value) => String(value).trim()).filter(Boolean)
    : hasOrganicoConfig
      ? []
      : legacy.organico.allowedSectors;
  next.organico.colaboradores = hasOrganicoConfig
    ? readAccess(organico.colaboradores, buildAccess())
    : legacy.organico.colaboradores;
  next.organico.comentarios = hasOrganicoConfig
    ? readCommentPermissions(organico.comentarios, buildCommentPermissions())
    : legacy.organico.comentarios;
  next.organico.fotos = hasOrganicoConfig
    ? readAccessFromAccessOrCrud(organico.fotos, buildAccess())
    : legacy.organico.fotos;
  next.organico.documentos = hasOrganicoConfig
    ? readDocumentPermissions(organico.documentos, buildDocumentPermissions())
    : legacy.organico.documentos;
  next.organico.justificarAlteracoesSecullum = hasOrganicoConfig
    ? organico.justificarAlteracoesSecullum === true
    : legacy.organico.justificarAlteracoesSecullum;
  next.organico.notificarCadastroComplementarSecullum = hasOrganicoConfig
    ? organico.notificarCadastroComplementarSecullum === true
    : legacy.organico.notificarCadastroComplementarSecullum;
  const rawTabs = organico.formTabs && typeof organico.formTabs === "object" ? (organico.formTabs as Record<string, unknown>) : {};
  for (const tab of ORGANICO_TAB_OPTIONS) {
    next.organico.formTabs[tab.id] = hasOrganicoConfig
      ? readAccess(rawTabs[tab.id], buildAccess())
      : legacy.organico.formTabs[tab.id];
  }

  next.faltas.route = hasFaltasConfig ? readAccess(faltas.route, buildAccess()) : legacy.faltas.route;
  next.faltas.ausencias = hasFaltasConfig ? readCrud(faltas.ausencias, buildCrud()) : legacy.faltas.ausencias;
  next.faltas.sancoes = hasFaltasConfig ? readCrud(faltas.sancoes, buildCrud()) : legacy.faltas.sancoes;
  next.faltas.cadastros = hasFaltasConfig ? readAccess(faltas.cadastros, buildAccess()) : legacy.faltas.cadastros;
  next.faltas.tiposRegras = hasFaltasConfig
    ? Object.prototype.hasOwnProperty.call(faltas, "tiposRegras")
      ? readAccess(faltas.tiposRegras, buildAccess())
      : { ...next.faltas.cadastros }
    : legacy.faltas.tiposRegras;
  next.faltas.regrasAlertas = hasFaltasConfig
    ? Object.prototype.hasOwnProperty.call(faltas, "regrasAlertas")
      ? readAccess(faltas.regrasAlertas, buildAccess())
      : {
          view: hasCrudAccess(next.faltas.ausencias),
          edit:
            next.faltas.ausencias.create || next.faltas.ausencias.edit || next.faltas.ausencias.delete,
        }
    : legacy.faltas.regrasAlertas;

  next.dashboard.route = hasDashboardConfig ? readAccess(dashboard.route, buildAccess()) : legacy.dashboard.route;
  const rawModules = dashboard.modulos && typeof dashboard.modulos === "object" ? (dashboard.modulos as Record<string, unknown>) : {};
  for (const moduleItem of DASHBOARD_MODULE_OPTIONS) {
    next.dashboard.modulos[moduleItem.id] = hasDashboardConfig
      ? readAccess(rawModules[moduleItem.id], buildAccess())
      : legacy.dashboard.modulos[moduleItem.id];
  }

  next.cargos = Object.hasOwn(source, "cargos") ? readAccess(source.cargos, buildAccess()) : legacy.cargos;
  if (Object.hasOwn(source, "organograma")) {
    const organograma =
      source.organograma && typeof source.organograma === "object"
        ? (source.organograma as Record<string, unknown>)
        : {};
    const acessoOrganograma = readAccess(source.organograma, buildAccess());
    next.organograma = {
      ...acessoOrganograma,
      fotos: Object.hasOwn(organograma, "fotos")
        ? readAccess(organograma.fotos, buildAccess())
        : { ...acessoOrganograma },
    };
  } else {
    next.organograma = legacy.organograma;
  }
  next.configuracoes = Object.hasOwn(source, "configuracoes")
    ? readAccess(source.configuracoes, buildAccess())
    : legacy.configuracoes;
  syncCompositeAccess(next);
  next.routes = deriveRoutesFromPermissions(next);
  return next;
}

export function cloneGroupPermissions(input: RhGroupPermissions): RhGroupPermissions {
  return normalizeGroupPermissions(input);
}

export function getRoutePermissions(input: unknown): LegacyRoutePermission[] {
  return normalizeGroupPermissions(input).routes.map(cloneRoutePermission);
}

export function canAccessSector(permissions: RhGroupPermissions, setor: string | null | undefined): boolean {
  const allowed = permissions.organico.allowedSectors;
  if (allowed.length === 0) return true;
  const normalized = String(setor ?? "").trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return false;
  return allowed.some((item) => item.toLocaleLowerCase("pt-BR") === normalized);
}

/** Espelha a lógica de `deriveRoutesFromPermissions` para quando o array `routes` estiver defasado. */
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

export function canViewRoute(permissions: RhGroupPermissions, path: string): boolean {
  const route = permissions.routes.find((entry) => entry.url === path);
  if (route && (route.canView || route.canEdit)) return true;
  return granularPermissionFallback(permissions, path, "view");
}

export function canEditRoute(permissions: RhGroupPermissions, path: string): boolean {
  const route = permissions.routes.find((entry) => entry.url === path);
  if (route?.canEdit) return true;
  return granularPermissionFallback(permissions, path, "edit");
}

export function canViewOrganicoCommentClassification(
  permissions: RhGroupPermissions,
  tagId: string,
  visibility: string,
): boolean {
  if (!hasAccess(permissions.organico.comentarios)) return false;
  const normalizedTagId = normalizeOrganicoCommentTagId(tagId);
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
    permissions.organico.comentarios.visibilities[visibility as OrganicoCommentVisibilityId] === true
  );
}
