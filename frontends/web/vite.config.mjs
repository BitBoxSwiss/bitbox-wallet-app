/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    plugins: [react()],
    test: {
      css: false,
      environment: 'jsdom',
      globals: true,
      setupFiles: './vite.setup-tests.mjs',
    },
  };
});
