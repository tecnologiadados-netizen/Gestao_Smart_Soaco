import { apiJson, getApiBase, getCsrfToken, getStoredToken } from '@/api/client';

export async function pdvJson<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  return apiJson<T>(path, init as RequestInit);
}

/** Abre o HTML imprimível da proposta (salvar como PDF no navegador). */
export async function abrirPropostaPdf(vendaId: number, autoPrint = true): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(`${getApiBase()}/api/pdv/vendas/${vendaId}/proposta-pdf${autoPrint ? '?print=1' : ''}`, {
    credentials: 'include',
    headers: {
      Accept: 'text/html',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Não foi possível abrir o PDF da proposta.');
  }
  const html = await res.text();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Permita pop-ups para imprimir a proposta.');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function enviarCertificado(idEmpresa: number, arquivo: File, senha: string): Promise<CertificadoMeta> {
  const csrf = await getCsrfToken();
  const token = getStoredToken();
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  fd.append('senha', senha);
  const res = await fetch(`${getApiBase()}/api/pdv/config/empresas/${idEmpresa}/certificado`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: fd,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & CertificadoMeta;
  if (!res.ok) throw new Error(data.error || 'Não foi possível ler o certificado.');
  return data;
}

export type CertificadoMeta = {
  cnpj?: string;
  titular?: string;
  validoAte?: string | null;
  ambiente?: string;
  temCsc?: boolean;
  serieNfce?: number;
  serieNfe?: number;
  cscId?: string;
};
