/**
 * Guarda o vencimento original da primeira reprogramação do título.
 * O texto já existente na descrição ou no comentário preenche o registro;
 * uma reprogramação nova grava a data que o título tinha antes da troca.
 */

import { prisma } from '../config/prisma.js';

const MARCADOR_DATA =
  /(?:REPROGRAMAD[OA]\s*[-–—:]\s*VENC(?:IMENTO)?\.?\s*ORIGINAL:?\s+(\d{2})[\/.\-](\d{2})[\/.\-](\d{2,4})|\bREP\s+(\d{2})[\/.\-](\d{2})(?:[\/.\-](\d{2,4}))?)/i;

const PALAVRA_REPROGRAMADO = /reprogramad[oa]/i;

export interface ReprogramacaoExtraida {
  texto: string;
  vencimentoOriginal: string | null;
}

export interface LinhaComReprogramacao {
  origem: 'Shop9' | 'Nomus';
  codigo: number;
  descricao: string | null;
  observacao: string | null;
  reprogramado: string | null;
}

export function extrairReprogramacao(texto: string | null | undefined): ReprogramacaoExtraida | null {
  const bruto = texto ?? '';
  if (!bruto.trim()) return null;
  const m = MARCADOR_DATA.exec(bruto);
  if (m) {
    const dia = m[1] ?? m[4];
    const mes = m[2] ?? m[5];
    const anoBruto = m[3] ?? m[6];
    if (dia && mes && anoBruto) {
      const ano = anoBruto.length === 2 ? `20${anoBruto}` : anoBruto;
      return { texto: `${dia}/${mes}/${ano}`, vencimentoOriginal: `${ano}-${mes}-${dia}` };
    }
    if (dia && mes) return { texto: `${dia}/${mes}`, vencimentoOriginal: null };
  }
  if (PALAVRA_REPROGRAMADO.test(bruto)) return { texto: 'REPROGRAMADO', vencimentoOriginal: null };
  return null;
}

export function extrairReprogramacaoLinha(
  descricao: string | null | undefined,
  observacao: string | null | undefined,
): ReprogramacaoExtraida | null {
  return extrairReprogramacao(descricao) ?? extrairReprogramacao(observacao);
}

function chave(origem: string, codigo: number): string {
  return `${origem}:${codigo}`;
}

/** Preenche o que ainda não está gravado e devolve o texto da coluna. */
export async function aplicarReprogramacoesDiario(linhas: LinhaComReprogramacao[]): Promise<void> {
  const chaves = linhas.filter((l) => l.codigo > 0);
  if (chaves.length === 0) return;
  const salvas = await prisma.diarioReprogramacao.findMany({
    where: { codigo: { in: [...new Set(chaves.map((l) => l.codigo))] } },
    select: { origem: true, codigo: true, texto: true, vencimentoOriginal: true },
  });
  const porChave = new Map(salvas.map((r) => [chave(r.origem, r.codigo), r]));
  const agora = new Date();
  const novas: Array<{
    origem: string;
    codigo: number;
    texto: string;
    vencimentoOriginal: string | null;
  }> = [];

  for (const linha of chaves) {
    const atual = porChave.get(chave(linha.origem, linha.codigo));
    const extraida = extrairReprogramacaoLinha(linha.descricao, linha.observacao);
    if (!atual && extraida) {
      novas.push({
        origem: linha.origem,
        codigo: linha.codigo,
        texto: extraida.texto,
        vencimentoOriginal: extraida.vencimentoOriginal,
      });
      porChave.set(chave(linha.origem, linha.codigo), {
        origem: linha.origem,
        codigo: linha.codigo,
        texto: extraida.texto,
        vencimentoOriginal: extraida.vencimentoOriginal,
      });
    } else if (atual && !atual.vencimentoOriginal && extraida?.vencimentoOriginal) {
      novas.push({
        origem: linha.origem,
        codigo: linha.codigo,
        texto: extraida.texto,
        vencimentoOriginal: extraida.vencimentoOriginal,
      });
      atual.texto = extraida.texto;
      atual.vencimentoOriginal = extraida.vencimentoOriginal;
    }
    const visivel = porChave.get(chave(linha.origem, linha.codigo));
    linha.reprogramado = visivel?.texto ?? null;
  }

  const unicas = [...new Map(novas.map((item) => [chave(item.origem, item.codigo), item])).values()];
  if (unicas.length === 0) return;
  await prisma.$transaction(
    unicas.map((item) =>
      prisma.diarioReprogramacao.upsert({
        where: { origem_codigo: { origem: item.origem, codigo: item.codigo } },
        create: { ...item, atualizadoEm: agora },
        update: {
          texto: item.texto,
          vencimentoOriginal: item.vencimentoOriginal,
          atualizadoEm: agora,
        },
      }),
    ),
  );
}

/** Guarda a data anterior na primeira reprogramação. Não substitui um original já conhecido. */
export async function gravarReprogramacaoOriginal(
  origem: 'Shop9' | 'Nomus',
  codigo: number,
  vencimentoOriginal: string | null,
): Promise<void> {
  if (codigo <= 0) return;
  const texto = formatarOriginal(vencimentoOriginal);
  const existente = await prisma.diarioReprogramacao.findUnique({
    where: { origem_codigo: { origem, codigo } },
    select: { vencimentoOriginal: true },
  });
  if (existente?.vencimentoOriginal) return;
  await prisma.diarioReprogramacao.upsert({
    where: { origem_codigo: { origem, codigo } },
    create: {
      origem,
      codigo,
      texto,
      vencimentoOriginal,
    },
    update: {
      texto,
      vencimentoOriginal: vencimentoOriginal ?? undefined,
    },
  });
}

function formatarOriginal(ymd: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '');
  if (!m) return 'REPROGRAMADO';
  return `${m[3]}/${m[2]}/${m[1]}`;
}
