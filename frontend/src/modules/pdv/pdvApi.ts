import { apiJson, getApiBase, getCsrfToken, getStoredToken } from '@/api/client';

export async function pdvJson<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  return apiJson<T>(path, init as RequestInit);
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
