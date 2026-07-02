/**
 * Executa o backend e reinicia automaticamente se o processo sair (crash ou exit).
 * DEV_STABLE=1 usa tsx sem watch (menos reinícios involuntários).
 */
const { spawn } = require('child_process');
const path = require('path');
const { appendDevLog } = require('./dev-log.cjs');

const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'backend');
const stable = process.env.DEV_STABLE === '1';
const npmScript = stable ? 'dev:stable' : 'dev';

function run() {
  appendDevLog('run-backend-loop', `Subindo backend (${npmScript})`);
  const child = spawn('npm', ['run', npmScript], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      APP_PORT: process.env.APP_PORT || '4000',
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=6144'].filter(Boolean).join(' '),
    },
  });

  child.on('exit', (code, signal) => {
    if (code === 0 && !signal) {
      appendDevLog('run-backend-loop', 'Backend encerrou normalmente (code 0)');
      process.exit(0);
      return;
    }
    const detail = [
      code != null ? `código ${code}` : '',
      signal ? `sinal ${signal}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    appendDevLog('run-backend-loop', `Backend saiu (${detail}) — reinício em 2s`);
    console.error(
      '[run-backend-loop] Backend saiu. Reiniciando em 2s...',
      code != null ? `(código ${code})` : '',
      signal ? `(sinal ${signal})` : ''
    );
    setTimeout(run, 2000);
  });
}

run();
