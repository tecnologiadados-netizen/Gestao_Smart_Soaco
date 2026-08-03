export type AnexoAssinaturaPayload = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

/** Lê um PDF do input file e devolve o payload base64 usado pelas APIs de ajuste. */
export async function lerPdfAssinatura(file: File): Promise<AnexoAssinaturaPayload> {
  const nome = (file.name || 'assinatura.pdf').trim() || 'assinatura.pdf';
  const mime = (file.type || '').trim().toLowerCase();
  if (mime && mime !== 'application/pdf' && !nome.toLowerCase().endsWith('.pdf')) {
    throw new Error('Envie apenas PDF (.pdf).');
  }
  if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
    throw new Error('PDF inválido ou excede 15MB.');
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    fileName: nome.toLowerCase().endsWith('.pdf') ? nome : `${nome}.pdf`,
    mimeType: 'application/pdf',
    contentBase64: btoa(binary),
  };
}
