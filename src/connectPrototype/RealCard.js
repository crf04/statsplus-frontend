// PROTOTYPE (throwaway): the connector's real Matchup card, as served by
// statsplus-mcp (cards/matchup.html with shared CSS and bridge inlined), fed
// the structuredContent of a live production call:
// get_matchup(player="Cade Cunningham", opponent="CHA"), captured 2026-10-13.
// This component plays the MCP Apps host: it answers ui/initialize, sends the
// tool result and sizes the iframe from the card's size reports.
import { useEffect, useRef, useState } from 'react';
import structuredContent from './matchupCard.json';

const PROTOCOL = '2026-01-26';

const HOST_CONTEXT = {
  theme: 'dark',
  styles: {
    variables: {
      // Claude's dark-theme host variables; the card's own fallbacks are light.
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

const RealCard = ({ title = 'CourtAI Matchup card for Cade Cunningham against Charlotte' }) => {
  const frameRef = useRef(null);
  const [height, setHeight] = useState(560);

  useEffect(() => {
    const onMessage = (event) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const msg = event.data;
      if (!msg || msg.jsonrpc !== '2.0') return;
      const reply = (payload) =>
        frame.contentWindow.postMessage({ jsonrpc: '2.0', ...payload }, '*');

      if (msg.method === 'ui/initialize') {
        reply({ id: msg.id, result: { protocolVersion: PROTOCOL, hostContext: HOST_CONTEXT } });
      } else if (msg.method === 'ui/notifications/initialized') {
        reply({ method: 'ui/notifications/tool-result', params: { structuredContent } });
      } else if (msg.method === 'ui/notifications/size-changed') {
        setHeight(msg.params?.height || 560);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      className="cp-realcard"
      src="/connect-proto/matchup-card.html"
      title={title}
      style={{ height }}
      sandbox="allow-scripts"
    />
  );
};

export default RealCard;
