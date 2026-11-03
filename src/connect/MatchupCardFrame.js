import { useLayoutEffect, useRef, useState } from 'react';
import snapshot from './matchupCardSnapshot.json';

// The connector's own Matchup card: public/mcp-cards/matchup.html is the
// `ui://` resource statsplus-mcp serves for get_matchup (crf04/statsplus-mcp
// 59c5905), and the snapshot is the structuredContent of get_matchup(player=
// "Cade Cunningham", opponent="CHA") against the production backend, captured
// 2026-10-20, less one model directive in its footer (crf04/statsplus#147).
export const CARD_SRC = '/mcp-cards/matchup.html';

const PROTOCOL = '2026-01-26';
const INITIAL_HEIGHT = 560;

// Claude's dark host variables; the card's own fallbacks are a light theme.
const HOST_CONTEXT = {
  theme: 'dark',
  styles: {
    variables: {
      '--color-background-primary': '#1f1e1b',
      '--color-background-secondary': 'rgba(255, 255, 255, 0.05)',
      '--color-text-primary': '#f2f0e8',
      '--color-text-secondary': '#c2bfb4',
      '--color-text-tertiary': '#969389',
      '--color-border-secondary': 'rgba(222, 220, 209, 0.3)',
      '--color-border-tertiary': 'rgba(222, 220, 209, 0.14)',
      '--font-sans': "'Barlow', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
  },
};

/**
 * Plays the MCP Apps host for one display-only card: answers ui/initialize,
 * sends the tool result once the card says it is ready, and sizes the frame
 * from the card's own size reports.
 */
const MatchupCardFrame = () => {
  const frameRef = useRef(null);
  const [height, setHeight] = useState(INITIAL_HEIGHT);

  // A layout effect runs before the browser yields to the frame's first
  // script, so a cached card's one-shot ui/initialize cannot arrive before
  // the listener does.
  useLayoutEffect(() => {
    const onMessage = (event) => {
      const card = frameRef.current?.contentWindow;
      if (!card || event.source !== card) return;
      const msg = event.data;
      if (!msg || msg.jsonrpc !== '2.0') return;
      const send = (payload) => card.postMessage({ jsonrpc: '2.0', ...payload }, '*');

      if (msg.method === 'ui/initialize') {
        send({ id: msg.id, result: { protocolVersion: PROTOCOL, hostContext: HOST_CONTEXT } });
      } else if (msg.method === 'ui/notifications/initialized') {
        send({ method: 'ui/notifications/tool-result', params: { structuredContent: snapshot } });
      } else if (msg.method === 'ui/notifications/size-changed') {
        const next = Number(msg.params?.height);
        if (next > 0) setHeight(next);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      className="connect-card-frame"
      data-theme="dark"
      src={CARD_SRC}
      title="CourtAI Matchup card: Cade Cunningham against Charlotte"
      style={{ height }}
      sandbox="allow-scripts"
    />
  );
};

export default MatchupCardFrame;
