/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    // https://github.com/vitejs/vite/issues/1973#issuecomment-787571499
    // define: {
    //   'process.env': {},
    // },
    build: {
      outDir: 'build',
    },
    plugins: [react()],
    test: {
      css: true, // TODO: needed?
      environment: 'jsdom',
      globals: true,
      setupFiles: './vite.setup-tests.js',
    },
  };
});
