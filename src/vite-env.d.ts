/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Without both of these, auth is disabled and the app runs as v1. */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
