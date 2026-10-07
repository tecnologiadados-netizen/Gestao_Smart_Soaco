export type DesligamentoComplementoResumo = {
  colaboradorMatricula: string;
  dataDemissao: string;
  motivoPai: string;
  motivoFilho: string;
  motivoTexto: string;
  motivoSensivel?: boolean;
  motivoOculto?: boolean;
  motivoFilhoId?: string;
};

/** Compara o motivo pai da Secullum ignorando acento, caixa e espaços repetidos. */
export function normalizarMotivoPai(value: string): string {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

export function filhosDoMotivoPai<T extends { motivoPai: string }>(itens: T[], motivoPai: string): T[] {
  const key = normalizarMotivoPai(motivoPai);
  if (!key) return [];
  return itens.filter((item) => normalizarMotivoPai(item.motivoPai) === key);
}

/** Mesma regra de `normalizeMatriculaFolha` (zeros à esquerda não distinguem a pessoa). */
function matriculaKey(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/^0+/, "") || "0";
}

export function escolherComplementoDesligamento(
  lista: DesligamentoComplementoResumo[],
  matricula: string,
  dataDemissao?: string,
): DesligamentoComplementoResumo | null {
  const mat = matriculaKey(matricula);
  if (!mat || mat === "0") return null;
  const doColaborador = lista.filter((item) => matriculaKey(item.colaboradorMatricula) === mat);
  if (doColaborador.length === 0) return null;
  const data = String(dataDemissao ?? "").trim().slice(0, 10);
  if (data) {
    const exato = doColaborador.find((item) => String(item.dataDemissao ?? "").slice(0, 10) === data);
    if (exato) return exato;
  }
  return doColaborador.length === 1 ? doColaborador[0]! : null;
}
