function envFlag(name: keyof ImportMetaEnv): boolean {
  if (typeof import.meta === "undefined") return false;
  const raw = import.meta.env?.[name];
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "sim";
}

function envFlagOptional(name: keyof ImportMetaEnv): boolean | null {
  if (typeof import.meta === "undefined") return null;
  const raw = import.meta.env?.[name];
  if (raw == null || String(raw).trim() === "") return null;
  const v = String(raw).trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no" || v === "nao" || v === "não") return false;
  return v === "true" || v === "1" || v === "yes" || v === "sim";
}

function isApiUrlConfigured(): boolean {
  return Boolean(String(import.meta.env?.VITE_API_URL ?? "").trim());
}

/**
 * UI de anexo nos modais de ausência/sanção.
 * Ativo por padrão quando `VITE_API_URL` está definido (produção).
 * Use `VITE_FEATURE_LAUNCH_DOC_ATTACHMENT=false` para desligar explicitamente.
 */
export function isLaunchDocAttachmentEnabled(): boolean {
  const explicit = envFlagOptional("VITE_FEATURE_LAUNCH_DOC_ATTACHMENT");
  if (explicit !== null) return explicit;
  return isApiUrlConfigured();
}

/** Enfileira anexos localmente (IndexedDB) e não envia upload/replace ao servidor. */
export function isLaunchDocTestMode(): boolean {
  return isLaunchDocAttachmentEnabled() && envFlag("VITE_LAUNCH_DOC_TEST_MODE");
}
