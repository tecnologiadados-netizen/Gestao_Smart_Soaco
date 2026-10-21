/** Eventos da trajetória gerados pelas pendências CTPS/cargo da Secullum (mesmo formato do people-s-rh). */

export const ORIGEM_SECULLUM_AGUARDANDO = 'Secullum — aguardando motivo';
export const ORIGEM_SECULLUM_JUSTIFICADA = 'Secullum — justificativa registrada';
export const ORIGEM_SECULLUM_SEM_JUSTIFICATIVA = 'Secullum — pendência excluída sem justificativa';
export const MOTIVO_ENCERRADO_EXCLUSAO_TRAJETORIA = 'Encerrado automaticamente ao excluir o evento da trajetória.';

export type TipoPendenciaSecullum = 'ctps' | 'cargo';

export function isTipoPendenciaTrajetoria(tipo: string): tipo is TipoPendenciaSecullum {
  return tipo === 'ctps' || tipo === 'cargo';
}

export function eventoTrajetoriaSecullum(tipo: TipoPendenciaSecullum, valorAnterior: string, valorAtual: string) {
  const de = valorAnterior.trim() || '—';
  const para = valorAtual.trim() || '—';
  if (tipo === 'ctps') {
    return {
      tipoEvento: 'salario',
      titulo: 'Alteração CTPS (salário base) — Secullum',
      descricao: `Salário base (CTPS) alterado de ${de} para ${para}.`,
    };
  }
  return {
    tipoEvento: 'cargo',
    titulo: 'Alteração de cargo — Secullum',
    descricao: `Cargo alterado de ${de} para ${para}.`,
  };
}

/** Data civil local (fuso do servidor) gravada às 12:00 UTC, padrão das datas da trajetória. */
export function dataEventoLocal(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12));
}

export function chaveTransicaoPendencia(p: {
  tipo: string;
  valorAnterior: string;
  valorAtual: string;
}): string {
  return [p.tipo, p.valorAnterior.trim().toLocaleUpperCase('pt-BR'), p.valorAtual.trim().toLocaleUpperCase('pt-BR')].join('|');
}
