import { act, render, screen } from '@testing-library/react';
import MatchupCardFrame from './MatchupCardFrame';

// The card posts JSON-RPC to its parent; the page must answer as an MCP Apps host.
const fromCard = (frame, data) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, data }));
  });

const renderFrame = () => {
  render(<MatchupCardFrame />);
  const frame = screen.getByTitle('CourtAI Matchup card: Cade Cunningham against Charlotte');
  const sent = [];
  frame.contentWindow.postMessage = (message) => sent.push(message);
  return { frame, sent };
};

test('answers the handshake with a dark host, then sends the captured Matchup', () => {
  const { frame, sent } = renderFrame();

  fromCard(frame, { jsonrpc: '2.0', id: 7, method: 'ui/initialize', params: {} });
  expect(sent).toHaveLength(1);
  expect(sent[0].id).toBe(7);
  expect(sent[0].result.protocolVersion).toBe('2026-01-26');
  expect(sent[0].result.hostContext.theme).toBe('dark');
  expect(sent[0].result.hostContext.styles.variables['--color-text-primary']).toBe('#f2f0e8');

  fromCard(frame, { jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} });
  expect(sent).toHaveLength(2);
  expect(sent[1].method).toBe('ui/notifications/tool-result');
  const card = sent[1].params.structuredContent;
  expect(card.player.name).toBe('Cade Cunningham');
  expect(card.mode).toBe('unscheduled');
  expect(card.data_as_of.join(' ')).not.toMatch(/State this once/);
});

test('takes its height from the card and ignores other windows', () => {
  const { frame, sent } = renderFrame();
  expect(frame).toHaveStyle({ height: '560px' });

  fromCard(frame, {
    jsonrpc: '2.0',
    method: 'ui/notifications/size-changed',
    params: { height: 1264 },
  });
  expect(frame).toHaveStyle({ height: '1264px' });

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { jsonrpc: '2.0', id: 1, method: 'ui/initialize' },
      }),
    );
  });
  expect(sent).toHaveLength(0);
});
