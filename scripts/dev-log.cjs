/**
 * Log append-only de eventos da stack dev (reinícios, kill-ports, trava).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const LOG_FILE = path.join(root, '.dev-restart.log');

function appendDevLog(tag, message, extra) {
  const line = `[${new Date().toISOString()}] [${tag}] ${message}${extra ? ` ${extra}` : ''}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch {
    /* ignore */
  }
  return line.trim();
}

module.exports = { appendDevLog, LOG_FILE };
