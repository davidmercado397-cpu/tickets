/** Acceso tipado a las variables de entorno de Vite. Punto único de lectura. */
export const env = {
  /** Base de la API. En dev el proxy manda /api → backend real (:8001). */
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  /** "rest" = backend real vía fetch; "mock" = MSW arranca e intercepta. */
  API_MODE: (import.meta.env.VITE_API_MODE ?? 'rest') as 'rest' | 'mock',
} as const;
