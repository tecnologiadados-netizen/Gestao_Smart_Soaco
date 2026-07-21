/**
 * Integração Evolution API (Baileys) – WhatsApp.
 * Autenticação: header `apikey` (= AUTHENTICATION_API_KEY da Evolution).
 *
 * Endpoints usados:
 *  - GET  /instance/fetchInstances
 *  - POST /instance/create
 *  - GET  /instance/connectionState/{instance}
 *  - GET  /instance/connect/{instance}
 *  - DELETE /instance/logout/{instance}
 *  - POST /message/sendText/{instance}
 */

import { getEvolutionStoredConfig } from '../data/configRepository.js';
import { envioNotificacoesHabilitado, logEnvioSuprimido } from '../config/envioNotificacoes.js';

const DEFAULT_INSTANCE_LABEL = 'gestao-soaco';
const FETCH_TIMEOUT_MS = 45_000;
const SEND_MAX_ATTEMPTS = 3;
const SEND_RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
const WHATSAPP_MAX_TEXT_CHARS = 4096;

function getEnv() {
  return {
    url: (process.env.EVOLUTION_API_URL ?? process.env.EVOLUTION_API_BASE_URL ?? process.env.UAZAPI_URL ?? '')
      .replace(/\/$/, '')
      .trim(),
    apiKey: (process.env.EVOLUTION_API_KEY ?? process.env.UAZAPI_TOKEN ?? '').trim(),
    instance: (
      process.env.EVOLUTION_API_INSTANCE ??
      process.env.UAZAPI_INSTANCE_NAME ??
      DEFAULT_INSTANCE_LABEL
    ).trim(),
    number: (process.env.EVOLUTION_WHATSAPP_NUMBER ?? process.env.UAZAPI_WHATSAPP_NUMBER ?? '').trim(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = FETCH_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function evolutionHeaders(apiKey: string, withJson = false): Record<string, string> {
  const h: Record<string, string> = {
    apikey: apiKey,
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  if (withJson) h['Content-Type'] = 'application/json';
  return h;
}

function extractErrorMessage(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback;
  const record = json as Record<string, unknown>;
  const response = record.response;
  if (response && typeof response === 'object') {
    const message = (response as { message?: unknown }).message;
    if (Array.isArray(message)) return message.map(String).join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof record.message === 'string' && record.message.trim()) return record.message;
  if (typeof record.error === 'string' && record.error.trim()) return record.error;
  return fallback;
}

function isErrorPayload(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false;
  const record = json as Record<string, unknown>;
  if (record.error === true) return true;
  const status = Number(record.status);
  if (Number.isFinite(status) && status >= 400) return true;
  if (typeof record.error === 'string' && record.error.trim() && record.instance == null) {
    return true;
  }
  return false;
}

async function evolutionRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const env = getEnv();
  if (!env.url || !env.apiKey) {
    throw new Error('Evolution API não configurada. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY no .env.');
  }
  const res = await fetchWithTimeout(`${env.url}${path}`, {
    ...init,
    headers: {
      ...evolutionHeaders(env.apiKey, Boolean(init?.body)),
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || isErrorPayload(json)) {
    throw new Error(extractErrorMessage(json, `Evolution API HTTP ${res.status}`));
  }
  return json as T;
}

function readInstanceName(record: Record<string, unknown>): string {
  const nested = record.instance;
  if (nested && typeof nested === 'object') {
    const fromNested = String((nested as { instanceName?: string }).instanceName ?? '').trim();
    if (fromNested) return fromNested;
  }
  return String(record.instanceName ?? record.name ?? '').trim();
}

function mapConnectionState(raw: unknown): string {
  const state = String(
    (raw as { instance?: { state?: string }; state?: string })?.instance?.state ??
      (raw as { state?: string })?.state ??
      ''
  ).toLowerCase();
  if (state === 'open' || state === 'connected') return 'connected';
  if (state === 'connecting') return 'connecting';
  return state || 'disconnected';
}

async function resolveInstanceName(override?: string): Promise<string> {
  const env = getEnv();
  const stored = await getEvolutionStoredConfig();
  return (override?.trim() || stored.instance || env.instance || DEFAULT_INSTANCE_LABEL).trim();
}

async function fetchEvolutionInstances(): Promise<string[]> {
  const json = await evolutionRequest<unknown>('/instance/fetchInstances', { method: 'GET' });
  if (!Array.isArray(json)) return [];
  return json
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      return readInstanceName(item as Record<string, unknown>);
    })
    .filter(Boolean);
}

async function ensureEvolutionInstance(instanceName: string): Promise<Record<string, unknown> | null> {
  const names = await fetchEvolutionInstances();
  if (names.some((n) => n.toLowerCase() === instanceName.toLowerCase())) {
    return null;
  }
  return evolutionRequest<Record<string, unknown>>('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    }),
  });
}

function stripDataUrlBase64(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('data:')) {
    const idx = s.indexOf(',');
    return idx >= 0 ? s.slice(idx + 1) : s;
  }
  return s;
}

function parseQrPayload(json: Record<string, unknown>): { qrCodeBase64?: string; pairingCode?: string } {
  const qrcodeField = json.qrcode;
  const nestedBase64 =
    qrcodeField && typeof qrcodeField === 'object'
      ? String((qrcodeField as { base64?: string }).base64 ?? '')
      : '';
  const pairingField = json.pairingCode;
  const nestedPairing =
    pairingField && typeof pairingField === 'object'
      ? String((pairingField as { code?: string }).code ?? '')
      : '';
  const base64Raw = String(json.base64 ?? nestedBase64 ?? '').trim();
  const qrCodeBase64 = base64Raw ? stripDataUrlBase64(base64Raw) : undefined;
  const pairingCode =
    String(
      (typeof json.pairingCode === 'string' ? json.pairingCode : '') ||
        nestedPairing ||
        String(json.code ?? '')
    ).trim() || undefined;
  return { qrCodeBase64, pairingCode };
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
    key: env.apiKey,
    instance: (stored?.instance ?? env.instance) || DEFAULT_INSTANCE_LABEL,
    number: (stored?.number ?? env.number) || '',
  };
}

export function isConfigured(): boolean {
  const { url, apiKey } = getEnv();
  return Boolean(url && apiKey);
}

export function getEvolutionConfig(): { url: string; instance: string; configured: boolean } {
  const { url, instance } = getEnv();
  return { url, instance: instance || DEFAULT_INSTANCE_LABEL, configured: isConfigured() };
}

/** GET /instance/connectionState/{instance} */
export async function getConnectionState(instanceName?: string): Promise<{ state: string } | null> {
  if (!isConfigured()) throw new Error('Evolution API não configurada');
  const name = await resolveInstanceName(instanceName);
  try {
    const names = await fetchEvolutionInstances();
    if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      return { state: 'disconnected' };
    }
  } catch {
    // segue para connectionState
  }
  const json = await evolutionRequest<unknown>(
    `/instance/connectionState/${encodeURIComponent(name)}`,
    { method: 'GET' }
  );
  return { state: mapConnectionState(json) };
}

/** DELETE /instance/logout/{instance} */
export async function logoutInstance(instanceName?: string): Promise<void> {
  if (!isConfigured()) throw new Error('Evolution API não configurada');
  const name = await resolveInstanceName(instanceName);
  await evolutionRequest(`/instance/logout/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

/** Garante instância + GET /instance/connect/{instance} – QR base64 (sem data-url) */
export async function getConnectQr(instanceName?: string): Promise<{ qrCodeBase64: string; pairingCode?: string }> {
  if (!isConfigured()) throw new Error('Evolution API não configurada');
  const name = await resolveInstanceName(instanceName);

  const created = await ensureEvolutionInstance(name);
  if (created) {
    const fromCreate = parseQrPayload(created);
    if (fromCreate.qrCodeBase64) {
      return { qrCodeBase64: fromCreate.qrCodeBase64, pairingCode: fromCreate.pairingCode };
    }
    await sleep(2000);
  }

  const state = await getConnectionState(name);
  if (state?.state === 'connected' || state?.state === 'open') {
    throw new Error('Instância já conectada.');
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const json = await evolutionRequest<Record<string, unknown>>(
        `/instance/connect/${encodeURIComponent(name)}`,
        { method: 'GET' }
      );
      const parsed = parseQrPayload(json);
      if (parsed.qrCodeBase64) {
        return { qrCodeBase64: parsed.qrCodeBase64, pairingCode: parsed.pairingCode };
      }
      lastError = new Error('Evolution connect: resposta sem QR code. Aguarde e tente atualizar.');
      await sleep(2000);
    } catch (e) {
      lastError = e;
      await sleep(2000);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Evolution connect: resposta sem QR code. Aguarde e tente atualizar.');
}

export async function fetchInstances(): Promise<{ instanceName: string; state?: string }[]> {
  if (!isConfigured()) return [];
  try {
    const names = await fetchEvolutionInstances();
    const out: { instanceName: string; state?: string }[] = [];
    for (const instanceName of names) {
      try {
        const st = await getConnectionState(instanceName);
        out.push({ instanceName, state: st?.state });
      } catch {
        out.push({ instanceName });
      }
    }
    return out;
  } catch {
    const env = getEnv();
    return [{ instanceName: env.instance || DEFAULT_INSTANCE_LABEL }];
  }
}

export async function createInstance(instanceName: string): Promise<{ instanceName: string }> {
  await ensureEvolutionInstance(instanceName);
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
  const numbers = [env.number, NUMERO_EXTRA_NOTIFICACAO].filter(
    (n) => n && n.replace(/\D/g, '').length >= 10
  );
  for (const num of numbers) {
    const result = await sendWhatsAppTextTo(num, text);
    if (!result.ok) {
      console.error('[Evolution] sendWhatsAppText falhou para', num, result.error);
    }
  }
}

export function mensagemErroEvolutionEnvio(httpStatus: number, errText: string): string {
  const lower = errText.toLowerCase();
  if (
    lower.includes('unauthorized') ||
    (lower.includes('invalid') && lower.includes('apikey')) ||
    lower.includes('invalid token') ||
    lower.includes('missing token')
  ) {
    return 'API key da Evolution inválida ou ausente. Verifique EVOLUTION_API_KEY no .env do backend.';
  }
  if (
    lower.includes('connection closed') ||
    lower.includes('not connected') ||
    lower.includes('disconnected') ||
    lower.includes('session closed') ||
    lower.includes('whatsapp desconectado')
  ) {
    return 'WhatsApp desconectado. Acesse o menu WhatsApp no sistema e reconecte a instância (escaneie o QR Code).';
  }
  if (httpStatus === 404) {
    return 'Instância WhatsApp não encontrada na Evolution. Verifique EVOLUTION_API_INSTANCE e reconecte o QR.';
  }
  if (httpStatus >= 500) {
    return 'Servidor Evolution indisponível ou instância desconectada. Confirme o PM2 (evolution-api) e reconecte o WhatsApp.';
  }
  const resumo = errText.length > 180 ? `${errText.slice(0, 180)}…` : errText;
  return `Falha ao enviar mensagem (${httpStatus}): ${resumo}`;
}

export async function verificarWhatsAppProntoParaEnvio(): Promise<{ ok: true } | { ok: false; error: string }> {
  const env = await getResolvedEvolutionEnv();
  if (!env.url) {
    return { ok: false, error: 'Evolution API não configurada (EVOLUTION_API_URL no .env).' };
  }
  if (!env.key) {
    return { ok: false, error: 'Evolution API não configurada (EVOLUTION_API_KEY no .env).' };
  }
  try {
    const st = await getConnectionState(env.instance);
    const state = (st?.state ?? '').toLowerCase();
    if (state !== 'connected' && state !== 'open') {
      return {
        ok: false,
        error: `WhatsApp desconectado (estado: ${st?.state ?? 'desconhecido'}). Reconecte em WhatsApp no menu do sistema.`,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Não foi possível verificar a Evolution: ${msg}` };
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

function isTransientSendError(message: string, httpStatus?: number): boolean {
  if (httpStatus != null && httpStatus >= 500) return true;
  const lower = message.toLowerCase();
  return (
    /abort|timeout|etimedout|econnreset|econnrefused|fetch failed|network|502|503|504/.test(lower) ||
    /not connected|disconnected|connection closed|session closed|connecting/.test(lower)
  );
}

async function sendTextOnce(numberClean: string, text: string, instanceName: string): Promise<void> {
  const st = await getConnectionState(instanceName);
  const state = (st?.state ?? '').toLowerCase();
  if (state !== 'connected' && state !== 'open') {
    throw new Error(
      `WhatsApp desconectado (estado: ${st?.state ?? 'desconhecido'}). Escaneie o QR Code em WhatsApp.`
    );
  }

  await evolutionRequest(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({ number: numberClean, text }),
  });
}

export type SendWhatsAppResult = { ok: boolean; error?: string; dryRun?: boolean };

/** POST /message/sendText/{instance} – com gate de sessão e retry. */
export async function sendWhatsAppTextTo(number: string, text: string): Promise<SendWhatsAppResult> {
  if (!envioNotificacoesHabilitado()) {
    logEnvioSuprimido('whatsapp', number);
    return { ok: true, dryRun: true };
  }
  const env = await getResolvedEvolutionEnv();
  if (!env.url || !env.key) {
    return { ok: false, error: 'Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY).' };
  }
  const numberClean = number.replace(/\D/g, '');
  if (!numberClean || numberClean.length < 10) {
    return { ok: false, error: 'Número inválido' };
  }

  const instanceName = env.instance || DEFAULT_INSTANCE_LABEL;
  let lastError = '';

  for (let attempt = 0; attempt < SEND_MAX_ATTEMPTS; attempt++) {
    try {
      await sendTextOnce(numberClean, text, instanceName);
      return { ok: true };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(`[Evolution] sendText tentativa ${attempt + 1}/${SEND_MAX_ATTEMPTS}:`, lastError);
      const transient = isTransientSendError(lastError);
      if (!transient || attempt >= SEND_MAX_ATTEMPTS - 1) break;
      await sleep(SEND_RETRY_DELAYS_MS[attempt] ?? 5_000);
    }
  }

  return {
    ok: false,
    error: mensagemErroEvolutionEnvio(0, lastError || 'Falha ao enviar'),
  };
}

export async function sendWhatsAppTextToLong(number: string, text: string): Promise<SendWhatsAppResult> {
  const chunks = splitTextIntoChunks(text, WHATSAPP_MAX_TEXT_CHARS);
  for (let i = 0; i < chunks.length; i++) {
    const parte = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n${chunks[i]!}` : chunks[i]!;
    const result = await sendWhatsAppTextTo(number, parte);
    if (!result.ok) return result;
    if (i < chunks.length - 1) await sleep(500);
  }
  return { ok: true };
}

/** Pausa entre destinatários (anti rate-limit). Padrão 500 ms. */
export function delayEntreDestinatariosMs(): number {
  const n = Number(process.env.WHATSAPP_DELAY_ENTRE_DESTINATARIOS_MS);
  return Number.isFinite(n) && n >= 0 ? n : 500;
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
  const { pedido, codigo, cliente, descricao, data_entrega, previsao_antiga, previsao_nova, motivo, observacao, usuario } =
    params;
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
