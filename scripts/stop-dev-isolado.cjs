/**
 * Para só o stack isolado (4001 / 5181). NÃO toca na produção :4000.
 * Uso: npm run dev:isolado:stop
 */
process.env.DEV_BACKEND_PORT = '4001';
process.env.DEV_FRONTEND_PORT = '5181';

const { ensurePortsFree } = require('./port-utils.cjs');
const { releaseLock } = require('./dev-stack-lock.cjs');
const { appendDevLog } = require('./dev-log.cjs');

const PORTS = [4001, 5181];

appendDevLog('stop-dev-isolado', `Parando portas ${PORTS.join(',')}`);

const result = ensurePortsFree({ ports: PORTS, maxAttempts: 5, killDevStack: true });
releaseLock();

if (result.ok) {
  console.log('Stack isolado parado. Portas liberadas: 4001, 5181. Produção :4000 intacta.');
  process.exit(0);
}

console.error('[stop-dev-isolado] Não liberou:', result.busy.join(', '));
process.exit(1);
