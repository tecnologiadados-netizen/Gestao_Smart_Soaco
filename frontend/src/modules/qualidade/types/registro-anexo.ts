import { randomUUID } from "@/utils/randomUUID";

export interface RegistroAnexo {
  id: string;
  nome: string;
  dataUrl: string;
}

/** Alias compartilhado para anexos em qualquer tela do SGQ. */
export type SgqAnexo = RegistroAnexo;

export const SGQ_ANEXO_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp";

export const SGQ_ANEXO_MAX_BYTES = 5 * 1024 * 1024;

export function criarAnexoVazio(): SgqAnexo {
  return { id: randomUUID(), nome: "", dataUrl: "" };
}

export function anexosPreenchidos(
  anexos: SgqAnexo[]
): { nome: string; dataUrl: string }[] {
  return anexos
    .filter((a) => a.nome.trim() && a.dataUrl.trim())
    .map((a) => ({ nome: a.nome.trim(), dataUrl: a.dataUrl.trim() }));
}

export function normalizarRegistroAnexos(valor: unknown): RegistroAnexo[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((item, index) => {
      const anexo = item as Partial<RegistroAnexo> & Record<string, unknown>;
      const nome = typeof anexo?.nome === "string" ? anexo.nome : "";
      const dataUrl = typeof anexo?.dataUrl === "string" ? anexo.dataUrl : "";
      const id =
        typeof anexo?.id === "string" && anexo.id
          ? anexo.id
          : `anexo-legado-${index}`;
      return { id, nome, dataUrl };
    })
    .filter((anexo) => anexo.nome.trim() && anexo.dataUrl.trim());
}
