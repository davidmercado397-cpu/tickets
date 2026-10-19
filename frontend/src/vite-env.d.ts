/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_MODE: 'rest' | 'mock';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Paquetes de fuentes (solo CSS, sin tipos propios).
declare module '@fontsource-variable/inter';
