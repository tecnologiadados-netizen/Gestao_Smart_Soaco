import { prisma } from '../../config/prisma.js';
import { listOrganicoColaboradoresParaRnc } from '../../data/qualidadeRepository.js';
import { getOrganicoFoto } from '../../rh/repositories/organicoRepository.js';
import { extractImageBytes } from '../../rh/utils/organicoFotoBase64.js';
import { canonicalizeSetorPainel } from './painelProducaoConstants.js';

export type ResponsavelArea = 'montagem' | 'producao';

export type ResponsavelMeta = {
  organico_id: string;
  nome: string;
  cargo: string;
};

export type ResponsaveisSetor = {
  responsaveis: ResponsavelMeta[];
  /** Mês (YYYY-MM) em que a definição vigente foi gravada; null = nunca definido. */
  definido_em: string | null;
};

export const RESPONSAVEL_AREAS: readonly ResponsavelArea[] = ['montagem', 'producao'];

/** Montagem tem um único responsável; produção aceita vários colaboradores. */
const MAX_RESPONSAVEIS: Record<ResponsavelArea, number> = { montagem: 1, producao: 50 };

function mesKey(mes: string): string {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mês inválido. Use o formato YYYY-MM.');
  return `${mes}-01`;
}

export function chaveResponsaveis(area: ResponsavelArea, setor: string): string {
  const canon = area === 'montagem' ? canonicalizeSetorPainel(setor) : String(setor ?? '').trim();
  return `${area}::${canon}`;
}

function parseResponsaveis(json: string): ResponsavelMeta[] {
  try {
    const lista = JSON.parse(json) as unknown;
    if (!Array.isArray(lista)) return [];
    return lista
      .map((item) => {
        const r = item as Partial<ResponsavelMeta>;
        return {
          organico_id: String(r.organico_id ?? ''),
          nome: String(r.nome ?? '').trim(),
          cargo: String(r.cargo ?? '').trim(),
        };
      })
      .filter((r) => r.organico_id && r.nome);
  } catch {
    return [];
  }
}

/**
 * Responsáveis vigentes no mês: para cada área+setor, a definição do mês mais recente
 * até o mês consultado (herda automaticamente para os meses seguintes).
 */
export async function listarResponsaveisVigentes(
  mes: string,
): Promise<Map<string, ResponsaveisSetor>> {
  const key = mesKey(mes);
  const rows = await prisma.painelProducaoResponsavel.findMany({
    where: { mesAno: { lte: key } },
    orderBy: { mesAno: 'desc' },
  });
  const vigentes = new Map<string, ResponsaveisSetor>();
  for (const row of rows) {
    if (!RESPONSAVEL_AREAS.includes(row.area as ResponsavelArea)) continue;
    const chave = chaveResponsaveis(row.area as ResponsavelArea, row.setor);
    if (vigentes.has(chave)) continue;
    vigentes.set(chave, {
      responsaveis: parseResponsaveis(row.responsaveisJson),
      definido_em: row.mesAno.slice(0, 7),
    });
  }
  return vigentes;
}

export async function salvarResponsaveis(params: {
  mes: string;
  area: ResponsavelArea;
  setor: string;
  organicoIds: string[];
  usuario?: string | null;
}): Promise<ResponsaveisSetor> {
  const { mes, area, usuario } = params;
  const key = mesKey(mes);
  const setor = area === 'montagem' ? canonicalizeSetorPainel(params.setor) : params.setor.trim();
  if (!setor) throw new Error('Setor é obrigatório.');

  const ids = [...new Set(params.organicoIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (ids.length > MAX_RESPONSAVEIS[area]) {
    throw new Error(
      area === 'montagem'
        ? 'Setores de montagem aceitam um único responsável.'
        : `Máximo de ${MAX_RESPONSAVEIS[area]} responsáveis por setor.`,
    );
  }

  const ativos = await listOrganicoColaboradoresParaRnc();
  const porId = new Map(ativos.map((p) => [p.id, p]));
  const responsaveis: ResponsavelMeta[] = ids.map((id) => {
    const pessoa = porId.get(id);
    if (!pessoa) throw new Error('Colaborador não encontrado entre os ativos do orgânico.');
    return { organico_id: pessoa.id, nome: pessoa.nome, cargo: pessoa.cargo };
  });

  await prisma.painelProducaoResponsavel.upsert({
    where: { mesAno_area_setor: { mesAno: key, area, setor } },
    create: {
      mesAno: key,
      area,
      setor,
      responsaveisJson: JSON.stringify(responsaveis),
      atualizadoPor: usuario ?? null,
    },
    update: {
      responsaveisJson: JSON.stringify(responsaveis),
      atualizadoPor: usuario ?? null,
    },
  });

  return { responsaveis, definido_em: mes };
}

function chaveMatricula(matricula: string): string {
  return String(matricula ?? '').trim().replace(/^0+/, '');
}

export async function listarColaboradoresAtivosOrganico(): Promise<
  Array<{
    id: string;
    nome: string;
    cargo: string;
    setor: string;
    matricula: string;
    tem_foto: boolean;
  }>
> {
  const [ativos, fotos] = await Promise.all([
    listOrganicoColaboradoresParaRnc(),
    prisma.rhOrganicoFotos.findMany({
      select: { colaboradorMatricula: true, colaboradorNome: true },
    }),
  ]);
  const matriculasComFoto = new Set(fotos.map((f) => chaveMatricula(f.colaboradorMatricula)));
  const nomesComFoto = new Set(fotos.map((f) => f.colaboradorNome.trim()));
  return ativos.map(({ id, nome, cargo, setor, matricula }) => ({
    id,
    nome,
    cargo,
    setor,
    matricula,
    tem_foto:
      (matricula !== '' && matriculasComFoto.has(chaveMatricula(matricula))) ||
      nomesComFoto.has(nome),
  }));
}

/** Foto do colaborador (por id do orgânico), no mesmo cadastro de fotos do RH. */
export async function obterFotoColaborador(
  organicoId: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const pessoa = await prisma.rhOrganico.findUnique({
    where: { id: organicoId },
    select: { matricula: true, nome: true },
  });
  if (!pessoa) return null;
  const matricula = pessoa.matricula.trim() === '—' ? '' : pessoa.matricula.trim();
  const foto = await getOrganicoFoto({
    matricula: matricula || undefined,
    nome: pessoa.nome.trim() || undefined,
  });
  if (!foto?.fotoBase64) return null;
  const { bytes, mimeType } = extractImageBytes(Buffer.from(foto.fotoBase64, 'base64'));
  if (bytes.length === 0) return null;
  return { bytes, mimeType: foto.mimeType || mimeType };
}
