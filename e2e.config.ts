import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { chatgpt } from 'e2e/oauth/chatgpt';

const app = {
  url: 'http://127.0.0.1:0',
  command: {
    executable: 'npm',
    args: ['start', '--', '--host', '127.0.0.1', '--port', '{port}', '--strictPort'],
    env: { REACT_APP_E2E_MODE: 'true' },
    startupTimeout: 120_000,
  },
};

export default {
  tests: ['e2e/flows/**/*.e2e.ts'],
  workers: 2,
  assertionTimeout: 10_000,
  reporters: ['list', 'junit', 'markdown'],
  trace: 'retain-on-failure',
  cache: { dir: 'e2e/replay-cache' },
  agents: {
    default: {
      model: chatgpt('gpt-6-luna'),
      system: 'You are a thorough QA agent. Verify every outcome.',
    },
  },
  targets: [
    {
      name: 'desktop',
      engine: web({ viewport: { width: 1440, height: 900 } }),
      app: { ...app, command: { ...app.command, log: '.e2e/logs/desktop.log' } },
    },
    {
      name: 'phone',
      engine: web({ viewport: { width: 390, height: 844 } }),
      app: { ...app, command: { ...app.command, log: '.e2e/logs/phone.log' } },
    },
  ],
} satisfies E2EConfig;
