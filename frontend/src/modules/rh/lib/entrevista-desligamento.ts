import { validateOrganicoDocumentFile } from "@rh/lib/organico-document-contract";
import {
  uploadOrganicoDocument,
  type OrganicoArchiveDocument,
  type OrganicoArchiveFolder,
} from "@rh/lib/organico-documents-api";

export const NOME_PASTA_DESLIGAMENTO = "Desligamento";

export function normalizarNomePasta(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function ehPastaDesligamento(nome: string): boolean {
  return normalizarNomePasta(nome) === normalizarNomePasta(NOME_PASTA_DESLIGAMENTO);
}

export function encontrarPastaDesligamento(folders: OrganicoArchiveFolder[]): OrganicoArchiveFolder | null {
  const raiz = folders.find((folder) => folder.scope === "global" && ehPastaDesligamento(folder.name));
  if (raiz) return raiz;
  for (const folder of folders) {
    const aninhada = encontrarPastaDesligamento(folder.children);
    if (aninhada?.scope === "global") return aninhada;
  }
  return null;
}

export function entrevistasDaPasta(pasta: OrganicoArchiveFolder | null): OrganicoArchiveDocument[] {
  if (!pasta) return [];
  return pasta.documents.filter(
    (documento) =>
      documento.mimeType === "application/pdf" || documento.fileName.toLowerCase().endsWith(".pdf"),
  );
}

export function entrevistasNoCard(folders: OrganicoArchiveFolder[]): OrganicoArchiveDocument[] {
  const saida: OrganicoArchiveDocument[] = [];
  const visitar = (pastas: OrganicoArchiveFolder[]) => {
    for (const pasta of pastas) {
      for (const documento of entrevistasDaPasta(pasta)) {
        const titulo = normalizarNomePasta(documento.title);
        const categoria = normalizarNomePasta(documento.category);
        if (titulo.includes("ENTREVISTA DE DESLIGAMENTO") || categoria === "DESLIGAMENTO") {
          saida.push(documento);
        }
      }
      visitar(pasta.children);
    }
  };
  visitar(folders);
  return saida;
}

export function arquivoEhPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function pdfComTipo(file: File): File {
  if (!arquivoEhPdf(file)) {
    throw new Error("Selecione o PDF da entrevista de desligamento.");
  }
  if (file.type === "application/pdf") return file;
  return new File([file], file.name, { type: "application/pdf", lastModified: file.lastModified });
}

export type PastaEntrevista = {
  id: string;
  scope: "global" | "local";
};

export async function arquivarEntrevistaDesligamento(input: {
  file: File;
  matricula: string;
  colaboradorNome: string;
  motivoSensivel: boolean;
  pasta: PastaEntrevista;
}): Promise<void> {
  const file = pdfComTipo(input.file);
  const validacao = validateOrganicoDocumentFile(file);
  if (!validacao.ok) throw new Error(validacao.error);
  if (!input.pasta.id) throw new Error("Selecione a pasta de destino.");
  const nome = input.colaboradorNome.trim() || input.matricula;
  await uploadOrganicoDocument({
    matricula: input.matricula,
    colaboradorNome: nome,
    title: `Entrevista de desligamento — ${nome}`,
    category: NOME_PASTA_DESLIGAMENTO,
    classification: input.motivoSensivel ? "highly_confidential" : "confidential",
    folderScope: input.pasta.scope,
    folderId: input.pasta.id,
    file,
    launchSource: "desligamento",
    launchSourceRecordId: input.matricula,
  });
}
