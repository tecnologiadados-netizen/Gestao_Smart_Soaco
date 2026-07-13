/**
 * Normaliza o conteúdo de `rh_organico_fotos.foto_base64`.
 * O app grava payload base64 puro ou data URL completa; o legado Supabase às vezes
 * gravou data URL sem pontuação: `dataimage/jpegbase64/9j/...`.
 */
export function normalizeOrganicoFotoPayload(
  input: string,
  mimeType?: string | null,
): { payload: string; mimeType: string | null } {
  const raw = String(input ?? '').trim();
  if (!raw) return { payload: '', mimeType: mimeType ?? null };

  const dataUrl = raw.match(/^data:([^;,]+);base64,(.+)$/is);
  if (dataUrl) {
    return { payload: dataUrl[2]!.trim(), mimeType: dataUrl[1]!.trim() };
  }

  const legacy = raw.match(/^dataimage\/(jpeg|jpg|png|gif|webp)base64\/(.+)$/is);
  if (legacy) {
    const ext = legacy[1]!.toLowerCase();
    const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return { payload: legacy[2]!.trim(), mimeType: mime };
  }

  return { payload: raw, mimeType: mimeType ?? null };
}

/** Lê arquivo de foto do pacote de migração (JPEG binário ou texto base64 legado). */
export function fileBufferToOrganicoFotoPayload(
  buffer: Buffer,
  mimeType?: string | null,
): { payload: string; mimeType: string | null } {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { payload: buffer.toString('base64'), mimeType: mimeType ?? 'image/jpeg' };
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { payload: buffer.toString('base64'), mimeType: mimeType ?? 'image/png' };
  }
  return normalizeOrganicoFotoPayload(buffer.toString('utf8'), mimeType);
}

export function mapOrganicoFotoRow(row: {
  colaboradorMatricula: string;
  colaboradorNome: string;
  fotoBase64: string;
  mimeType: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}) {
  const normalized = normalizeOrganicoFotoPayload(row.fotoBase64, row.mimeType);
  return {
    colaboradorMatricula: row.colaboradorMatricula,
    colaboradorNome: row.colaboradorNome,
    fotoBase64: normalized.payload,
    mimeType: normalized.mimeType ?? row.mimeType,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}
