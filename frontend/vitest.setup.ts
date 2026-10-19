import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetDb } from '@/mocks/db';
import { server } from '@/mocks/server';
import '@/shared/i18n/config'; // inicializa i18n
import { useSessionStore } from '@/features/auth/model/session.store';

// --- Polyfills que jsdom no trae (Radix/sonner los usan). Cast a any: archivo de test. ---
/* eslint-disable @typescript-eslint/no-explicit-any */
const g = globalThis as any;
g.matchMedia =
  g.matchMedia ||
  ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  }));
g.ResizeObserver =
  g.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
const proto = Element.prototype as any;
proto.scrollIntoView = proto.scrollIntoView || function () {};
proto.hasPointerCapture = proto.hasPointerCapture || (() => false);
proto.releasePointerCapture = proto.releasePointerCapture || function () {};
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  useSessionStore.getState().clear();
});
afterAll(() => server.close());
