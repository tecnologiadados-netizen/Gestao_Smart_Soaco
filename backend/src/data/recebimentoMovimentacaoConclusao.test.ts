import { describe, expect, it } from 'vitest';
import {
  movimentacaoDeixouPreEntrada,
  SQL_PRE_ENTRADA_SEM_DOCUMENTO_EFETIVADO,
} from './recebimentoNomusRepository.js';

describe('movimentacaoDeixouPreEntrada', () => {
  const preEntrada = new Set([10, 11]);

  it('mantém o documento na fila enquanto o tipo ainda é pré-entrada', () => {
    expect(movimentacaoDeixouPreEntrada(10, preEntrada)).toBe(false);
  });

  it('conclui quando o Nomus troca para outro tipo de movimentação', () => {
    expect(movimentacaoDeixouPreEntrada(42, preEntrada)).toBe(true);
  });

  it('não conclui sem tipo identificado', () => {
    expect(movimentacaoDeixouPreEntrada(0, preEntrada)).toBe(false);
  });

  it('exclui a cópia tipo 46 quando existe entrada efetivada com o mesmo número fiscal', () => {
    expect(SQL_PRE_ENTRADA_SEM_DOCUMENTO_EFETIVADO).toContain('NOT EXISTS');
    expect(SQL_PRE_ENTRADA_SEM_DOCUMENTO_EFETIVADO).toContain(
      'deEfetivado.idEmpresaEntrada = de.idEmpresaEntrada'
    );
    expect(SQL_PRE_ENTRADA_SEM_DOCUMENTO_EFETIVADO).toContain(
      'COALESCE(deEfetivado.idParceiro, 0) = COALESCE(de.idParceiro, 0)'
    );
    expect(SQL_PRE_ENTRADA_SEM_DOCUMENTO_EFETIVADO).toContain(
      'deEfetivado.idTipoMovimentacao IN (11, 35, 111, 112, 113, 114, 115, 116)'
    );
  });
});
