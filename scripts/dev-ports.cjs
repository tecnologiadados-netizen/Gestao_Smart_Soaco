/**
 * Portas padrão do stack dev (uma API + um Vite).
 * Sobrescreva com DEV_BACKEND_PORT / DEV_FRONTEND_PORT no ambiente, se necessário.
 */
const BACKEND_PORT = Number(process.env.DEV_BACKEND_PORT) || 4000;
const FRONTEND_PORT = Number(process.env.DEV_FRONTEND_PORT) || 5180;

/** Portas que o `npm run dev` sobe e monitora. */
const DEV_PORTS = [BACKEND_PORT, FRONTEND_PORT];

/** Portas antigas (vários Vites) — liberadas no `dev:stop` para evitar conflito. */
const LEGACY_FRONTEND_PORTS = [5173, 5174, 5051];

const KILL_PORTS = [...new Set([...DEV_PORTS, ...LEGACY_FRONTEND_PORTS])];

module.exports = {
  BACKEND_PORT,
  FRONTEND_PORT,
  DEV_PORTS,
  LEGACY_FRONTEND_PORTS,
  KILL_PORTS,
};
