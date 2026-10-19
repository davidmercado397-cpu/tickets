/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// En dev el proxy manda /api al backend (docker compose expone :8000)
// (mismo origen → sin CORS).

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Un solo chunk de vendors: separa node_modules del código propio (se cachea
        // entre despliegues) sin partir por librería. Partir React de sus consumidores
        // (Radix/TanStack/etc. también llaman React.forwardRef) puede dejarlos en chunks
        // distintos con orden/ciclo de carga incorrecto → "Cannot read properties of
        // undefined (reading 'forwardRef')" en producción. El code-splitting real (por
        // ruta, con React.lazy en app/routes.tsx) no tiene este riesgo y es la ganancia
        // que importa.
        manualChunks(id) {
          return id.includes('node_modules') ? 'vendor' : undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
  },
});
