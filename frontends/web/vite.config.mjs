import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import eslint from 'vite-plugin-eslint';
import tsconfigPaths from 'vite-tsconfig-paths';
import { configDefaults } from 'vitest/config';

export default defineConfig((env) => {
  const envVars = loadEnv(env.mode, process.cwd(), '')
  const host = envVars.BITBOX_DEV_BIND_HOST || '127.0.0.1'
  const port = envVars.VITE_PORT
  return {
    // Relative base path so the js/css files are referenced with `./index-...js` instead of
    // `/index-...js`. This makes it easier to find these files in iOS.
    base: './',
    resolve: {
      // Select imports before bundling so each app ships only its supported video format.
      alias: envVars.BITBOX_APP_PLATFORM === 'ios' ? {
        '@/routes/device/bitbox02/components/password-entry/videos': fileURLToPath(
          new URL('./src/routes/device/bitbox02/components/password-entry/videos-ios.ts', import.meta.url)
        ),
      } : {},
    },
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
      exclude: [
        ...configDefaults.exclude,
        'tests/**'
        ],
    },
    server: {
      host,
      port: typeof port !== 'undefined' ? port : 8080,
      strictPort: true,
    }
  };
});
