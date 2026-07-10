export interface RegistroAnexo {
  id: string;
  nome: string;
  dataUrl: string;
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
