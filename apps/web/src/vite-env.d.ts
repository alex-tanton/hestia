/// <reference types="vite/client" />

/**
 * Build-time configuration. Vite exposes `HESTIA_PUBLIC_` and legacy `VITE_`-prefixed variables.
 * Decided when the caddy image is built, so no flag or key is fetched at runtime.
 */
interface ImportMetaEnv {
  /** "true" builds the magic-link and code-entry screens in; anything else omits them. */
  readonly HESTIA_PUBLIC_MAGIC_LINK_ENABLED?: string;
  /** The Supabase anon key, which Kong requires on every `/auth/v1` call. */
  readonly HESTIA_PUBLIC_SUPABASE_ANON_KEY?: string;
  /**
   * The VAPID public key a device subscribes with. Public by design; the private half stays on the
   * server. Absent in a build without push, where the notification settings say push is unavailable.
   */
  readonly HESTIA_PUBLIC_VAPID_KEY?: string;

  // Legacy fallbacks:
  readonly VITE_MAGIC_LINK_ENABLED?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The app version Settings › About shows, replaced at build time from package.json. */
declare const __APP_VERSION__: string;
