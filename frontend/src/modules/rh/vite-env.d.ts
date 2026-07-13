/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Anexo obrigatório no lançamento de ausências/sanções. */
  readonly VITE_FEATURE_LAUNCH_DOC_ATTACHMENT?: string;
  /** Modo teste: fila local (IndexedDB), sem upload/replace em produção. */
  readonly VITE_LAUNCH_DOC_TEST_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
