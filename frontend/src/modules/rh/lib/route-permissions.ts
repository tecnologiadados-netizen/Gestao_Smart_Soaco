import { getEffectiveGroupPermissions, isMaster, isAuthenticated } from "@rh/lib/auth";
import { allNavItems, CONFIGURACOES_NAV_ITEM } from "@rh/lib/nav-items";
import { rhPath, stripRhPath } from "@rh/lib/rh-paths";
import type { OrganicoDocumentCategoryId, OrganicoDocumentClassificationId } from "@rh/lib/organico-documents";
import {
  ORGANICO_TAB_OPTIONS,
  canAccessSector,
  canViewOrganicoCommentClassification,
  canViewRoute as routeCanView,
  canEditRoute as routeCanEdit,
  type DashboardModuleId,
  type OrganicoTabId,
  type RhGroupPermissions,
} from "@rh/lib/rh-permissions";

function canViewAccess(access: { view: boolean; edit: boolean } | null | undefined): boolean {
  return !!access && (access.view || access.edit);
}

function canEditAccess(access: { edit: boolean } | null | undefined): boolean {
  return !!access && access.edit === true;
}

/** Verifica se o usuário atual pode acessar uma rota protegida (por URL). */
export function hasRoutePermission(path: string): boolean {
  if (!isAuthenticated()) return false;
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  const normalized = stripRhPath(path);
  if (normalized === "/dashboard") {
    return Object.values(permissions.dashboard.modulos).some((item) => item.view || item.edit);
  }
  return routeCanView(permissions, normalized);
}

/**
 * Primeira rota do menu que o usuário pode abrir após login (evita mandar todos para /dashboard).
 */
export function getDefaultPostLoginPath(): string {
  if (!isAuthenticated()) return "/";
  if (isMaster()) return rhPath("/dashboard");
  for (const item of [...allNavItems, CONFIGURACOES_NAV_ITEM]) {
    if (hasRoutePermission(item.url)) return item.url;
  }
  return rhPath("/sem-acesso");
}

export function canEditRoute(path: string): boolean {
  if (!isAuthenticated()) return false;
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  const normalized = stripRhPath(path);
  if (normalized === "/dashboard") {
    return Object.values(permissions.dashboard.modulos).some((item) => item.edit);
  }
  return routeCanEdit(permissions, normalized);
}

export function canAccessOrganicoSector(setor: string | null | undefined): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  return canAccessSector(permissions, setor);
}

/**
 * Abas do formulário do Orgânico (inclui Trajetória): master vê todas; demais seguem `organico.formTabs`.
 * Não confundir com `justificarAlteracoesSecullum` (motivo CTPS/cargo).
 */
export function resolveVisibleOrganicoTabIds(permissions: RhGroupPermissions | null, master: boolean): OrganicoTabId[] {
  if (master) return ORGANICO_TAB_OPTIONS.map((t) => t.id);
  if (!permissions) return [];
  return ORGANICO_TAB_OPTIONS.filter((tab) => canViewAccess(permissions.organico.formTabs[tab.id])).map((t) => t.id);
}

export function resolveEditableOrganicoTabIds(
  permissions: RhGroupPermissions | null,
  master: boolean,
  canEditOrganicoRoute: boolean,
): OrganicoTabId[] {
  if (master) return ORGANICO_TAB_OPTIONS.map((t) => t.id);
  if (!canEditOrganicoRoute || !permissions) return [];
  return ORGANICO_TAB_OPTIONS.filter((tab) => canEditAccess(permissions.organico.formTabs[tab.id])).map((t) => t.id);
}

export function canViewOrganicoTab(tabId: OrganicoTabId): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  const tab = permissions.organico.formTabs[tabId];
  return canViewAccess(tab);
}

export function canEditOrganicoTab(tabId: OrganicoTabId): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  return canEditAccess(permissions.organico.formTabs[tabId]);
}

export function canViewOrganicoComments(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return canViewAccess(permissions?.organico.comentarios);
}

export function canCreateOrganicoComments(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return canEditAccess(permissions?.organico.comentarios);
}

export function canDeleteOrganicoComments(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return canEditAccess(permissions?.organico.comentarios);
}

export function canViewOrganicoCommentTag(tagId: string, visibility: string): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  return canViewOrganicoCommentClassification(permissions, tagId, visibility);
}

export function canViewOrganicoPhotos(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return canViewAccess(permissions?.organico.fotos);
}

export function canEditOrganicoPhotos(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return canEditAccess(permissions?.organico.fotos);
}

export function canDeleteOrganicoPhotos(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return canEditAccess(permissions?.organico.fotos);
}

export function canViewOrganogramaFotos(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return canViewAccess(permissions?.organograma.fotos);
}

export function canEditOrganogramaFotos(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return canEditAccess(permissions?.organograma.fotos);
}

export function canViewOrganicoDocuments(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  const p = permissions?.organico.documentos;
  return !!p && (p.view || p.create || p.edit || p.delete || p.download || p.audit);
}

export function canUploadOrganicoDocuments(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return permissions?.organico.documentos.create === true;
}

export function canEditOrganicoDocuments(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return permissions?.organico.documentos.edit === true;
}

export function canDownloadOrganicoDocuments(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return permissions?.organico.documentos.download === true;
}

export function canDeleteOrganicoDocuments(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return permissions?.organico.documentos.delete === true;
}

export function canHideOrganicoGlobalFolderForOne(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  const docs = permissions?.organico.documentos;
  return !!docs && docs.delete === true && docs.deleteGlobalForOne === true;
}

export function canDeleteOrganicoGlobalFolderForAll(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  const docs = permissions?.organico.documentos;
  return !!docs && docs.delete === true && docs.deleteGlobalForAll === true;
}

export function canAuditOrganicoDocuments(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return permissions?.organico.documentos.audit === true;
}

export function canViewOrganicoDocumentCategory(categoryId: OrganicoDocumentCategoryId): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  const documents = permissions?.organico.documentos;
  return !!documents && canViewOrganicoDocuments() && documents.categories[categoryId] === true;
}

export function canViewOrganicoDocumentClassification(classificationId: OrganicoDocumentClassificationId): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  const documents = permissions?.organico.documentos;
  return !!documents && canViewOrganicoDocuments() && documents.classifications[classificationId] === true;
}

/** Master sempre; demais conforme flag do grupo (justificativa CTPS/cargo Secullum). */
export function canJustificarAlteracoesSecullum(): boolean {
  if (!isAuthenticated()) return false;
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  return permissions?.organico.justificarAlteracoesSecullum === true;
}

/**
 * Toast quando a Secullum cria linha nova (cadastro complementar). Master sempre;
 * demais precisam da flag do grupo e acesso à rota Orgânico.
 */
export function canNotificarCadastroComplementarSecullum(): boolean {
  if (!isAuthenticated()) return false;
  if (isMaster()) return true;
  if (!hasRoutePermission(rhPath("/organico"))) return false;
  const permissions = getEffectiveGroupPermissions();
  return permissions?.organico.notificarCadastroComplementarSecullum === true;
}

export function canViewDashboardModule(moduleId: DashboardModuleId): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  const modulePermission = permissions.dashboard.modulos[moduleId];
  return canViewAccess(modulePermission);
}

export function canEditDashboardModule(moduleId: DashboardModuleId): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  return canEditAccess(permissions.dashboard.modulos[moduleId]);
}

export function canViewFaltasTab(tab: "ausencias" | "regras-alertas" | "sancoes" | "cadastros"): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  if (tab === "ausencias") {
    const p = permissions.faltas.ausencias;
    return p.view || p.create || p.edit || p.delete;
  }
  if (tab === "regras-alertas") {
    const p = permissions.faltas.regrasAlertas;
    return p.view || p.edit;
  }
  if (tab === "sancoes") {
    const p = permissions.faltas.sancoes;
    return p.view || p.create || p.edit || p.delete;
  }
  return permissions.faltas.cadastros.view || permissions.faltas.cadastros.edit;
}

export function canEditFaltasAusencias(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  const p = permissions.faltas.ausencias;
  return p.create || p.edit || p.delete;
}

export function canEditFaltasSancoes(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  const p = permissions.faltas.sancoes;
  return p.create || p.edit || p.delete;
}

export function canEditFaltasCadastros(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  return permissions.faltas.cadastros.edit;
}

export function canViewFaltasTiposRegras(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  const p = permissions.faltas.tiposRegras;
  return p.view || p.edit;
}

export function canEditFaltasTiposRegras(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  return permissions.faltas.tiposRegras.edit;
}

export function canViewFaltasRegrasAlertas(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  const p = permissions.faltas.regrasAlertas;
  return p.view || p.edit;
}

export function canEditFaltasRegrasAlertas(): boolean {
  if (isMaster()) return true;
  const permissions = getEffectiveGroupPermissions();
  if (!permissions) return false;
  return permissions.faltas.regrasAlertas.edit;
}
