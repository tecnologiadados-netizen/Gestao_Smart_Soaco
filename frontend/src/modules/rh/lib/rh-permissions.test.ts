import { describe, expect, it } from "vitest";
import { buildDefaultGroupPermissions, canViewOrganicoCommentClassification, normalizeGroupPermissions } from "@rh/lib/rh-permissions";
import { normalizeOrganicoCommentTagId } from "@rh/lib/organico-comment-tags";

describe("rh-permissions - comentários classificados", () => {
  it("mantém acesso legado a todas as tags e visibilidades ao normalizar comentários antigos", () => {
    const permissions = normalizeGroupPermissions({
      organico: {
        comentarios: {
          view: true,
          edit: false,
        },
      },
    });

    expect(permissions.organico.comentarios.view).toBe(true);
    expect(Object.values(permissions.organico.comentarios.tags).every((value) => value)).toBe(true);
    expect(Object.values(permissions.organico.comentarios.visibilities).every((value) => value)).toBe(true);
  });

  it("filtra comentários pela tag e pela visibilidade configuradas no grupo", () => {
    const permissions = buildDefaultGroupPermissions();
    permissions.organico.comentarios.view = true;
    permissions.organico.comentarios.tags[normalizeOrganicoCommentTagId("advertencia_formal")] = false;
    permissions.organico.comentarios.visibilities.confidential = false;

    expect(canViewOrganicoCommentClassification(permissions, "observacao_geral", "public")).toBe(true);
    expect(canViewOrganicoCommentClassification(permissions, "advertencia_formal", "restricted")).toBe(false);
    expect(canViewOrganicoCommentClassification(permissions, "observacao_geral", "confidential")).toBe(false);
  });

  it("visibilidade omitida no JSON não herda acesso: só true explícito libera ver aquele nível", () => {
    const normalized = normalizeGroupPermissions({
      organico: {
        comentarios: {
          view: true,
          edit: true,
          visibilities: {
            public: true,
            restricted: true,
          },
        },
      },
    });
    expect(normalized.organico.comentarios.visibilities.confidential).toBe(false);
  });

  it("preserva tags desativadas ao normalizar novamente o grupo", () => {
    const permissions = buildDefaultGroupPermissions();
    permissions.organico.comentarios.tags[normalizeOrganicoCommentTagId("advertencia_formal")] = false;
    permissions.organico.comentarios.tags[normalizeOrganicoCommentTagId("risco_compliance")] = false;
    permissions.organico.comentarios.visibilities.confidential = false;

    const normalized = normalizeGroupPermissions(permissions);

    expect(normalized.organico.comentarios.tags[normalizeOrganicoCommentTagId("advertencia_formal")]).toBe(false);
    expect(normalized.organico.comentarios.tags[normalizeOrganicoCommentTagId("risco_compliance")]).toBe(false);
    expect(normalized.organico.comentarios.visibilities.confidential).toBe(false);
  });
});

describe("rh-permissions - documentos globais", () => {
  it("herda exclusão global quando delete=true sem chaves explícitas (compatibilidade)", () => {
    const permissions = normalizeGroupPermissions({
      organico: {
        documentos: {
          view: true,
          create: true,
          edit: true,
          delete: true,
        },
      },
    });

    expect(permissions.organico.documentos.deleteGlobalForOne).toBe(true);
    expect(permissions.organico.documentos.deleteGlobalForAll).toBe(true);
  });

  it("respeita deleteGlobalForAll=false mesmo com delete=true", () => {
    const permissions = normalizeGroupPermissions({
      organico: {
        documentos: {
          view: true,
          delete: true,
          deleteGlobalForOne: true,
          deleteGlobalForAll: false,
        },
      },
    });

    expect(permissions.organico.documentos.deleteGlobalForOne).toBe(true);
    expect(permissions.organico.documentos.deleteGlobalForAll).toBe(false);
  });

  it("não libera exclusão global sem delete base", () => {
    const permissions = normalizeGroupPermissions({
      organico: {
        documentos: {
          view: true,
          delete: false,
          deleteGlobalForOne: true,
          deleteGlobalForAll: true,
        },
      },
    });

    expect(permissions.organico.documentos.delete).toBe(false);
    expect(permissions.organico.documentos.deleteGlobalForOne).toBe(true);
    expect(permissions.organico.documentos.deleteGlobalForAll).toBe(true);
  });
});
