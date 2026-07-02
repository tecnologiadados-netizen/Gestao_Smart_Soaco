/**
 * Timestamps em memória para exibição no frontend (último upload e última sincronização ERP).
 * Otimizado: sem I/O, apenas variáveis.
 */
let lastUploadAt: number | null = null;
let lastSyncErpAt: number | null = null;

export function getLastUpload(): Date | null {
  return lastUploadAt != null ? new Date(lastUploadAt) : null;
}

export function getLastSyncErp(): Date | null {
  return lastSyncErpAt != null ? new Date(lastSyncErpAt) : null;
}

export function setLastUpload(): void {
  lastUploadAt = Date.now();
}

export function setLastSyncErp(): void {
  lastSyncErpAt = Date.now();
}
