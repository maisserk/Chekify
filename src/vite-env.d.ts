/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_METEORED_API_KEY: string;
  readonly VITE_METEORED_LOCATION_HASH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
