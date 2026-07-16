import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Configuracoes from "@rh/pages/Configuracoes";
import { buildDefaultGroupPermissions, type RhGroupPermissions } from "@rh/lib/rh-permissions";
import { normalizeOrganicoCommentTagId } from "@rh/lib/organico-comment-tags";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  setLogo: vi.fn(async () => {}),
  createUserGroup: vi.fn(() => ({ ok: true })),
  updateUserGroup: vi.fn(() => ({ ok: true })),
  groups: [] as any[],
  users: [] as any[],
}));

vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useLogo", () => ({
  useLogo: () => ({ logo: null, setLogo: mocks.setLogo }),
}));

vi.mock("@/lib/auth", () => ({
  getRhSessionToken: () => null,
  isMaster: () => false,
}));

vi.mock("@/lib/route-permissions", () => ({
  canEditRoute: () => true,
}));

vi.mock("@/lib/api-client", () => ({
  getOrganico: vi.fn(async () => []),
  importRhFullBackupPayload: vi.fn(),
  isApiConfigured: () => false,
  downloadRhFullBackupFile: vi.fn(),
  rhUserGroupsCreate: vi.fn(),
  rhUserGroupsDelete: vi.fn(),
  rhUserGroupsList: vi.fn(async () => []),
  rhUserGroupsUpdate: vi.fn(),
  rhUsersCreate: vi.fn(),
  rhUsersDelete: vi.fn(),
  rhUsersList: vi.fn(async () => []),
  rhUsersUpdate: vi.fn(),
}));

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>("@/lib/config");
  return {
    ...actual,
    getUserGroups: vi.fn(() => mocks.groups),
    getSystemUsers: vi.fn(() => mocks.users),
    createUserGroup: mocks.createUserGroup,
    updateUserGroup: mocks.updateUserGroup,
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    deleteUserGroup: vi.fn(() => ({ ok: true })),
    updateUser: vi.fn(),
  };
});

function getPermissionCard(title: string): HTMLElement {
  const heading = screen.getByText(title);
  const card = heading.closest("section");
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

function getPermissionRow(label: string): HTMLElement {
  const rowLabel = screen.getByText(label);
  const row = rowLabel.closest("div.rounded-md");
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

function getRowCheckbox(rowLabel: string, checkboxLabel: string): HTMLInputElement {
  return within(getPermissionRow(rowLabel)).getByLabelText(checkboxLabel) as HTMLInputElement;
}

function renderPage() {
  render(<Configuracoes />);
}

describe("Configurações - grupos e permissões", () => {
  beforeEach(() => {
    mocks.groups = [];
    mocks.users = [];
    mocks.toast.mockClear();
    mocks.setLogo.mockClear();
    mocks.createUserGroup.mockClear();
    mocks.updateUserGroup.mockClear();
  });

  it("cria um grupo novo alterando apenas o bloco de Orgânico", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "RH Operacional" } });

    const organicoCard = getPermissionCard("Aba Orgânico");
    expect(within(organicoCard).queryByLabelText("Acessar aba")).not.toBeInTheDocument();
    fireEvent.click(getRowCheckbox("Comentários do colaborador", "Editar"));

    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));

    await waitFor(() => {
      expect(mocks.createUserGroup).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.createUserGroup.mock.calls[0][0] as {
      name: string;
      permissions: RhGroupPermissions;
    };

    expect(payload.name).toBe("RH Operacional");
    expect(payload.permissions.organico.comentarios.edit).toBe(true);
    expect(payload.permissions.organico.comentarios.view).toBe(false);
    expect(payload.permissions.organico.colaboradores.view).toBe(false);
    expect(payload.permissions.organico.fotos.view).toBe(false);
    expect(payload.permissions.faltas.route.view).toBe(false);
    expect(payload.permissions.dashboard.modulos.executivo.view).toBe(false);
    expect(payload.permissions.cargos.view).toBe(false);
    expect(payload.permissions.organograma.view).toBe(false);
    expect(payload.permissions.configuracoes.view).toBe(false);
  }, 15000);

  it("edita um grupo preservando os demais blocos fora da alteração", async () => {
    const existingPermissions = buildDefaultGroupPermissions();
    existingPermissions.dashboard.modulos.executivo.view = true;
    existingPermissions.organico.fotos.view = true;

    mocks.groups = [
      {
        id: "grupo-dashboard",
        name: "Grupo Dashboard",
        description: "Acesso inicial ao dashboard",
        permissions: existingPermissions,
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      },
    ];

    renderPage();

    const row = (await screen.findByText("Grupo Dashboard")).closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getAllByRole("button")[0]);

    expect(getRowCheckbox("Fotos do colaborador", "Visualizar")).toBeChecked();
    fireEvent.click(getRowCheckbox("Cadastros auxiliares", "Visualizar"));

    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));

    await waitFor(() => {
      expect(mocks.updateUserGroup).toHaveBeenCalledTimes(1);
    });

    const [groupId, payload] = mocks.updateUserGroup.mock.calls[0] as [
      string,
      { permissions: RhGroupPermissions },
    ];

    expect(groupId).toBe("grupo-dashboard");
    expect(payload.permissions.dashboard.modulos.executivo.view).toBe(true);
    expect(payload.permissions.faltas.route.view).toBe(true);
    expect(payload.permissions.faltas.cadastros.view).toBe(true);
    expect(payload.permissions.faltas.ausencias.view).toBe(false);
    expect(payload.permissions.organico.fotos.view).toBe(true);
    expect(payload.permissions.organico.colaboradores.view).toBe(false);
    expect(payload.permissions.cargos.view).toBe(false);
  });

  it("mantém comentários e fotos independentes ao editar o grupo", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Grupo Orgânico" } });

    const organicoCard = getPermissionCard("Aba Orgânico");
    expect(within(organicoCard).queryByLabelText("Acessar aba")).not.toBeInTheDocument();
    expect(screen.getByText("Comentários do colaborador")).toBeInTheDocument();
    expect(screen.getByText("Fotos do colaborador")).toBeInTheDocument();

    const comentariosRow = screen.getByText("Comentários do colaborador").closest("div");
    expect(comentariosRow).not.toBeNull();
    fireEvent.click(within(comentariosRow as HTMLElement).getByLabelText("Editar"));

    expect(within(organicoCard).queryByText("Inserir")).not.toBeInTheDocument();
    expect(within(organicoCard).queryByText("Excluir")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));

    await waitFor(() => {
      expect(mocks.createUserGroup).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.createUserGroup.mock.calls[0][0] as {
      permissions: RhGroupPermissions;
    };

    expect(payload.permissions.organico.comentarios.edit).toBe(true);
    expect(payload.permissions.organico.fotos.edit).toBe(false);
  });

  it("não altera outros checkboxes ao marcar uma permissão detalhada", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Grupo Independente" } });

    const comentariosRow = getPermissionRow("Comentários do colaborador");
    const fotosRow = getPermissionRow("Fotos do colaborador");
    const colaboradoresRow = getPermissionRow("Colaboradores por setor");

    const comentariosVisualizar = within(comentariosRow).getByLabelText("Visualizar") as HTMLInputElement;
    const comentariosEditar = within(comentariosRow).getByLabelText("Editar") as HTMLInputElement;
    const fotosVisualizar = within(fotosRow).getByLabelText("Visualizar") as HTMLInputElement;
    const fotosEditar = within(fotosRow).getByLabelText("Editar") as HTMLInputElement;
    const colaboradoresVisualizar = within(colaboradoresRow).getByLabelText("Visualizar") as HTMLInputElement;

    expect(comentariosVisualizar).not.toBeChecked();
    expect(comentariosEditar).not.toBeChecked();
    expect(fotosVisualizar).not.toBeChecked();
    expect(fotosEditar).not.toBeChecked();
    expect(colaboradoresVisualizar).not.toBeChecked();

    fireEvent.click(comentariosEditar);

    expect(comentariosEditar).toBeChecked();
    expect(comentariosVisualizar).not.toBeChecked();
    expect(fotosVisualizar).not.toBeChecked();
    expect(fotosEditar).not.toBeChecked();
    expect(colaboradoresVisualizar).not.toBeChecked();
  });

  it("reflete no modal do usuário o resumo das permissões herdadas do grupo", async () => {
    const groupPermissions = buildDefaultGroupPermissions();
    groupPermissions.faltas.ausencias.view = true;
    groupPermissions.faltas.ausencias.edit = true;
    groupPermissions.organico.formTabs.identificacao.view = true;
    groupPermissions.organico.formTabs.remuneracao.view = false;

    mocks.groups = [
      {
        id: "grupo-rh-operacional",
        name: "RH - Operacional",
        description: "Grupo operacional",
        permissions: groupPermissions,
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      },
    ];
    mocks.users = [
      {
        id: "user-1",
        username: "davitesttes",
        groupId: "grupo-rh-operacional",
        createdAt: "2026-03-28T00:00:00.000Z",
        passwordHash: "",
      },
    ];

    renderPage();

    const row = (await screen.findByText("davitesttes")).closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getAllByRole("button")[0]);

    expect(await screen.findByText("Resumo do grupo selecionado")).toBeInTheDocument();
    expect(screen.getByText(/Grupo: RH - Operacional/i)).toBeInTheDocument();
    expect(screen.getByText("Faltas > Ausências: Visualizar, Editar")).toBeInTheDocument();
    expect(screen.getByText(/Orgânico > Abas liberadas: Identificação/i)).toBeInTheDocument();
    expect(screen.getByText(/Orgânico > Abas sem acesso: .*Remuneração/i)).toBeInTheDocument();
  });

  it("permite desativar tags e visibilidades de comentários ao salvar o grupo", async () => {
    const existingPermissions = buildDefaultGroupPermissions();
    existingPermissions.organico.comentarios.view = true;
    existingPermissions.organico.comentarios.tags[normalizeOrganicoCommentTagId("advertencia_formal")] = true;
    existingPermissions.organico.comentarios.visibilities.confidential = true;

    mocks.groups = [
      {
        id: "grupo-comentarios",
        name: "Grupo Comentários",
        description: "Permissões de comentários",
        permissions: existingPermissions,
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      },
    ];

    renderPage();

    const row = (await screen.findByText("Grupo Comentários")).closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getAllByRole("button")[0]);

    fireEvent.click(screen.getByLabelText("🚫 Confidencial"));
    fireEvent.click(screen.getByLabelText("⚖️ Advertência formal"));

    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));

    await waitFor(() => {
      expect(mocks.updateUserGroup).toHaveBeenCalledTimes(1);
    });

    const [, payload] = mocks.updateUserGroup.mock.calls[0] as [
      string,
      { permissions: RhGroupPermissions },
    ];

    expect(payload.permissions.organico.comentarios.visibilities.confidential).toBe(false);
    expect(payload.permissions.organico.comentarios.tags[normalizeOrganicoCommentTagId("advertencia_formal")]).toBe(false);
  });
});
