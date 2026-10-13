import process from 'node:process';
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { chatgpt } from 'e2e/oauth/chatgpt';
import base from './e2e.config.ts';
import { auditNetwork } from './e2e/bridge/network-audit.ts';

const context =
  'Use only the local fixture app; never follow external links or connect real accounts. ' +
  'Reader and administrator sessions are disposable simulated identities. ' +
  'Games: 0022500584 (Jan 15, 2026 live LAL/BOS) and 0022501082 (Mar 29, 2026 historical LAC/MIL). ' +
  'Saved Filter Sets and Targets start empty and persist in memory for this session, including reloads. ' +
  'Operations jobs are simulated and never affect production. Reference responses are small fixed fixtures, not live NBA data. ' +
  'Google simulates auth; do not sign in again. Phone is width-only, not touch. ' +
  'Judge split accessible text on screen; scroll and wait for lazy content. ' +
  'Intended, not findings: signed-out Search, Matchups and Targets are disabled or gated with ' +
  'no back control (navigation stays usable); /help example links prefill Search; ' +
  'explore has no clipboard permission, so Copy never shows Copied. ' +
  'The query parser is a fixed stub: every typed query returns LeBron James, last 10 games, so ' +
  'judge what the app does with that answer, not whether it matches the text typed. ' +
  'Also intended: a reopened Matchup card starts on its default stat; a Target note is free text ' +
  'that threshold edits leave unchanged; Operator job rows show no submitted reason.';
const persona = { model: chatgpt('gpt-6-luna'), maxSteps: 40, maxModelCalls: 40, context };

export default {
  ...base,
  tests: [...base.tests, 'tests/bugbash/**/*.e2e.ts'],
  retries: 0,
  reporters: ['list', 'markdown'],
  agents: {
    default: { ...persona, system: 'Walk the named area as a first-time visitor.' },
    skeptic: {
      ...persona,
      system: 'Cross-check every visible label, count, and navigation claim.',
    },
    fuzzer: {
      ...persona,
      system: 'Try each input in the charter matrix and judge its result before the next.',
    },
  },
  targets: [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'phone', width: 390, height: 844 },
  ].map(({ name, width, height }) => ({
    name,
    engine: web({
      viewport: { width, height },
      timezoneId: 'Asia/Tokyo',
      initScripts: [auditNetwork],
    }),
    app: {
      url: 'http://127.0.0.1:0',
      command: {
        executable: 'node',
        args: ['e2e/bridge/server.mjs', '{port}'],
        log: process.env.E2E_BRIDGE_LOG ?? `.e2e/logs/bugbash-${name}.log`,
        startupTimeout: 120_000,
      },
    },
  })),
} satisfies E2EConfig;
