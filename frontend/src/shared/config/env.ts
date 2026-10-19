/** Acceso tipado a las variables de entorno de Vite. */
export const env = {
  /** Base de la API. En dev el proxy de Vite manda /api → backend (:8000); en Docker, nginx. */
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '/api',
} as const;
