import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// The app is dark, so cards get the connector's dark host theme (as on Connect).
const HOST_CONTEXT = {
  theme: 'dark',
  styles: {
    variables: {
      '--color-text-primary': '#faf9f5',
      '--color-text-secondary': '#c2c0b6',
      '--color-text-tertiary': '#9c9a92',
      '--color-border-tertiary': 'rgba(222,220,209,0.15)',
      '--color-border-secondary': 'rgba(222,220,209,0.3)',
      '--color-background-secondary': '#3a3a37',
      '--font-sans': 'ui-sans-serif, system-ui, sans-serif',
    },
  },
};
const START_HEIGHT = 160;
const MIN_SCALE = 0.7;
const WIDE = 900;
// Room a card may take: the window less the sticky tab bar and a margin.
const ROOM_MARGIN = 120;

/*
 * A card scaled down so it fits the window on wide screens (never below 70%);
 * phones keep it full size so its text stays readable.
 */
export const fitScale = (height, { innerWidth, innerHeight }) => {
  const room = innerHeight - ROOM_MARGIN;
  return innerWidth >= WIDE && height > room ? Math.max(MIN_SCALE, room / height) : 1;
};

/*
 * One stored card: the card HTML the report was published with, fed the
 * stored tool result over the MCP Apps host messages, in a sandbox with no
 * same-origin access.
 */
const ReportCard = ({ html, call, label }) => {
  const frameRef = useRef(null);
  const [height, setHeight] = useState(START_HEIGHT);
  const [view, setView] = useState(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () =>
      setView({ innerWidth: window.innerWidth, innerHeight: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Listen before the card's first script runs.
  useLayoutEffect(() => {
    const onMessage = (event) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const message = event.data;
      if (!message || message.jsonrpc !== '2.0') return;
      const reply = (payload) =>
        frame.contentWindow.postMessage({ jsonrpc: '2.0', ...payload }, '*');
      if (message.method === 'ui/initialize') {
        reply({
          id: message.id,
          result: { protocolVersion: '2026-01-26', hostContext: HOST_CONTEXT },
        });
      } else if (message.method === 'ui/notifications/initialized') {
        reply({
          method: 'ui/notifications/tool-result',
          params: { structuredContent: call.structured, _meta: call.meta || undefined },
        });
      } else if (message.method === 'ui/notifications/size-changed') {
        const next = Number(message.params?.height);
        if (Number.isFinite(next) && next > 0) setHeight(next);
      } else if (message.id !== undefined && message.method) {
        reply({ id: message.id, result: {} });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [call]);

  const scale = fitScale(height, view);
  return (
    <div className="report-card-fit" style={{ height: Math.ceil(height * scale) }}>
      <iframe
        ref={frameRef}
        className="report-card"
        title={label}
        sandbox="allow-scripts"
        srcDoc={html}
        style={{
          height,
          width: `${100 / scale}%`,
          transform: scale < 1 ? `scale(${scale})` : undefined,
        }}
      />
    </div>
  );
};

export default ReportCard;
