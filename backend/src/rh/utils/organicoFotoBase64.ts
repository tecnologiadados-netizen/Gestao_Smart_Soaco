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

function isMostlyBase64Text(text: string): boolean {
  const compact = text.replace(/\s/g, '');
  return compact.length > 50 && /^[A-Za-z0-9+/=]+$/.test(compact);
}

/** Localiza início real de JPEG/PNG dentro de buffer (alguns exports legados têm lixo antes do SOI). */
export function extractImageBytes(buffer: Buffer): { bytes: Buffer; mimeType: string } {
  const pngIdx = buffer.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (pngIdx >= 0) {
    return { bytes: buffer.subarray(pngIdx), mimeType: 'image/png' };
  }
  const pngShort = buffer.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (pngShort >= 0) {
    return { bytes: buffer.subarray(pngShort), mimeType: 'image/png' };
  }

  const jpgIdx = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  if (jpgIdx >= 0) {
    return { bytes: buffer.subarray(jpgIdx), mimeType: 'image/jpeg' };
  }
  const jpgShort = buffer.indexOf(Buffer.from([0xff, 0xd8]));
  if (jpgShort >= 0) {
    return { bytes: buffer.subarray(jpgShort), mimeType: 'image/jpeg' };
  }

  return { bytes: buffer, mimeType: 'image/jpeg' };
}

/** Lê arquivo de foto do pacote de migração (JPEG binário, PNG, texto base64 legado). */
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

  const asText = buffer.toString('utf8').trim();
  if (asText.startsWith('data:') || /^dataimage\//i.test(asText)) {
    return normalizeOrganicoFotoPayload(asText, mimeType);
  }
  if (isMostlyBase64Text(asText)) {
    return normalizeOrganicoFotoPayload(asText.replace(/\s/g, ''), mimeType);
  }

  const { bytes, mimeType: sniffed } = extractImageBytes(buffer);
  return { payload: bytes.toString('base64'), mimeType: mimeType ?? sniffed };
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
