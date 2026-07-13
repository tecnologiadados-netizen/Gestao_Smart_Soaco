import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import AppLayout from "@rh/components/AppLayout";
import { Button } from "@rh/components/ui/button";
import { Input } from "@rh/components/ui/input";
import { Label } from "@rh/components/ui/label";
import { Textarea } from "@rh/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@rh/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@rh/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rh/components/ui/select";
import { useToast } from "@rh/hooks/use-toast";
import {
  buildDefaultGroupPermissionsConfig,
  createUser,
  createUserGroup,
  deleteUser,
  deleteUserGroup,
  getSystemUsers,
  getUserGroups,
  type SystemUser,
  type UserGroup,
  updateUser,
  updateUserGroup,
} from "@rh/lib/config";
import { useLogo } from "@rh/hooks/useLogo";
import {
  downloadRhFullBackupFile,
  getConfig,
  getOrganico,
  importOrganicoTrajetoria,
  importRhFullBackupPayload,
  isApiConfigured,
  parseOrganicoTrajetoriaPdfUpload,
  rhUserGroupsCreate,
  rhUserGroupsDelete,
  rhUserGroupsList,
  rhUserGroupsUpdate,
  rhUsersCreate,
  rhUsersDelete,
  rhUsersList,
  rhUsersUpdate,
  setConfig,
  type OrganicoTrajetoriaImportResult,
  type RhAppUserGroupPublic,
  type RhAppUserPublic,
} from "@rh/lib/api-client";
import { getRhSessionToken, isMaster } from "@rh/lib/auth";
import { canEditRoute } from "@rh/lib/route-permissions";
import { ConfiguracoesPermissionsEditor } from "@rh/pages/ConfiguracoesPermissionsEditor";
import { cloneGroupPermissions, ORGANICO_TAB_OPTIONS, DASHBOARD_MODULE_OPTIONS, type RhGroupPermissions } from "@rh/lib/rh-permissions";
import {
  buildDocumentCategoryAccess,
  buildDocumentClassificationAccess,
  ORGANICO_DOCUMENT_CATEGORY_OPTIONS,
  ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS,
} from "@rh/lib/organico-documents";
import {
  buildNextOrganicoCommentTagId,
  DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS,
  ORGANICO_COMMENT_TAGS_CONFIG_KEY,
  ORGANICO_COMMENT_TONE_OPTIONS,
  getOrganicoCommentTagLabel,
  getOrganicoCommentVisibilityLabel,
  parseOrganicoCommentTagCatalog,
  stringifyOrganicoCommentTagCatalog,
  type OrganicoCommentTagOption,
} from "@rh/lib/organico-comment-tags";
import { parseOrganicoTrajetoriaSpreadsheet } from "@rh/lib/organico-trajetoria-pdf";
import { Database, Download, History, Image, Loader2, Pencil, Plus, Shield, Trash2, Upload, UserPlus, Users } from "lucide-react";

function rowToSystemUser(row: RhAppUserPublic): SystemUser {
  return {
    id: row.id,
    username: row.username,
    groupId: row.groupId,
    createdAt: row.createdAt,
    passwordHash: "",
  };
}

function rowToUserGroup(row: RhAppUserGroupPublic): UserGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: cloneGroupPermissions(row.permissions),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToUserGroupWithPermissions(row: RhAppUserGroupPublic, permissions: RhGroupPermissions): UserGroup {
  return {
    ...rowToUserGroup(row),
    permissions: cloneGroupPermissions(permissions),
  };
}

function upsertGroup(groups: UserGroup[], nextGroup: UserGroup): UserGroup[] {
  const existingIndex = groups.findIndex((group) => group.id === nextGroup.id);
  const nextGroups = existingIndex >= 0 ? [...groups] : [...groups, nextGroup];
  if (existingIndex >= 0) {
    nextGroups[existingIndex] = nextGroup;
  }
  return nextGroups.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function countActivePermissions(permissions: RhGroupPermissions): number {
  return permissions.routes.filter((entry) => entry.canView || entry.canEdit).length;
}

function listAccessLabels(access: { view: boolean; edit: boolean }, editLabel = "Editar"): string[] {
  const labels: string[] = [];
  if (access.view) labels.push("Visualizar");
  if (access.edit) labels.push(editLabel);
  return labels;
}

function listCrudLabels(access: { view: boolean; create: boolean; edit: boolean; delete: boolean }): string[] {
  const labels: string[] = [];
  if (access.view) labels.push("Visualizar");
  if (access.create) labels.push("Inserir");
  if (access.edit) labels.push("Editar");
  if (access.delete) labels.push("Excluir");
  return labels;
}

function listDocumentLabels(access: {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  download: boolean;
  audit: boolean;
}): string[] {
  const labels = listCrudLabels(access);
  if (access.download) labels.push("Baixar");
  if (access.audit) labels.push("Auditar");
  return labels;
}

function buildGroupPermissionPreview(permissions: RhGroupPermissions, commentTagOptions: OrganicoCommentTagOption[]): string[] {
  const normalized = cloneGroupPermissions(permissions);
  const lines: string[] = [];

  const addLine = (label: string, actions: string[]) => {
    if (actions.length > 0) {
      lines.push(`${label}: ${actions.join(", ")}`);
    }
  };

  addLine("Orgânico > Colaboradores", listAccessLabels(normalized.organico.colaboradores));
  addLine("Orgânico > Comentários", listAccessLabels(normalized.organico.comentarios));
  addLine("Orgânico > Fotos", listAccessLabels(normalized.organico.fotos));
  addLine("Orgânico > Documentos confidenciais", listDocumentLabels(normalized.organico.documentos));
  if (normalized.organico.justificarAlteracoesSecullum) {
    lines.push("Orgânico > Justificar alterações Secullum (CTPS/cargo): Sim");
  }
  if (normalized.organico.notificarCadastroComplementarSecullum) {
    lines.push("Orgânico > Notificar cadastro complementar (novos Secullum): Sim");
  }
  if (normalized.organico.comentarios.view || normalized.organico.comentarios.edit) {
    const visibleCommentTags = Object.entries(normalized.organico.comentarios.tags)
      .filter(([, allowed]) => allowed)
      .map(([tagId]) => getOrganicoCommentTagLabel(tagId, commentTagOptions))
      .slice(0, 6);
    const visibleCommentVisibilities = Object.entries(normalized.organico.comentarios.visibilities)
      .filter(([, allowed]) => allowed)
      .map(([visibility]) => getOrganicoCommentVisibilityLabel(visibility));
    if (visibleCommentTags.length > 0) {
      lines.push(`Orgânico > Tags visíveis: ${visibleCommentTags.join(", ")}${visibleCommentTags.length >= 6 ? "..." : ""}`);
    }
    if (visibleCommentVisibilities.length > 0) {
      lines.push(`Orgânico > Visibilidades visíveis: ${visibleCommentVisibilities.join(", ")}`);
    }
  }
  if (
    normalized.organico.documentos.view ||
    normalized.organico.documentos.create ||
    normalized.organico.documentos.edit ||
    normalized.organico.documentos.delete ||
    normalized.organico.documentos.download ||
    normalized.organico.documentos.audit
  ) {
    const documentClassifications = ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS
      .filter((item) => normalized.organico.documentos.classifications[item.id])
      .map((item) => item.label);
    const documentCategories = ORGANICO_DOCUMENT_CATEGORY_OPTIONS
      .filter((item) => normalized.organico.documentos.categories[item.id])
      .map((item) => item.label)
      .slice(0, 6);
    if (documentClassifications.length > 0) {
      lines.push(`Orgânico > Sigilos de documentos: ${documentClassifications.join(", ")}`);
    }
    if (documentCategories.length > 0) {
      lines.push(`Orgânico > Categorias de documentos: ${documentCategories.join(", ")}${documentCategories.length >= 6 ? "..." : ""}`);
    }
  }

  const enabledTabs = ORGANICO_TAB_OPTIONS.filter((tab) => {
    const access = normalized.organico.formTabs[tab.id];
    return access.view || access.edit;
  }).map((tab) => tab.label);
  const disabledTabs = ORGANICO_TAB_OPTIONS.filter((tab) => {
    const access = normalized.organico.formTabs[tab.id];
    return !access.view && !access.edit;
  }).map((tab) => tab.label);
  if (enabledTabs.length > 0) {
    lines.push(`Orgânico > Abas liberadas: ${enabledTabs.join(", ")}`);
  }
  if (disabledTabs.length > 0) {
    lines.push(`Orgânico > Abas sem acesso: ${disabledTabs.join(", ")}`);
  }

  addLine("Faltas > Ausências", listCrudLabels(normalized.faltas.ausencias));
  addLine("Faltas > Sanções", listCrudLabels(normalized.faltas.sancoes));
  addLine("Faltas > Cadastros", listAccessLabels(normalized.faltas.cadastros));
  addLine("Faltas > Regras dos tipos de ausência", listAccessLabels(normalized.faltas.tiposRegras));
  addLine("Faltas > Regras de alertas", listAccessLabels(normalized.faltas.regrasAlertas));

  for (const moduleItem of DASHBOARD_MODULE_OPTIONS) {
    addLine(`Dashboard > ${moduleItem.label}`, listAccessLabels(normalized.dashboard.modulos[moduleItem.id]));
  }

  addLine("Cargos e Salários", listAccessLabels(normalized.cargos));
  addLine("Organograma", listAccessLabels(normalized.organograma));
  addLine("Configurações", listAccessLabels(normalized.configuracoes));

  return lines.length > 0 ? lines : ["Nenhuma permissão ativa neste grupo."];
}

function normalizeGroupPermissionsBeforeSave(
  permissions: RhGroupPermissions,
  availableSectors: string[],
): RhGroupPermissions {
  const next = JSON.parse(JSON.stringify(permissions)) as RhGroupPermissions;
  if (!next.faltas) {
    next.faltas = {
      route: { view: false, edit: false },
      ausencias: { view: false, create: false, edit: false, delete: false },
      sancoes: { view: false, create: false, edit: false, delete: false },
      cadastros: { view: false, edit: false },
      tiposRegras: { view: false, edit: false },
      regrasAlertas: { view: false, edit: false },
    };
  }
  if (!next.faltas.tiposRegras) {
    next.faltas.tiposRegras = { view: false, edit: false };
  }
  if (!next.faltas.regrasAlertas) {
    next.faltas.regrasAlertas = { view: false, edit: false };
  }
  if (!next.organico.documentos) {
    next.organico.documentos = {
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
  next.faltas.tiposRegras.view = permissions.faltas.tiposRegras.view === true;
  next.faltas.tiposRegras.edit = permissions.faltas.tiposRegras.edit === true;
  next.faltas.regrasAlertas.view = permissions.faltas.regrasAlertas.view === true;
  next.faltas.regrasAlertas.edit = permissions.faltas.regrasAlertas.edit === true;
  const normalizedSectors = [...new Set(availableSectors.map((item) => item.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  if (normalizedSectors.length === 0) return next;
  const selected = [...new Set(next.organico.allowedSectors.map((item) => item.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const selectedAllKnownSectors =
    selected.length >= normalizedSectors.length && normalizedSectors.every((sector) => selected.includes(sector));
  if (selectedAllKnownSectors) {
    next.organico.allowedSectors = [];
  }
  return next;
}

const Configuracoes = () => {
  const { toast } = useToast();
  const { logo, setLogo } = useLogo();
  const canEditConfig = canEditRoute("/configuracoes");

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formGroupId, setFormGroupId] = useState("");

  const [groupFormName, setGroupFormName] = useState("");
  const [groupFormDescription, setGroupFormDescription] = useState("");
  const [groupFormPermissions, setGroupFormPermissions] = useState<RhGroupPermissions>(() => buildDefaultGroupPermissionsConfig());
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [commentTagOptions, setCommentTagOptions] = useState<OrganicoCommentTagOption[]>(DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS);
  const [commentTagsLoading, setCommentTagsLoading] = useState(false);
  const [commentTagsSaving, setCommentTagsSaving] = useState(false);

  const [backupDownloading, setBackupDownloading] = useState(false);
  const [backupRestoring, setBackupRestoring] = useState(false);
  const restoreBackupInputRef = useRef<HTMLInputElement>(null);
  const trajetoriaImportInputRef = useRef<HTMLInputElement>(null);
  const [trajetoriaImporting, setTrajetoriaImporting] = useState(false);
  const [trajetoriaImportSummary, setTrajetoriaImportSummary] = useState<{
    files: string[];
    parsedRows: number;
    parsedRowsPdf: number;
    parsedRowsSpreadsheet: number;
    colaboradoresDetectados: number;
    colaboradoresVinculados: number;
    colaboradoresSemMatricula: string[];
    result: OrganicoTrajetoriaImportResult;
    warnings: string[];
  } | null>(null);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const selectedUserGroup = useMemo(() => groupMap.get(formGroupId) ?? null, [groupMap, formGroupId]);
  const selectedUserGroupPreview = useMemo(
    () => (selectedUserGroup ? buildGroupPermissionPreview(selectedUserGroup.permissions, commentTagOptions) : []),
    [commentTagOptions, selectedUserGroup],
  );
  const groupUserCount = useMemo(() => {
    const counters = new Map<string, number>();
    for (const user of users) {
      counters.set(user.groupId, (counters.get(user.groupId) ?? 0) + 1);
    }
    return counters;
  }, [users]);

  const refreshGroups = useCallback(async () => {
    if (!isApiConfigured()) {
      setGroups(getUserGroups());
      return;
    }
    const token = getRhSessionToken();
    if (!token) {
      setGroups([]);
      return;
    }
    setGroupsLoading(true);
    try {
      const rows = await rhUserGroupsList(token);
      setGroups(rows.map(rowToUserGroup));
    } catch (error) {
      toast({
        title: "Erro ao carregar grupos",
        description: error instanceof Error ? error.message : "Verifique a sessão e a API.",
        variant: "destructive",
      });
    } finally {
      setGroupsLoading(false);
    }
  }, [toast]);

  const refreshUsers = useCallback(async () => {
    if (!isApiConfigured()) {
      setUsers(getSystemUsers());
      return;
    }
    const token = getRhSessionToken();
    if (!token) {
      setUsers([]);
      return;
    }
    setUsersLoading(true);
    try {
      const rows = await rhUsersList(token);
      setUsers(rows.map(rowToSystemUser));
    } catch (error) {
      toast({
        title: "Erro ao carregar usuários",
        description: error instanceof Error ? error.message : "Verifique a sessão e a API.",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  const refreshSecurityData = useCallback(async () => {
    await Promise.all([refreshGroups(), refreshUsers()]);
  }, [refreshGroups, refreshUsers]);

  const refreshCommentTagCatalog = useCallback(async () => {
    setCommentTagsLoading(true);
    try {
      const response = await getConfig(ORGANICO_COMMENT_TAGS_CONFIG_KEY);
      setCommentTagOptions(parseOrganicoCommentTagCatalog(response.value));
    } catch (error) {
      setCommentTagOptions(DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS);
      toast({
        title: "Erro ao carregar tags",
        description: error instanceof Error ? error.message : "Não foi possível carregar o catálogo de tags.",
        variant: "destructive",
      });
    } finally {
      setCommentTagsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refreshSecurityData();
  }, [refreshSecurityData]);

  useEffect(() => {
    void refreshCommentTagCatalog();
  }, [refreshCommentTagCatalog]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const rows = await getOrganico();
        const sectors = Array.from(
          new Set(
            (rows ?? [])
              .map((row) => (Array.isArray(row.values) ? String(row.values[14] ?? "").trim() : ""))
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b, "pt-BR"));
        if (active) setAvailableSectors(sectors);
      } catch {
        if (active) setAvailableSectors([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/png")) {
      toast({ title: "Formato inválido", description: "Selecione um arquivo PNG.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        await setLogo(base64);
        toast({ title: "Logo salva", description: "A logo foi salva no banco e será exibida em todo o sistema." });
      } catch {
        toast({ title: "Erro ao salvar", description: "Não foi possível salvar a logo.", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveLogo = async () => {
    try {
      await setLogo(null);
      toast({ title: "Logo removida", description: "O símbolo padrão será exibido." });
    } catch {
      toast({ title: "Erro ao remover", description: "Não foi possível remover a logo.", variant: "destructive" });
    }
  };

  const openNewUserModal = () => {
    if (!canEditConfig) return;
    setEditingUser(null);
    setFormUsername("");
    setFormPassword("");
    setFormGroupId(groups[0]?.id ?? "");
    setUserModalOpen(true);
  };

  const openEditUserModal = (user: SystemUser) => {
    if (!canEditConfig) return;
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword("");
    setFormGroupId(user.groupId);
    setUserModalOpen(true);
  };

  const openNewGroupModal = () => {
    if (!canEditConfig) return;
    setEditingGroup(null);
    setGroupFormName("");
    setGroupFormDescription("");
    setGroupFormPermissions(buildDefaultGroupPermissionsConfig());
    setGroupModalOpen(true);
  };

  const openEditGroupModal = (group: UserGroup) => {
    if (!canEditConfig) return;
    setEditingGroup(group);
    setGroupFormName(group.name);
    setGroupFormDescription(group.description);
    setGroupFormPermissions(cloneGroupPermissions(group.permissions));
    setGroupModalOpen(true);
  };

  const handleAddCommentTagOption = () => {
    if (!canEditConfig) return;
    setCommentTagOptions((current) => [
      ...current,
      {
        id: buildNextOrganicoCommentTagId(current),
        label: "",
        tone: "neutral",
      },
    ]);
  };

  const handleUpdateCommentTagOption = (index: number, patch: Partial<OrganicoCommentTagOption>) => {
    if (!canEditConfig) return;
    setCommentTagOptions((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch, id: item.id } : item)),
    );
  };

  const handleDeleteCommentTagOption = (index: number) => {
    if (!canEditConfig) return;
    setCommentTagOptions((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSaveCommentTagCatalog = async () => {
    if (!canEditConfig) return;
    const hasEmptyFields = commentTagOptions.some((item) => !item.label.trim());
    if (hasEmptyFields) {
      toast({
        title: "Dados incompletos",
        description: "Preencha código e rótulo de todas as tags antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    setCommentTagsSaving(true);
    try {
      await setConfig(ORGANICO_COMMENT_TAGS_CONFIG_KEY, stringifyOrganicoCommentTagCatalog(commentTagOptions));
      await refreshCommentTagCatalog();
      toast({
        title: "Tags atualizadas",
        description: "O catálogo foi salvo e já passa a valer para permissões e novos comentários.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar tags",
        description: error instanceof Error ? error.message : "Não foi possível salvar o catálogo.",
        variant: "destructive",
      });
    } finally {
      setCommentTagsSaving(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!canEditConfig) return;
    if (editingGroup) {
      if (isApiConfigured()) {
        const token = getRhSessionToken();
        if (!token) {
          toast({ title: "Sessão inválida", description: "Entre novamente para continuar.", variant: "destructive" });
          return;
        }
        try {
          const submittedPermissions = normalizeGroupPermissionsBeforeSave(groupFormPermissions, availableSectors);
          const savedGroup = await rhUserGroupsUpdate(token, {
            id: editingGroup.id,
            name: groupFormName.trim(),
            description: groupFormDescription.trim(),
            permissions: submittedPermissions,
          });
          setGroups((current) => upsertGroup(current, rowToUserGroupWithPermissions(savedGroup, submittedPermissions)));
          toast({
            title: "Grupo atualizado",
            description: "Permissões e dados do grupo foram gravados. Usuários já logados neste grupo devem entrar novamente para recarregar o perfil.",
          });
          setGroupModalOpen(false);
          void refreshUsers();
        } catch (error) {
          toast({
            title: "Erro ao atualizar grupo",
            description: error instanceof Error ? error.message : "Falha na API.",
            variant: "destructive",
          });
        }
        return;
      }
      const result = updateUserGroup(editingGroup.id, {
        name: groupFormName,
        description: groupFormDescription,
        permissions: normalizeGroupPermissionsBeforeSave(groupFormPermissions, availableSectors),
      });
      if (result.ok) {
        toast({
          title: "Grupo atualizado",
          description: "As alterações foram salvas. Usuários deste grupo precisam entrar novamente para recarregar o perfil local.",
        });
        setGroupModalOpen(false);
        void refreshSecurityData();
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
      return;
    }

    if (isApiConfigured()) {
      const token = getRhSessionToken();
      if (!token) {
        toast({ title: "Sessão inválida", description: "Entre novamente para continuar.", variant: "destructive" });
        return;
      }
      try {
        const submittedPermissions = normalizeGroupPermissionsBeforeSave(groupFormPermissions, availableSectors);
        const savedGroup = await rhUserGroupsCreate(token, {
          name: groupFormName.trim(),
          description: groupFormDescription.trim(),
          permissions: submittedPermissions,
        });
        setGroups((current) => upsertGroup(current, rowToUserGroupWithPermissions(savedGroup, submittedPermissions)));
        toast({ title: "Grupo criado", description: "Grupo salvo no banco com suas permissões." });
        setGroupModalOpen(false);
        void refreshUsers();
      } catch (error) {
        toast({
          title: "Erro ao criar grupo",
          description: error instanceof Error ? error.message : "Falha na API.",
          variant: "destructive",
        });
      }
      return;
    }

    const result = createUserGroup({
      name: groupFormName,
      description: groupFormDescription,
      permissions: normalizeGroupPermissionsBeforeSave(groupFormPermissions, availableSectors),
    });
    if (result.ok) {
      toast({ title: "Grupo criado", description: "Grupo salvo neste navegador." });
      setGroupModalOpen(false);
      void refreshSecurityData();
    } else {
      toast({ title: "Erro", description: result.error, variant: "destructive" });
    }
  };

  const handleSaveUser = async () => {
    if (!canEditConfig) return;
    if (editingUser) {
      if (isApiConfigured()) {
        const token = getRhSessionToken();
        if (!token) {
          toast({ title: "Sessão inválida", description: "Entre novamente para continuar.", variant: "destructive" });
          return;
        }
        try {
          await rhUsersUpdate(token, {
            id: editingUser.id,
            password: formPassword.trim() || undefined,
            groupId: formGroupId,
          });
          toast({
            title: "Usuário atualizado",
            description: "Grupo e senha foram gravados. Se este usuário já estiver logado, precisa entrar novamente para recarregar as permissões.",
          });
          setUserModalOpen(false);
          void refreshUsers();
        } catch (error) {
          toast({
            title: "Erro ao atualizar",
            description: error instanceof Error ? error.message : "Falha na API.",
            variant: "destructive",
          });
        }
        return;
      }
      const result = updateUser(editingUser.id, {
        username: formUsername,
        password: formPassword || undefined,
        groupId: formGroupId,
      });
      if (result.ok) {
        toast({
          title: "Usuário atualizado",
          description: "As alterações foram salvas. Se este usuário já estiver logado neste navegador, precisa entrar novamente para recarregar as permissões.",
        });
        setUserModalOpen(false);
        void refreshUsers();
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
      return;
    }

    if (isApiConfigured()) {
      const token = getRhSessionToken();
      if (!token) {
        toast({ title: "Sessão inválida", description: "Entre novamente para continuar.", variant: "destructive" });
        return;
      }
      try {
        await rhUsersCreate(token, {
          username: formUsername.trim().toLowerCase(),
          password: formPassword,
          groupId: formGroupId,
        });
        toast({
          title: "Usuário criado",
          description: "Conta salva no banco e vinculada ao grupo selecionado.",
        });
        setUserModalOpen(false);
        void refreshUsers();
      } catch (error) {
        toast({
          title: "Erro ao criar",
          description: error instanceof Error ? error.message : "Falha na API.",
          variant: "destructive",
        });
      }
      return;
    }

    const result = createUser(formUsername, formPassword, formGroupId);
    if (result.ok) {
      toast({
        title: "Usuário criado",
        description: "Usuário salvo neste navegador e vinculado ao grupo selecionado.",
      });
      setUserModalOpen(false);
      void refreshUsers();
    } else {
      toast({ title: "Erro", description: result.error, variant: "destructive" });
    }
  };

  const handleDeleteGroup = async (group: UserGroup) => {
    if (!window.confirm(`Excluir o grupo "${group.name}"?`)) return;
    if (isApiConfigured()) {
      const token = getRhSessionToken();
      if (!token) {
        toast({ title: "Sessão inválida", variant: "destructive" });
        return;
      }
      try {
        await rhUserGroupsDelete(token, group.id);
        toast({ title: "Grupo excluído", description: "Grupo removido do banco." });
        void refreshSecurityData();
      } catch (error) {
        toast({
          title: "Erro ao excluir grupo",
          description: error instanceof Error ? error.message : "Falha na API.",
          variant: "destructive",
        });
      }
      return;
    }
    const result = deleteUserGroup(group.id);
    if (result.ok) {
      toast({ title: "Grupo excluído", description: "O grupo foi removido." });
      void refreshSecurityData();
    } else {
      toast({ title: "Erro", description: result.error, variant: "destructive" });
    }
  };

  const handleDeleteUser = async (user: SystemUser) => {
    if (!window.confirm(`Excluir o usuário "${user.username}"?`)) return;
    if (isApiConfigured()) {
      const token = getRhSessionToken();
      if (!token) {
        toast({ title: "Sessão inválida", variant: "destructive" });
        return;
      }
      try {
        await rhUsersDelete(token, user.id);
        toast({ title: "Usuário excluído", description: "Removido do banco." });
        void refreshUsers();
      } catch (error) {
        toast({
          title: "Erro ao excluir",
          description: error instanceof Error ? error.message : "Falha na API.",
          variant: "destructive",
        });
      }
      return;
    }
    deleteUser(user.id);
    toast({ title: "Usuário excluído", description: "O usuário não poderá mais acessar o sistema." });
    void refreshUsers();
  };

  const handleDownloadFullBackup = async () => {
    if (!isApiConfigured()) {
      toast({ title: "API não configurada", description: "Defina VITE_API_URL e faça deploy das funções.", variant: "destructive" });
      return;
    }
    setBackupDownloading(true);
    try {
      await downloadRhFullBackupFile();
      toast({
        title: "Backup gerado",
        description: "O arquivo JSON foi baixado. Guarde-o em local seguro.",
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar backup",
        description: error instanceof Error ? error.message : "Falha na API.",
        variant: "destructive",
      });
    } finally {
      setBackupDownloading(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast({ title: "Arquivo inválido", description: "Selecione um backup .json gerado pelo sistema.", variant: "destructive" });
      return;
    }
    if (
      !window.confirm(
        "Restaurar este backup substitui todos os dados do sistema no banco (grupos, usuários, faltas, orgânico, comentários, etc.). Continuar?",
      )
    ) {
      return;
    }
    setBackupRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const res = await importRhFullBackupPayload(payload);
      toast({
        title: "Restauração concluída",
        description: `Dados regravados no banco (${res.totalRows ?? 0} linha(s)). Se alterou usuários, pode ser necessário entrar de novo.`,
      });
      void refreshSecurityData();
    } catch (error) {
      toast({
        title: "Erro ao restaurar",
        description: error instanceof Error ? error.message : "JSON inválido ou falha na API.",
        variant: "destructive",
      });
    } finally {
      setBackupRestoring(false);
    }
  };

  const handleTrajetoriaImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (!canEditConfig) return;
    if (!isApiConfigured()) {
      toast({
        title: "API não configurada",
        description: "Defina VITE_API_URL para importar e persistir a trajetória no banco.",
        variant: "destructive",
      });
      return;
    }

    const invalid = files.find((file) => {
      const lower = file.name.toLowerCase();
      return !lower.endsWith(".pdf") && !lower.endsWith(".xlsx") && !lower.endsWith(".xls");
    });
    if (invalid) {
      toast({
        title: "Arquivo inválido",
        description: `O arquivo ${invalid.name} não é um PDF ou planilha válida para importação.`,
        variant: "destructive",
      });
      return;
    }

    setTrajetoriaImporting(true);
    try {
      const parsedResults = await Promise.all(
        files.map((file) => {
          const lower = file.name.toLowerCase();
          return lower.endsWith(".pdf") ? parseOrganicoTrajetoriaPdfUpload(file) : parseOrganicoTrajetoriaSpreadsheet(file);
        }),
      );
      const rows = parsedResults.flatMap((result) => result.rows);
      const warnings = parsedResults.flatMap((result) => result.warnings);
      const colaboradoresSemMatricula = Array.from(
        new Set(parsedResults.flatMap((result) => result.colaboradoresSemMatricula)),
      );
      const colaboradoresDetectados = parsedResults.reduce((acc, result) => acc + result.colaboradoresDetectados, 0);
      const colaboradoresVinculados = new Set(
        rows.map((row) => row.matricula.trim() || row.colaboradorNome.trim()).filter(Boolean),
      ).size;
      const parsedRowsPdf = parsedResults
        .filter((result) => result.source === "pdf")
        .reduce((acc, result) => acc + result.rows.length, 0);
      const parsedRowsSpreadsheet = parsedResults
        .filter((result) => result.source === "spreadsheet")
        .reduce((acc, result) => acc + result.rows.length, 0);

      if (rows.length === 0) {
        throw new Error("Nenhuma alteração de salário, cargo ou função foi identificada nos arquivos enviados.");
      }

      const result = await importOrganicoTrajetoria(rows);
      setTrajetoriaImportSummary({
        files: files.map((file) => file.name),
        parsedRows: rows.length,
        parsedRowsPdf,
        parsedRowsSpreadsheet,
        colaboradoresDetectados,
        colaboradoresVinculados,
        colaboradoresSemMatricula,
        result,
        warnings,
      });
      toast({
        title: "Trajetória importada",
        description: `${result.inserted} movimentação(ões) novas gravadas para ${result.affectedMatriculas} colaborador(es).`,
      });
    } catch (error) {
      toast({
        title: "Erro ao importar trajetória",
        description: error instanceof Error ? error.message : "Não foi possível processar os arquivos enviados.",
        variant: "destructive",
      });
    } finally {
      setTrajetoriaImporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 flex flex-col min-h-[calc(100vh-4rem)] bg-background">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        </div>

        <div className="grid w-full gap-6">
          {isMaster() && isApiConfigured() && (
            <Card className="border-amber-500/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Backup completo do banco (master)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Gera ou restaura um arquivo JSON com os dados do schema <code className="text-[10px]">rh</code> (grupos,
                  usuários com hash de senha, faltas, orgânico, comentários, cadastros, pontualidade, etc.). A restauração{" "}
                  <strong>apaga e recria</strong> esses dados no servidor. Para cópia física do Postgres (pg_dump), use os
                  scripts em <code className="text-[10px]">scripts/backup-db-full.ps1</code>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" disabled={backupDownloading || backupRestoring} onClick={() => void handleDownloadFullBackup()}>
                    {backupDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    Baixar backup (.json)
                  </Button>
                  <input
                    ref={restoreBackupInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    disabled={backupDownloading || backupRestoring}
                    onChange={(ev) => void handleRestoreFile(ev)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={backupDownloading || backupRestoring}
                    onClick={() => restoreBackupInputRef.current?.click()}
                  >
                    {backupRestoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Restaurar backup (.json)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Importação em massa da trajetória
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground border border-border/70 bg-muted/25 rounded-sm p-3 leading-relaxed">
                Envie um ou mais <strong>PDFs</strong> da ficha do empregado ou, de preferência, a
                <strong> planilha consolidada (.xlsx/.xls)</strong> com o histórico já extraído. Para cada colaborador
                presente no lote, a importação <strong>substitui a trajetória anterior</strong> pelas movimentações
                identificadas no novo arquivo e alimenta a aba <strong>Trajetória</strong>. Os PDFs são processados no
                backend para aproximar o resultado do consolidado gerado a partir do script.
              </p>

              <input
                ref={trajetoriaImportInputRef}
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel,.xls"
                multiple
                className="hidden"
                disabled={!canEditConfig || trajetoriaImporting}
                onChange={(event) => void handleTrajetoriaImport(event)}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => trajetoriaImportInputRef.current?.click()}
                  disabled={!canEditConfig || trajetoriaImporting}
                >
                  {trajetoriaImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Importar arquivos da trajetória
                </Button>
              </div>

              {trajetoriaImportSummary ? (
                <div className="rounded-lg border border-border/80 bg-background/70 p-4 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Arquivos</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.files.length}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Colaboradores detectados</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.colaboradoresDetectados}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Colaboradores vinculados</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.colaboradoresVinculados}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Linhas extraídas</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.parsedRows}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Linhas do PDF</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.parsedRowsPdf}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Linhas da planilha</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.parsedRowsSpreadsheet}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Movimentações gravadas</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.result.inserted}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Arquivos processados</p>
                    <ul className="space-y-1 text-sm text-foreground/90">
                      {trajetoriaImportSummary.files.map((file) => (
                        <li key={file}>{file}</li>
                      ))}
                    </ul>
                  </div>

                  {trajetoriaImportSummary.warnings.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Avisos do parser</p>
                      <ul className="space-y-1 text-sm text-foreground/80">
                        {trajetoriaImportSummary.warnings.slice(0, 10).map((warning, index) => (
                          <li key={`${warning}-${index}`}>{warning}</li>
                        ))}
                      </ul>
                      {trajetoriaImportSummary.warnings.length > 10 ? (
                        <p className="text-xs text-muted-foreground">
                          {trajetoriaImportSummary.warnings.length - 10} aviso(s) adicional(is) não exibido(s).
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {trajetoriaImportSummary.colaboradoresSemMatricula.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Colaboradores com movimentações sem matrícula identificada
                      </p>
                      <ul className="space-y-1 text-sm text-foreground/80">
                        {trajetoriaImportSummary.colaboradoresSemMatricula.slice(0, 10).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {trajetoriaImportSummary.colaboradoresSemMatricula.length > 10 ? (
                        <p className="text-xs text-muted-foreground">
                          {trajetoriaImportSummary.colaboradoresSemMatricula.length - 10} colaborador(es) adicional(is) não exibido(s).
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {trajetoriaImportSummary.result.skippedRows > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Linhas não vinculadas ao orgânico</p>
                      <p className="text-sm text-foreground/80">
                        {trajetoriaImportSummary.result.skippedRows} linha(s) foram ignoradas por falta de vínculo confiável com o Orgânico.
                      </p>
                      {trajetoriaImportSummary.result.unresolvedCollaborators.length > 0 ? (
                        <ul className="space-y-1 text-sm text-foreground/80">
                          {trajetoriaImportSummary.result.unresolvedCollaborators.slice(0, 10).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                      {trajetoriaImportSummary.result.unresolvedCollaborators.length > 10 ? (
                        <p className="text-xs text-muted-foreground">
                          {trajetoriaImportSummary.result.unresolvedCollaborators.length - 10} colaborador(es) adicional(is) não exibido(s).
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" />
                Logo da empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                  {logo ? (
                    <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Shield className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/png"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload">
                    <Button variant="outline" size="sm" asChild>
                      <span className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Importar PNG
                      </span>
                    </Button>
                  </label>
                  {logo && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveLogo} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover logo
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Catálogo de tags de comentários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground border border-border/70 bg-muted/25 rounded-sm p-3 leading-relaxed">
                Cadastre aqui as categorias usadas no balão de classificação dos comentários do Orgânico. As novas opções
                também aparecem no editor de permissões dos grupos.
              </p>

              <div className="flex justify-end gap-2">
                {canEditConfig ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCommentTagOption}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova tag
                  </Button>
                ) : null}
                {canEditConfig ? (
                  <Button type="button" size="sm" onClick={() => void handleSaveCommentTagCatalog()} disabled={commentTagsSaving}>
                    {commentTagsSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Salvar catálogo
                  </Button>
                ) : null}
              </div>

              <div className="border rounded-lg overflow-hidden">
                {commentTagsLoading ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Carregando tags…</div>
                ) : commentTagOptions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma tag cadastrada.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium">Código</th>
                        <th className="text-left py-3 px-4 font-medium">Rótulo</th>
                        <th className="text-left py-3 px-4 font-medium">Tom</th>
                        <th className="w-20 py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {commentTagOptions.map((tag, index) => (
                        <tr key={`${tag.id}-${index}`} className="border-b last:border-0 align-top">
                          <td className="py-3 px-4">
                            <Input
                              value={tag.id}
                              readOnly
                              disabled
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              value={tag.label}
                              onChange={(event) => handleUpdateCommentTagOption(index, { label: event.target.value })}
                              placeholder="Nome exibido para a tag"
                              disabled={!canEditConfig}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Select
                              value={tag.tone}
                              onValueChange={(value) =>
                                handleUpdateCommentTagOption(index, { tone: value as OrganicoCommentTagOption["tone"] })
                              }
                              disabled={!canEditConfig}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {ORGANICO_COMMENT_TONE_OPTIONS.map((tone) => (
                                  <SelectItem key={tone.id} value={tone.id}>
                                    {tone.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 px-4">
                            {canEditConfig ? (
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCommentTagOption(index)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Grupos de usuários
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isApiConfigured() ? (
                <p className="text-xs text-muted-foreground border border-border/70 bg-muted/25 rounded-sm p-3 mb-4 leading-relaxed">
                  Os grupos ficam na tabela <code className="text-[10px]">rh.app_user_groups</code>. Cada grupo concentra
                  as permissões de acesso e edição por área do sistema.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground border border-border/70 bg-muted/25 rounded-sm p-3 mb-4 leading-relaxed">
                  Sem <code className="text-[10px]">VITE_API_URL</code>, os grupos ficam apenas neste navegador. Com a API
                  configurada, eles serão gravados no banco e compartilhados entre máquinas.
                </p>
              )}
              <div className="flex justify-end mb-4">
                {canEditConfig ? (
                  <Button size="sm" onClick={openNewGroupModal}>
                    <Users className="w-4 h-4 mr-2" />
                    Novo grupo
                  </Button>
                ) : null}
              </div>
              <div className="border rounded-lg overflow-hidden">
                {groupsLoading ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Carregando grupos…</div>
                ) : groups.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Nenhum grupo cadastrado.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium">Grupo</th>
                        <th className="text-left py-3 px-4 font-medium">Descrição</th>
                        <th className="text-left py-3 px-4 font-medium">Permissões</th>
                        <th className="text-left py-3 px-4 font-medium">Usuários</th>
                        <th className="w-24 py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => (
                        <tr key={group.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium">{group.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {group.description.trim() || "Sem descrição"}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {countActivePermissions(group.permissions)} permissão(ões)
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {groupUserCount.get(group.id) ?? 0} usuário(s)
                          </td>
                          <td className="py-3 px-4">
                            {canEditConfig ? (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditGroupModal(group)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => void handleDeleteGroup(group)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Gerenciador de usuários
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isApiConfigured() ? (
                <p className="text-xs text-muted-foreground border border-border/70 bg-muted/25 rounded-sm p-3 mb-4 leading-relaxed">
                  Usuários ficam na tabela <code className="text-[10px]">rh.app_users</code> e são vinculados a um grupo
                  salvo em <code className="text-[10px]">rh.app_user_groups</code>. As telas e permissões agora são herdadas
                  do grupo.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground border border-border/70 bg-muted/25 rounded-sm p-3 mb-4 leading-relaxed">
                  Sem <code className="text-[10px]">VITE_API_URL</code>, os usuários ficam só neste navegador. Mesmo no modo
                  local, cada usuário passa a herdar permissões do grupo vinculado.
                </p>
              )}
              <div className="flex justify-end mb-4">
                {canEditConfig ? (
                  <Button size="sm" onClick={openNewUserModal} disabled={groups.length === 0}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Novo usuário
                  </Button>
                ) : null}
              </div>
              <div className="border rounded-lg overflow-hidden">
                {usersLoading ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Carregando usuários…</div>
                ) : users.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Nenhum usuário cadastrado.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium">Usuário</th>
                        <th className="text-left py-3 px-4 font-medium">Grupo</th>
                        <th className="text-left py-3 px-4 font-medium">Permissões</th>
                        <th className="w-24 py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const group = groupMap.get(user.groupId);
                        return (
                          <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-3 px-4 font-medium">{user.username}</td>
                            <td className="py-3 px-4 text-muted-foreground">{group?.name ?? "Grupo não encontrado"}</td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {countActivePermissions(group?.permissions ?? buildDefaultGroupPermissionsConfig())} permissão(ões)
                            </td>
                            <td className="py-3 px-4">
                              {canEditConfig ? (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditUserModal(user)}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => void handleDeleteUser(user)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
          <DialogContent className="w-[min(96vw,88rem)] max-w-6xl h-[95vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{editingGroup ? "Editar grupo" : "Novo grupo"}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Nome do grupo</Label>
                  <Input
                    id="group-name"
                    value={groupFormName}
                    onChange={(e) => setGroupFormName(e.target.value)}
                    placeholder="Ex.: RH Operacional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-description">Descrição</Label>
                  <Textarea
                    id="group-description"
                    value={groupFormDescription}
                    onChange={(e) => setGroupFormDescription(e.target.value)}
                    placeholder="Resumo do perfil de acesso deste grupo"
                    className="min-h-[40px]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Permissões do grupo</Label>
                <p className="text-xs text-muted-foreground">
                  Defina setores, módulos, abas e operações permitidas para este grupo. Os usuários vinculados herdarão esse perfil.
                </p>
                <ConfiguracoesPermissionsEditor
                  value={groupFormPermissions}
                  onChange={setGroupFormPermissions}
                  availableSectors={availableSectors}
                  commentTagOptions={commentTagOptions}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGroupModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveGroup} disabled={!groupFormName.trim()}>
                {editingGroup ? "Salvar grupo" : "Criar grupo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user-username">Usuário</Label>
                <Input
                  id="user-username"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="nome.do.usuario"
                  disabled={!!editingUser}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">{editingUser ? "Nova senha (deixe em branco para manter)" : "Senha"}</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-group">Grupo de usuário</Label>
                <Select value={formGroupId} onValueChange={setFormGroupId}>
                  <SelectTrigger id="user-group">
                    <SelectValue placeholder="Selecione um grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A visibilidade das telas e as permissões de edição são definidas exclusivamente pelo grupo selecionado.
                </p>
                {selectedUserGroup ? (
                  <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">Resumo do grupo selecionado</p>
                      <p className="text-xs text-muted-foreground">
                        Grupo: {selectedUserGroup.name} • {countActivePermissions(selectedUserGroup.permissions)} permissão(ões) ativa(s)
                      </p>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-sm border border-border/60 bg-background/70 p-2">
                      <ul className="space-y-1 text-xs text-foreground">
                        {selectedUserGroupPreview.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Se este usuário já estiver logado, será preciso entrar novamente para recarregar as permissões herdadas do grupo.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUserModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveUser} disabled={!formUsername.trim() || !formGroupId || (!editingUser && !formPassword.trim())}>
                {editingUser ? "Salvar" : "Criar usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
