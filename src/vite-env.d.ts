/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Без этих двух auth выключен и приложение работает как v1. */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
