import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { chaveFicha, type ComponenteDetalhe } from './regras.js';

export type DadosPeca = {
  medida01: string;
  medida02: string;
  modelo: string;
  materiaPrima: string;
};

type DadosSalvos = DadosPeca & { codigo: string };

function vazio(valor: string | undefined): boolean {
  return !(valor ?? '').trim();
}

/** Preenche só o que o Nomus deixou em branco; o que já vem na ficha prevalece. */
export async function aplicarMedidasSalvas(componentes: ComponenteDetalhe[]): Promise<ComponenteDetalhe[]> {
  const codigos = [...new Set(componentes.map((componente) => chaveFicha(componente.codigo)).filter(Boolean))];
  if (codigos.length === 0) return componentes;
  const salvas = await prisma.$queryRaw<DadosSalvos[]>(
    Prisma.sql`SELECT codigo, medida01, medida02, modelo, materia_prima AS materiaPrima
      FROM gondola_medida_peca WHERE codigo IN (${Prisma.join(codigos)})`
  );
  const porCodigo = new Map(salvas.map((salva) => [salva.codigo, salva]));
  return componentes.map((componente) => {
    const salva = porCodigo.get(chaveFicha(componente.codigo));
    if (!salva) return componente;
    return {
      ...componente,
      medida01: vazio(componente.medida01) ? salva.medida01 : componente.medida01,
      medida02: vazio(componente.medida02) ? salva.medida02 : componente.medida02,
      modelo: vazio(componente.modelo) ? salva.modelo : componente.modelo,
      materiaPrima: vazio(componente.materiaPrima) ? salva.materiaPrima : componente.materiaPrima,
    };
  });
}

export async function salvarMedidaPeca(codigo: string, dados: DadosPeca): Promise<DadosPeca> {
  const chave = chaveFicha(codigo);
  if (!chave) throw new Error('Informe o código da peça.');
  const limpo: DadosPeca = {
    medida01: dados.medida01.trim(),
    medida02: dados.medida02.trim(),
    modelo: dados.modelo.trim(),
    materiaPrima: dados.materiaPrima.trim(),
  };
  if (Object.values(limpo).every((valor) => !valor)) {
    await prisma.$executeRaw`DELETE FROM gondola_medida_peca WHERE codigo = ${chave}`;
    return limpo;
  }
  await prisma.$executeRaw`
    INSERT INTO gondola_medida_peca (codigo, medida01, medida02, modelo, materia_prima, atualizado_em)
    VALUES (${chave}, ${limpo.medida01}, ${limpo.medida02}, ${limpo.modelo}, ${limpo.materiaPrima}, CURRENT_TIMESTAMP)
    ON CONFLICT(codigo) DO UPDATE SET
      medida01 = excluded.medida01,
      medida02 = excluded.medida02,
      modelo = excluded.modelo,
      materia_prima = excluded.materia_prima,
      atualizado_em = CURRENT_TIMESTAMP
  `;
  return limpo;
}
