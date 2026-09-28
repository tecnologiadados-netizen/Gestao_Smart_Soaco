import { randomUUID } from "@/utils/randomUUID";

export interface RegistroAnexo {
  id: string;
  /** Título informado na linha da evidência. */
  titulo?: string;
  nome: string;
  dataUrl: string;
  /** Caminho no servidor quando o arquivo já foi persistido (sem reenviar base64). */
  storagePath?: string;
}

/** Alias compartilhado para anexos em qualquer tela do SGQ. */
export type SgqAnexo = RegistroAnexo;

export const SGQ_ANEXO_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp";

/** Teto por arquivo do SGQ. O envio vai em base64 no JSON, então o corpo da API fica acima disso. */
export const SGQ_ANEXO_MAX_MB = 25;
export const SGQ_ANEXO_MAX_BYTES = SGQ_ANEXO_MAX_MB * 1024 * 1024;

export function mensagemLimiteAnexo(nomeArquivo?: string): string {
  const limite = `${SGQ_ANEXO_MAX_MB} MB`;
  if (nomeArquivo?.trim()) {
    return `"${nomeArquivo.trim()}" excede o limite de ${limite}.`;
  }
  return `O arquivo excede o limite de ${limite}.`;
}

export function criarAnexoVazio(): SgqAnexo {
  return { id: randomUUID(), titulo: "", nome: "", dataUrl: "" };
}

export function anexoTemArquivo(anexo: {
  nome?: string;
  dataUrl?: string;
  storagePath?: string;
}): boolean {
  return Boolean(
    anexo.nome?.trim() && (anexo.dataUrl?.trim() || anexo.storagePath?.trim())
  );
}

export function anexosPreenchidos(
  anexos: SgqAnexo[]
): { nome: string; dataUrl: string; storagePath?: string; titulo?: string }[] {
  return anexos
    .filter((a) => anexoTemArquivo(a))
    .map((a) => ({
      nome: a.nome.trim(),
      dataUrl: a.dataUrl?.trim() || "",
      ...(a.titulo?.trim() ? { titulo: a.titulo.trim() } : {}),
      ...(a.storagePath?.trim() ? { storagePath: a.storagePath.trim() } : {}),
    }));
}

export function normalizarRegistroAnexos(
  valor: unknown,
  opcoes?: { manterVazios?: boolean }
): RegistroAnexo[] {
  if (!Array.isArray(valor)) return [];
  const lista = valor.map((item, index) => {
    const anexo = item as Partial<RegistroAnexo> & Record<string, unknown>;
    const nome = typeof anexo?.nome === "string" ? anexo.nome : "";
    const titulo = typeof anexo?.titulo === "string" ? anexo.titulo : "";
    const dataUrl = typeof anexo?.dataUrl === "string" ? anexo.dataUrl : "";
    const storagePath =
      typeof anexo?.storagePath === "string" ? anexo.storagePath : undefined;
    const id =
      typeof anexo?.id === "string" && anexo.id
        ? anexo.id
        : `anexo-legado-${index}`;
    return { id, titulo, nome, dataUrl, ...(storagePath ? { storagePath } : {}) };
  });
  if (opcoes?.manterVazios) return lista;
  return lista.filter((anexo) => anexoTemArquivo(anexo));
}
