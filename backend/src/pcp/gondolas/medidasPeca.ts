import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { chaveFicha, type ComponenteDetalhe } from './regras.js';

type MedidaSalva = { codigo: string; medida01: string; medida02: string };

export async function aplicarMedidasSalvas(componentes: ComponenteDetalhe[]): Promise<ComponenteDetalhe[]> {
  const codigos = [...new Set(componentes.map((componente) => chaveFicha(componente.codigo)).filter(Boolean))];
  if (codigos.length === 0) return componentes;
  const salvas = await prisma.$queryRaw<MedidaSalva[]>(
    Prisma.sql`SELECT codigo, medida01, medida02 FROM gondola_medida_peca WHERE codigo IN (${Prisma.join(codigos)})`
  );
  const porCodigo = new Map(salvas.map((salva) => [salva.codigo, salva]));
  return componentes.map((componente) => {
    if (componente.medida01.trim() || componente.medida02.trim()) return componente;
    const salva = porCodigo.get(chaveFicha(componente.codigo));
    if (!salva) return componente;
    return { ...componente, medida01: salva.medida01, medida02: salva.medida02 };
  });
}

export async function salvarMedidaPeca(codigo: string, medida01: string, medida02: string): Promise<void> {
  const chave = chaveFicha(codigo);
  if (!chave) throw new Error('Informe o código da peça.');
  const m1 = medida01.trim();
  const m2 = medida02.trim();
  if (!m1 && !m2) {
    await prisma.$executeRaw`DELETE FROM gondola_medida_peca WHERE codigo = ${chave}`;
    return;
  }
  await prisma.$executeRaw`
    INSERT INTO gondola_medida_peca (codigo, medida01, medida02, atualizado_em)
    VALUES (${chave}, ${m1}, ${m2}, CURRENT_TIMESTAMP)
    ON CONFLICT(codigo) DO UPDATE SET
      medida01 = excluded.medida01,
      medida02 = excluded.medida02,
      atualizado_em = CURRENT_TIMESTAMP
  `;
}
