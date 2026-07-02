import type { Request, Response } from 'express';
import {
  isConfigured,
  getEvolutionConfig,
  getConnectionState,
  getConnectQr,
  logoutInstance,
} from '../services/evolutionApi.js';
import { getEvolutionStoredConfig, saveEvolutionConfig } from '../data/configRepository.js';

const DEFAULT_INSTANCE = 'gestor-pedidos';

/**
 * GET /api/evolution/connect
 * Verifica status uazapiGO e retorna QR se não estiver conectada.
 */
export async function getConnect(_req: Request, res: Response): Promise<void> {
  const config = getEvolutionConfig();
  if (!config.configured) {
    res.status(400).json({
      error: 'uazapiGO não configurada. Defina UAZAPI_URL e UAZAPI_TOKEN (ou UAZAPI_ADMIN_TOKEN) no .env.',
      configured: false,
    });
    return;
  }

  let stored = await getEvolutionStoredConfig();
  const instanceName = (stored?.instance ?? config.instance ?? DEFAULT_INSTANCE).trim() || DEFAULT_INSTANCE;

  try {
    let state: { state: string } | null = null;
    try {
      state = await getConnectionState(instanceName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isNetworkError = /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|network|aborted/i.test(msg);
      console.error('[uazapiGO] status:', msg);
      const hint = isNetworkError
        ? ` Servidor inacessível. Teste: curl -I "${config.url}"`
        : ' Verifique UAZAPI_URL, UAZAPI_TOKEN e UAZAPI_ADMIN_TOKEN no .env do backend.';
      res.status(200).json({
        configured: true,
        connected: false,
        error: `uazapiGO inacessível: ${msg}.${hint}`,
      });
      return;
    }

    const connected = state?.state === 'connected' || state?.state === 'open';

    if (connected) {
      await saveEvolutionConfig(instanceName);
      stored = await getEvolutionStoredConfig();
      const hasNumber = Boolean((stored?.number ?? '').trim());
      res.json({
        configured: true,
        connected: true,
        instance: instanceName,
        instanceFromEnv: Boolean(config.instance?.trim()),
        instanceConfiguredInEnv: hasNumber,
        storedNumber: stored?.number ?? null,
        message: hasNumber
          ? 'WhatsApp conectado e configurado para envio.'
          : 'WhatsApp conectado. Defina o número para envio abaixo.',
        envHint: !hasNumber
          ? 'Informe o número do WhatsApp (com DDD) e clique em Salvar para habilitar o envio de mensagens.'
          : undefined,
      });
      return;
    }

    let qr: { qrCodeBase64: string; pairingCode?: string };
    try {
      qr = await getConnectQr(instanceName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[uazapiGO] connect:', msg);
      res.status(200).json({
        configured: true,
        connected: false,
        error: msg,
      });
      return;
    }

    res.json({
      configured: true,
      connected: false,
      instance: instanceName,
      instanceFromEnv: Boolean(config.instance?.trim()),
      qrCodeBase64: qr.qrCodeBase64,
      pairingCode: qr.pairingCode,
      message: 'Escaneie o QR code no WhatsApp (Aparelhos conectados → Conectar um aparelho).',
      envHint: 'Após conectar, defina o número nesta página para habilitar envios automáticos.',
    });
  } catch (err) {
    console.error('[uazapiGO] getConnect:', err);
    res.status(200).json({
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : 'Erro ao obter QR de conexão.',
    });
  }
}

/** GET /api/evolution/config */
export async function getConfig(_req: Request, res: Response): Promise<void> {
  const config = getEvolutionConfig();
  if (!config.configured) {
    res.json({ configured: false, url: '', instance: '' });
    return;
  }
  const stored = await getEvolutionStoredConfig();
  const instance = stored?.instance || config.instance || DEFAULT_INSTANCE;
  let connected = false;
  try {
    const state = await getConnectionState(instance);
    connected = state?.state === 'connected' || state?.state === 'open';
  } catch {
    // ignore
  }
  res.json({
    configured: true,
    url: config.url,
    instance,
    connected,
    storedNumber: stored?.number ?? null,
  });
}

/** POST /api/evolution/logout – desconecta a instância uazapiGO */
export async function logout(_req: Request, res: Response): Promise<void> {
  const config = getEvolutionConfig();
  if (!config.configured) {
    res.status(400).json({ error: 'uazapiGO não configurada.' });
    return;
  }
  const stored = await getEvolutionStoredConfig();
  const instanceName = stored?.instance || config.instance || DEFAULT_INSTANCE;
  try {
    await logoutInstance(instanceName);
    res.json({ ok: true, message: 'WhatsApp desconectado da uazapiGO.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[uazapiGO] logout:', msg);
    res.status(503).json({ error: msg });
  }
}

/** POST /api/evolution/save-config – persiste rótulo da instância e número para envio */
export async function saveConfig(req: Request, res: Response): Promise<void> {
  const instance = typeof req.body?.instance === 'string' ? req.body.instance.trim() : '';
  const number = typeof req.body?.number === 'string' ? req.body.number.trim() : '';
  if (!instance) {
    res.status(400).json({ error: 'instance é obrigatório' });
    return;
  }
  try {
    await saveEvolutionConfig(instance, number || undefined);
    res.json({ ok: true, instance, number: number || null });
  } catch (err) {
    console.error('[uazapiGO] saveConfig:', err);
    res.status(503).json({ error: 'Erro ao salvar configuração.' });
  }
}
