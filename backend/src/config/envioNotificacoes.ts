/**
 * Guard de envio real de notificações (e-mail e WhatsApp).
 *
 * Segurança "à prova de erro humano": por padrão o envio real fica
 * DESABILITADO. Apenas a máquina de PRODUÇÃO deve definir
 * `NOTIFICACOES_ENVIO_HABILITADO=true` no `.env`.
 *
 * Motivo: máquinas de desenvolvimento frequentemente usam o mesmo banco e as
 * mesmas credenciais de produção (SQLite + Gmail/uazapiGO). Sem esta trava, um
 * cron rodando na máquina de dev dispara e-mail/WhatsApp reais para clientes
 * (duplicando o que a produção já envia). Não dá para confiar em `NODE_ENV`
 * como guarda porque ele costuma estar `production` também em dev.
 */

let statusLogado = false;

/** True somente se NOTIFICACOES_ENVIO_HABILITADO=true (produção). */
export function envioNotificacoesHabilitado(): boolean {
  return process.env.NOTIFICACOES_ENVIO_HABILITADO?.trim().toLowerCase() === 'true';
}

/** Loga que um envio foi suprimido (modo dry-run, ambiente sem envio real). */
export function logEnvioSuprimido(
  canal: 'email' | 'whatsapp',
  destino: string,
  assunto?: string
): void {
  const alvo = assunto ? `${destino} — ${assunto}` : destino;
  console.warn(
    `[envio-desabilitado] ${canal.toUpperCase()} NÃO enviado (dry-run): ${alvo}. ` +
      'Defina NOTIFICACOES_ENVIO_HABILITADO=true no .env para habilitar (apenas em produção).'
  );
}

/** Loga uma única vez, na subida, se o envio real está ligado ou não. */
export function logStatusEnvioNotificacoes(): void {
  if (statusLogado) return;
  statusLogado = true;
  if (envioNotificacoesHabilitado()) {
    console.log(
      '[envio-notificacoes] Envio real de e-mail/WhatsApp HABILITADO (NOTIFICACOES_ENVIO_HABILITADO=true).'
    );
  } else {
    console.warn(
      '[envio-notificacoes] Envio real de e-mail/WhatsApp DESABILITADO (dry-run). ' +
        'Em produção, defina NOTIFICACOES_ENVIO_HABILITADO=true no .env.'
    );
  }
}
