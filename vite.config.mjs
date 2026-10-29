import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const legacyEnvironmentKeys = [
  'REACT_APP_API_BASE_URL',
  'REACT_APP_NAME',
  'REACT_APP_VERSION',
  'REACT_APP_ENVIRONMENT',
  'REACT_APP_ENABLE_ANALYTICS',
  'REACT_APP_ENABLE_ERROR_REPORTING',
  'REACT_APP_DEBUG',
  'REACT_APP_SENTRY_DSN',
  'REACT_APP_SENTRY_TRACES_SAMPLE_RATE',
  'REACT_APP_API_TIMEOUT',
  'REACT_APP_NL_QUERY_TIMEOUT',
  'REACT_APP_E2E_MODE',
  'REACT_APP_PROTOTYPE', // PROTOTYPE (throwaway)
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

const viteEnvironmentAliases = {
  REACT_APP_API_BASE_URL: 'VITE_API_BASE_URL',
  REACT_APP_NAME: 'VITE_APP_NAME',
  REACT_APP_VERSION: 'VITE_APP_VERSION',
  REACT_APP_ENVIRONMENT: 'VITE_APP_ENVIRONMENT',
  REACT_APP_ENABLE_ANALYTICS: 'VITE_ENABLE_ANALYTICS',
  REACT_APP_ENABLE_ERROR_REPORTING: 'VITE_ENABLE_ERROR_REPORTING',
  REACT_APP_DEBUG: 'VITE_DEBUG',
  REACT_APP_SENTRY_DSN: 'VITE_SENTRY_DSN',
  REACT_APP_SENTRY_TRACES_SAMPLE_RATE: 'VITE_SENTRY_TRACES_SAMPLE_RATE',
  REACT_APP_API_TIMEOUT: 'VITE_API_TIMEOUT',
  REACT_APP_NL_QUERY_TIMEOUT: 'VITE_NL_QUERY_TIMEOUT',
  REACT_APP_E2E_MODE: 'VITE_E2E_MODE',
  REACT_APP_FIREBASE_API_KEY: 'VITE_FIREBASE_API_KEY',
  REACT_APP_FIREBASE_AUTH_DOMAIN: 'VITE_FIREBASE_AUTH_DOMAIN',
  REACT_APP_FIREBASE_PROJECT_ID: 'VITE_FIREBASE_PROJECT_ID',
  REACT_APP_FIREBASE_STORAGE_BUCKET: 'VITE_FIREBASE_STORAGE_BUCKET',
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  REACT_APP_FIREBASE_APP_ID: 'VITE_FIREBASE_APP_ID',
};

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const environmentValues = Object.fromEntries(
    legacyEnvironmentKeys.map((key) => [key, env[key] ?? env[viteEnvironmentAliases[key]] ?? '']),
  );

  // Source maps are uploaded to Sentry only when a token is present at build
  // time; otherwise the plugin is never loaded and no maps are emitted.
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN);
  const sentryPlugins = uploadSourceMaps
    ? [
        (await import('@sentry/vite-plugin')).sentryVitePlugin({
          authToken: env.SENTRY_AUTH_TOKEN,
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          telemetry: false,
          sourcemaps: { filesToDeleteAfterUpload: ['build/**/*.map'] },
        }),
      ]
    : [];

  return {
    plugins: [react({ include: '**/*.{js,jsx}' }), ...sentryPlugins],
    esbuild: {
      loader: 'jsx',
      include: /\.js$/,
      exclude: /node_modules/,
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Silence deprecation warnings raised inside Bootstrap's own Sass
          // (src/bootstrap-subset.scss); warnings from src still print.
          quietDeps: true,
        },
      },
    },
    // Keep existing REACT_APP_* settings working while allowing Vite's
    // VITE_* names for new deployments. Only explicitly supported settings
    // are exposed to client code.
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      // Vercel exposes the deployed commit at build time.
      'process.env.APP_COMMIT_SHA': JSON.stringify((env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)),
      ...Object.fromEntries(
        Object.entries(environmentValues).map(([key, value]) => [
          `process.env.${key}`,
          JSON.stringify(value),
        ]),
      ),
    },
    build: {
      // Preserve the deployment output contract used by the existing Vercel project.
      outDir: 'build',
      sourcemap: uploadSourceMaps ? 'hidden' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth'],
            chartjs: ['chart.js', 'chartjs-plugin-annotation', 'react-chartjs-2'],
            ui: ['react-bootstrap', 'lucide-react', 'react-slider'],
          },
        },
      },
    },
  };
});
