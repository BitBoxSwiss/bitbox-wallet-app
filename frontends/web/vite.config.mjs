import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import checker from 'vite-plugin-checker';

export default defineConfig(() => {
  return {
    // Relative base path so the js/css files are referenced with `./index-...js` instead of
    // `/index-...js`. This makes it easier to find these files in iOS.
    base: './',
    build: {
      modulePreload: false,
      outDir: 'build',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
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
