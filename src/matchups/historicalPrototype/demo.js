/*
 * PROTOTYPE — throwaway. Which captured game the standalone build serves, and
 * the SAMPLE lines for the upcoming twin (see mock/make_upcoming.py).
 */
import sampleLines from './mock/sample-lines.json';

export const DEMOS = [
  ['', 'completed'],
  ['upcoming', 'upcoming · with lines'],
  ['upcoming-bare', 'upcoming · today’s contract (no line numbers)'],
];

export const demoMode = () =>
  typeof window === 'undefined'
    ? ''
    : new URLSearchParams(window.location.search).get('demo') || '';

// Null when the contract has no line numbers (today) or the market is not posted.
export const lineFor = (player, market) =>
  demoMode() === 'upcoming' ? (sampleLines[String(player.id)]?.[market] ?? null) : null;
