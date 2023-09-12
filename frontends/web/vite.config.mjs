import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import checker from 'vite-plugin-checker';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    plugins: [
      react(),
      eslint(),
      checker({
        typescript: true,
      }),
    ],
    test: {
      css: false,
      environment: 'jsdom',
      globals: true,
      setupFiles: './vite.setup-tests.mjs',
    },
  };
});
