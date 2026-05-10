/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-only: see `.env.development` — ignored in production builds. */
  readonly VITE_DEV_VISIBLE_CHAPTERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
