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
  'REACT_APP_API_TIMEOUT',
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
  REACT_APP_API_TIMEOUT: 'VITE_API_TIMEOUT',
  REACT_APP_FIREBASE_API_KEY: 'VITE_FIREBASE_API_KEY',
  REACT_APP_FIREBASE_AUTH_DOMAIN: 'VITE_FIREBASE_AUTH_DOMAIN',
  REACT_APP_FIREBASE_PROJECT_ID: 'VITE_FIREBASE_PROJECT_ID',
  REACT_APP_FIREBASE_STORAGE_BUCKET: 'VITE_FIREBASE_STORAGE_BUCKET',
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  REACT_APP_FIREBASE_APP_ID: 'VITE_FIREBASE_APP_ID',
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const environmentValues = Object.fromEntries(
    legacyEnvironmentKeys.map((key) => [key, env[key] ?? env[viteEnvironmentAliases[key]] ?? '']),
  );

  return {
    plugins: [react({ include: '**/*.{js,jsx}' })],
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
    // Keep existing REACT_APP_* settings working while allowing Vite's
    // VITE_* names for new deployments. Only explicitly supported settings
    // are exposed to client code.
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
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
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth'],
            chartjs: ['chart.js', 'chartjs-plugin-annotation', 'react-chartjs-2'],
            recharts: ['recharts'],
            ui: ['react-bootstrap', 'lucide-react', 'react-slider'],
          },
        },
      },
    },
  };
});
