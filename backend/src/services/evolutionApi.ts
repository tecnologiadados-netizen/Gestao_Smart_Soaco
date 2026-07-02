/**
 * Integração uazapiGO v2 – https://docs.uazapi.com/
 * Autenticação: header `token` (token da instância).
 */

import { getEvolutionStoredConfig, saveUazapiInstanceToken } from '../data/configRepository.js';

const DEFAULT_INSTANCE_LABEL = 'gestor-pedidos';

function getEnv() {
  return {
    url: (process.env.UAZAPI_URL ?? process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '').trim(),
    token: (process.env.UAZAPI_TOKEN ?? process.env.EVOLUTION_API_KEY ?? '').trim(),
    adminToken: (process.env.UAZAPI_ADMIN_TOKEN ?? '').trim(),
    instance: (process.env.UAZAPI_INSTANCE_NAME ?? process.env.EVOLUTION_API_INSTANCE ?? DEFAULT_INSTANCE_LABEL).trim(),
    number: (process.env.UAZAPI_WHATSAPP_NUMBER ?? process.env.EVOLUTION_WHATSAPP_NUMBER ?? '').trim(),
  };
}

async function resolveInstanceToken(): Promise<string> {
  const env = getEnv();
  const stored = await getEvolutionStoredConfig();
  const candidates = [env.token, stored.instanceToken].filter(Boolean);
  for (const token of candidates) {
    if (await tokenWorks(token)) return token;
  }
  if (!env.adminToken) {
    throw new Error('Token uazapiGO inválido. Informe UAZAPI_TOKEN (instância) ou UAZAPI_ADMIN_TOKEN no .env.');
  }
  const provisioned = await provisionInstanceToken(env.url, env.adminToken, env.instance || DEFAULT_INSTANCE_LABEL);
  await saveUazapiInstanceToken(provisioned);
  return provisioned;
}

async function tokenWorks(token: string): Promise<boolean> {
  const env = getEnv();
  if (!env.url || !token) return false;
  try {
    const res = await fetchWithTimeout(`${env.url}/instance/status`, { headers: headersGet(token) });
    if (res.status === 401) return false;
    return res.ok;
  } catch {
    return false;
  }
}

type UazInstanceListItem = { name?: string; token?: string; instance?: { name?: string; token?: string } };

async function provisionInstanceToken(url: string, adminToken: string, instanceName: string): Promise<string> {
  const listRes = await fetchWithTimeout(`${url}/instance/all`, { headers: headersAdminGet(adminToken) });
  if (listRes.ok) {
    const list = (await listRes.json()) as UazInstanceListItem[];
    if (Array.isArray(list)) {
      const found = list.find((item) => {
        const name = item.name ?? item.instance?.name ?? '';
        return name.toLowerCase() === instanceName.toLowerCase();
      });
      const token = found?.token ?? found?.instance?.token;
      if (token && (await tokenWorks(token))) return token;
    }
  }

  const initRes = await fetchWithTimeout(`${url}/instance/init`, {
    method: 'POST',
    headers: headersAdminPost(adminToken),
    body: JSON.stringify({ name: instanceName }),
  });
  const initText = await initRes.text();
  if (!initRes.ok) {
    throw new Error(`uazapiGO init: ${initRes.status} ${apiErrorMessage(initRes.status, initText)}`);
  }
  const data = parseJson(initText);
  const token = data.token ?? data.instance?.token;
  if (!token || typeof token !== 'string') {
    throw new Error('uazapiGO init: resposta sem token da instância.');
  }
  return token;
}

/** Config resolvida para envio: banco primeiro, depois .env */
export async function getResolvedEvolutionEnv(): Promise<{
  url: string;
  key: string;
  instance: string;
  number: string;
}> {
  const env = getEnv();
  const stored = await getEvolutionStoredConfig();
  return {
    url: env.url,
    key: env.token,
    instance: (stored?.instance ?? env.instance) || DEFAULT_INSTANCE_LABEL,
    number: (stored?.number ?? env.number) || '',
  };
}

const UAZAPI_FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = UAZAPI_FETCH_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function headersGet(token: string): Record<string, string> {
  return { token, Accept: 'application/json' };
}

function headersPost(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Accept: 'application/json', token };
}

function headersAdminGet(adminToken: string): Record<string, string> {
  return { admintoken: adminToken, Accept: 'application/json' };
}

function headersAdminPost(adminToken: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Accept: 'application/json', admintoken: adminToken };
}

export function isConfigured(): boolean {
  const { url, token, adminToken } = getEnv();
  return Boolean(url && (token || adminToken));
}

export function getEvolutionConfig(): { url: string; instance: string; configured: boolean } {
  const { url, instance } = getEnv();
  return { url, instance: instance || DEFAULT_INSTANCE_LABEL, configured: isConfigured() };
}

type UazInstancePayload = {
  status?: string;
  qrcode?: string;
  paircode?: string;
  name?: string;
  profileName?: string;
};

type UazStatusPayload = {
  connected?: boolean;
  loggedIn?: boolean;
};

type UazApiResponse = {
  code?: number;
  message?: string;
  error?: string;
  token?: string;
  instance?: UazInstancePayload;
  status?: UazStatusPayload;
  qrcode?: string;
  paircode?: string;
  connected?: boolean;
};

function parseJson(text: string): UazApiResponse {
  try {
    return JSON.parse(text) as UazApiResponse;
  } catch {
    return {};
  }
}

function extractQrBase64(data: UazApiResponse): string | undefined {
  const raw = data.instance?.qrcode ?? data.qrcode;
  if (!raw || typeof raw !== 'string') return undefined;
  if (raw.startsWith('data:image')) {
    return raw.replace(/^data:image\/\w+;base64,/, '');
  }
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 100) return raw;
  return undefined;
}

function extractPairingCode(data: UazApiResponse): string | undefined {
  const raw = data.instance?.paircode ?? data.paircode;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

function isConnected(data: UazApiResponse): boolean {
  if (data.status?.connected === true || data.connected === true) return true;
  const st = (data.instance?.status ?? '').toLowerCase();
  return st === 'connected' || st === 'open';
}

function apiErrorMessage(httpStatus: number, text: string): string {
  const data = parseJson(text);
  return data.message ?? data.error ?? text.slice(0, 300);
}

/** GET /instance/status */
export async function getConnectionState(_instanceName?: string): Promise<{ state: string } | null> {
  const env = getEnv();
  if (!env.url) throw new Error('uazapiGO não configurada');
  const token = await resolveInstanceToken();
  const res = await fetchWithTimeout(`${env.url}/instance/status`, { headers: headersGet(token) });
  const text = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`uazapiGO status: ${res.status} ${apiErrorMessage(res.status, text)}`);
  const data = parseJson(text);
  if (isConnected(data)) return { state: 'connected' };
  const st = (data.instance?.status ?? 'disconnected').toLowerCase();
  return { state: st || 'disconnected' };
}

/** POST /instance/disconnect */
export async function logoutInstance(_instanceName?: string): Promise<void> {
  const env = getEnv();
  if (!env.url) throw new Error('uazapiGO não configurada');
  const token = await resolveInstanceToken();
  const res = await fetchWithTimeout(`${env.url}/instance/disconnect`, {
    method: 'POST',
    headers: headersPost(token),
    body: '{}',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`uazapiGO disconnect: ${res.status} ${apiErrorMessage(res.status, text)}`);
  }
}

/** POST /instance/connect – retorna QR base64 e opcional paircode */
export async function getConnectQr(_instanceName?: string): Promise<{ qrCodeBase64: string; pairingCode?: string }> {
  const env = getEnv();
  if (!env.url) throw new Error('uazapiGO não configurada');
  const token = await resolveInstanceToken();

  const statusRes = await fetchWithTimeout(`${env.url}/instance/status`, { headers: headersGet(token) });
  const statusText = await statusRes.text();
  if (statusRes.ok) {
    const statusData = parseJson(statusText);
    if (isConnected(statusData)) {
      throw new Error('Instância já conectada.');
    }
    const qrFromStatus = extractQrBase64(statusData);
    if (qrFromStatus) {
      return { qrCodeBase64: qrFromStatus, pairingCode: extractPairingCode(statusData) };
    }
  }

  const res = await fetchWithTimeout(`${env.url}/instance/connect`, {
    method: 'POST',
    headers: headersPost(token),
    body: '{}',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`uazapiGO connect: ${res.status} ${apiErrorMessage(res.status, text)}`);

  const data = parseJson(text);
  const qrCodeBase64 = extractQrBase64(data);
  if (!qrCodeBase64) {
    throw new Error('uazapiGO connect: resposta sem QR code. Aguarde e tente atualizar.');
  }
  return { qrCodeBase64, pairingCode: extractPairingCode(data) };
}

/** Compatibilidade – uazapi usa token único, não lista instâncias */
export async function fetchInstances(): Promise<{ instanceName: string; state?: string }[]> {
  const env = getEnv();
  if (!env.url || !env.token) return [];
  try {
    const st = await getConnectionState();
    return [{ instanceName: env.instance || DEFAULT_INSTANCE_LABEL, state: st?.state }];
  } catch {
    return [{ instanceName: env.instance || DEFAULT_INSTANCE_LABEL }];
  }
}

/** Compatibilidade – instância já existe via token */
export async function createInstance(instanceName: string): Promise<{ instanceName: string }> {
  return { instanceName };
}

const NUMERO_EXTRA_NOTIFICACAO = '558699766623';

function formatarDataBR(isoDate: string): string {
  if (!isoDate || typeof isoDate !== 'string') return isoDate;
  const s = isoDate.trim();
  const onlyDate = s.slice(0, 10);
  const parts = onlyDate.split(/[-/]/);
  if (parts.length >= 3) {
    const [y, m, d] = parts;
    return `${d!.padStart(2, '0')}/${m!.padStart(2, '0')}/${y}`;
  }
  return isoDate;
}

export async function sendWhatsAppText(text: string): Promise<void> {
  const env = await getResolvedEvolutionEnv();
  if (!env.url || !env.key) return;
  const numbers = [env.number, NUMERO_EXTRA_NOTIFICACAO].filter((n) => n && n.replace(/\D/g, '').length >= 10);
  for (const num of numbers) {
    await sendWhatsAppTextTo(num, text).catch(() => {});
  }
}

/** Limite oficial de texto no WhatsApp (uazapiGO / Cloud API). */
const WHATSAPP_MAX_TEXT_CHARS = 4096;

export function mensagemErroEvolutionEnvio(httpStatus: number, errText: string): string {
  const lower = errText.toLowerCase();
  if (lower.includes('invalid token') || lower.includes('missing token')) {
    return 'Token uazapiGO inválido ou ausente. Verifique UAZAPI_TOKEN no .env do backend.';
  }
  if (
    lower.includes('connection closed') ||
    lower.includes('not connected') ||
    lower.includes('disconnected') ||
    lower.includes('session closed')
  ) {
    return 'WhatsApp desconectado. Acesse o menu WhatsApp no sistema e reconecte a instância (escaneie o QR Code).';
  }
  if (httpStatus === 404) {
    return 'Instância WhatsApp não encontrada na uazapiGO. Verifique URL e token em WhatsApp.';
  }
  if (httpStatus >= 500) {
    return 'Servidor uazapiGO indisponível ou instância desconectada. Reconecte o WhatsApp e tente novamente.';
  }
  const resumo = errText.length > 180 ? `${errText.slice(0, 180)}…` : errText;
  return `Falha ao enviar mensagem (${httpStatus}): ${resumo}`;
}

export async function verificarWhatsAppProntoParaEnvio(): Promise<{ ok: true } | { ok: false; error: string }> {
  const env = await getResolvedEvolutionEnv();
  if (!env.url) {
    return { ok: false, error: 'uazapiGO não configurada (URL no .env).' };
  }
  const { adminToken } = getEnv();
  if (!env.key && !adminToken) {
    return { ok: false, error: 'uazapiGO não configurada (TOKEN ou ADMIN_TOKEN no .env).' };
  }
  try {
    const st = await getConnectionState();
    const state = (st?.state ?? '').toLowerCase();
    if (state && state !== 'connected' && state !== 'open') {
      return {
        ok: false,
        error: `WhatsApp desconectado (estado: ${st?.state ?? 'desconhecido'}). Reconecte em WhatsApp no menu do sistema.`,
      };
    }
  } catch (e) {
    console.warn('[uazapiGO] status:', (e as Error)?.message ?? e);
  }
  return { ok: true };
}

function splitTextIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const lines = text.split('\n');
  const chunks: string[] = [];
  let cur = '';
  for (const line of lines) {
    const candidate = cur ? `${cur}\n${line}` : line;
    if (candidate.length <= maxLen) {
      cur = candidate;
      continue;
    }
    if (cur) {
      chunks.push(cur);
      cur = '';
    }
    if (line.length <= maxLen) {
      cur = line;
      continue;
    }
    for (let i = 0; i < line.length; i += maxLen) {
      chunks.push(line.slice(i, i + maxLen));
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

/** POST /send/text – envia mensagem para um número específico */
export async function sendWhatsAppTextTo(number: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const env = await getResolvedEvolutionEnv();
  if (!env.url) {
    return { ok: false, error: 'uazapiGO não configurada (URL no app)' };
  }
  let token = env.key;
  try {
    token = await resolveInstanceToken();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const numberClean = number.replace(/\D/g, '');
  if (!numberClean) return { ok: false, error: 'Número inválido' };

  const res = await fetchWithTimeout(`${env.url}/send/text`, {
    method: 'POST',
    headers: headersPost(token),
    body: JSON.stringify({ number: numberClean, text }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('[uazapiGO] send/text:', res.status, errText);
    return { ok: false, error: mensagemErroEvolutionEnvio(res.status, apiErrorMessage(res.status, errText)) };
  }
  return { ok: true };
}

export async function sendWhatsAppTextToLong(number: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const chunks = splitTextIntoChunks(text, WHATSAPP_MAX_TEXT_CHARS);
  for (let i = 0; i < chunks.length; i++) {
    const parte = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n${chunks[i]!}` : chunks[i]!;
    const result = await sendWhatsAppTextTo(number, parte);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export function formatarMensagemAlteracaoPrevisao(params: {
  pedido?: string | null;
  codigo?: string | null;
  cliente?: string | null;
  descricao?: string | null;
  data_entrega?: string | null;
  previsao_antiga: string;
  previsao_nova: string;
  motivo: string;
  observacao?: string | null;
  usuario: string;
}): string {
  const { pedido, codigo, cliente, descricao, data_entrega, previsao_antiga, previsao_nova, motivo, observacao, usuario } = params;
  let msg = '📦 *Alteração de previsão de entrega*\n\n';
  if (pedido?.trim()) msg += `📄 *Pedido:* ${pedido.trim()}\n`;
  if (codigo?.trim()) msg += `🔢 *Código:* ${codigo.trim()}\n`;
  if (cliente?.trim()) msg += `👤 *Cliente:* ${cliente.trim()}\n`;
  if (descricao?.trim()) msg += `📋 *Descrição:* ${descricao.trim()}\n`;
  if (data_entrega?.trim()) msg += `📅 *Data de entrega:* ${formatarDataBR(data_entrega)}\n`;
  msg += `📅 *Data anterior:* ${formatarDataBR(previsao_antiga)}\n`;
  msg += `📅 *Nova previsão:* ${formatarDataBR(previsao_nova)}\n`;
  msg += `📝 *Motivo:* ${motivo}\n`;
  msg += `👤 *Alterado por:* ${usuario}\n`;
  if (observacao?.trim()) msg += `\n💬 _Obs: ${observacao.trim()}_`;
  return msg;
}

export function formatarMensagemAlteracaoPrevisaoLote(params: {
  ajustes: Array<{ id_pedido: string; previsao_nova: string; motivo: string }>;
  usuario: string;
}): string {
  const { ajustes, usuario } = params;
  const qtd = ajustes.length;
  let msg = '📦 *Alteração de pedidos em lote*\n\n';
  msg += 'Foi realizada uma alteração de previsões de entrega em lote.';
  if (qtd > 0) msg += `\n\n📋 ${qtd} pedido(s) alterado(s).`;
  msg += `\n\n👤 _Alterado por: ${usuario}_`;
  return msg;
}
