/**
 * Libera as portas do stack dev.
 * Por padrão encerra loops/watchdogs/concurrently deste projeto (--ports-only para só liberar listeners).
 * Use: npm run dev:stop para parada completa.
 */
const { DEV_PORTS, ensurePortsFree } = require('./port-utils.cjs');
const { releaseLock } = require('./dev-stack-lock.cjs');
const { appendDevLog } = require('./dev-log.cjs');

/** Por padrão encerra a stack dev inteira (evita vários npm run dev brigando pelas portas). */
const fullStack = !process.argv.includes('--ports-only');

appendDevLog(
  'kill-ports',
  `Invocado (fullStack=${fullStack}, argv=${process.argv.slice(2).join(' ') || '(vazio)'}, pid=${process.pid})`
);

const result = ensurePortsFree({ ports: DEV_PORTS, maxAttempts: 5, killDevStack: fullStack });

releaseLock();

if (result.ok) {
  appendDevLog('kill-ports', 'Portas liberadas', DEV_PORTS.join(','));
  console.log(`Portas ${DEV_PORTS.join(', ')} liberadas.`);
  process.exit(0);
}

appendDevLog('kill-ports', 'Falha ao liberar portas', result.busy.join(','));
console.error(
  `[kill-ports] Não foi possível liberar todas as portas após ${result.attempts} tentativas:`,
  result.busy.join(', ')
);
process.exit(1);
