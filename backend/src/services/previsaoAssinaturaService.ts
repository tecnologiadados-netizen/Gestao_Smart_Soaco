import { prisma } from '../config/prisma.js';
import {
  savePrevisaoAssinaturaPdf,
  type IncomingPrevisaoAssinaturaPdf,
  type SavedPrevisaoAssinaturaPdf,
} from '../utils/previsaoAssinaturaPdfUpload.js';

export type AnexoAssinaturaPayload = {
  fileName: string;
  mimeType?: string;
  contentBase64: string;
};

export type AnexoAssinaturaPersistido = {
  path: string;
  nome: string;
  grupoId: string;
};

/** Retorna true se o motivo cadastrado for não abonado (exige PDF, salvo isenção). */
export async function motivoExigeAnexoAssinatura(motivo: string): Promise<boolean> {
  const descricao = String(motivo ?? '').trim();
  if (!descricao) return false;
  const row = await prisma.motivoSugestao.findFirst({
    where: { descricao },
    select: { abonada: true },
  });
  return row != null && row.abonada === false;
}

export async function algumMotivoExigeAnexoAssinatura(
  motivos: string[],
): Promise<boolean> {
  const unicos = [
    ...new Set(motivos.map((m) => String(m ?? '').trim()).filter(Boolean)),
  ];
  for (const motivo of unicos) {
    if (await motivoExigeAnexoAssinatura(motivo)) return true;
  }
  return false;
}

export function persistirAnexoAssinaturaFromPayload(
  anexo: AnexoAssinaturaPayload | null | undefined,
): AnexoAssinaturaPersistido | null {
  if (!anexo?.contentBase64?.trim()) return null;
  const saved: SavedPrevisaoAssinaturaPdf = savePrevisaoAssinaturaPdf({
    fileName: anexo.fileName,
    mimeType: anexo.mimeType,
    contentBase64: anexo.contentBase64,
  } satisfies IncomingPrevisaoAssinaturaPdf);
  return {
    path: saved.storagePath,
    nome: saved.originalName,
    grupoId: saved.grupoId,
  };
}

/**
 * Valida e persiste o PDF de assinatura.
 * - Motivo não abonado (salvo isento): PDF obrigatório.
 * - PDF enviado: sempre grava e devolve path (mesmo com motivo abonado), para não se perder no histórico.
 * - Import XLSX (`isento`): não exige nem persiste.
 * @throws Error com mensagem amigável quando obrigatório e ausente/inválido.
 */
export async function resolverAnexoAssinaturaObrigatorio(opts: {
  motivos: string[];
  anexo?: AnexoAssinaturaPayload | null;
  /** Import XLSX: não exige PDF. */
  isento?: boolean;
}): Promise<AnexoAssinaturaPersistido | null> {
  if (opts.isento) return null;

  const exige = await algumMotivoExigeAnexoAssinatura(opts.motivos);
  const temAnexo = Boolean(opts.anexo?.contentBase64?.trim());

  if (exige && !temAnexo) {
    throw new Error(
      'Justificativa não abonada exige o PDF assinado do responsável.',
    );
  }

  if (!temAnexo) return null;

  const persistido = persistirAnexoAssinaturaFromPayload(opts.anexo);
  if (!persistido) {
    throw new Error('Não foi possível gravar o PDF de assinatura.');
  }
  return persistido;
}
