import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import eslint from 'vite-plugin-eslint';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig((env) => {
  const envVars = loadEnv(env.mode, process.cwd(), '')
  const port = envVars.VITE_PORT
  return {
    // Relative base path so the js/css files are referenced with `./index-...js` instead of
    // `/index-...js`. This makes it easier to find these files in iOS.
    base: './',
    build: {
      modulePreload: false,
      outDir: 'build',
      target: ['chrome122'],
    },
    plugins: [
      react(),
      checker({
        typescript: true,
      }),
      tsconfigPaths(),
      env.mode !== 'test' && eslint(),
    ],
    test: {
      css: false,
      environment: 'jsdom',
      globals: true,
      pool: 'forks',
      setupFiles: './vite.setup-tests.mjs',
    },
    server: {
      port: typeof port !== 'undefined' ? port : 8080,
      strictPort: true,
    }
  };
});
