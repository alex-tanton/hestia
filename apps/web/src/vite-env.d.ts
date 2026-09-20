/// <reference types="vite/client" />

/**
 * Build-time configuration. Vite exposes only `VITE_`-prefixed variables, and both of these are
 * decided when the caddy image is built (Technical Architecture, "Auth configuration"), so no
 * flag or key is fetched at runtime.
 */
interface ImportMetaEnv {
  /** "true" builds the magic-link and code-entry screens in; anything else omits them. */
  readonly VITE_MAGIC_LINK_ENABLED?: string;
  /** The Supabase anon key, which Kong requires on every `/auth/v1` call. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The app version Settings › About shows, replaced at build time from package.json. */
declare const __APP_VERSION__: string;
