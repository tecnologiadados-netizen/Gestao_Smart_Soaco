/** Texto gravado quando a sync não conseguiu ler o motivo na Secullum. */
export const MOTIVO_SECULLUM_NAO_INFORMADO = 'Não informado no Secullum';

export function motivoSecullumAusente(valor: string | null | undefined): boolean {
  const texto = String(valor ?? '').trim();
  return texto === '' || texto === MOTIVO_SECULLUM_NAO_INFORMADO;
}

/** Compara o motivo pai da Secullum ignorando acento, caixa e espaços repetidos. */
export function normalizarMotivoPai(value: string): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ');
}

export function motivoPaiCompativel(cadastrado: string, daPendencia: string): boolean {
  const a = normalizarMotivoPai(cadastrado);
  const b = normalizarMotivoPai(daPendencia);
  return a !== '' && a === b;
}

export class MotivoDesligamentoErro extends Error {
  readonly status = 400;
}
