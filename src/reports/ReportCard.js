import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../theme/useTheme';

/*
 * The connector's host theme for each app theme, so a card matches the page
 * around it (crf04/statsplus#372). Dark is Claude's dark host, as on Connect;
 * light is Chalk's text, rules and tint (src/theme.css [data-theme='light']).
 */
const HOST_VARIABLES = {
  dark: {
    '--color-text-primary': '#faf9f5',
    '--color-text-secondary': '#c2c0b6',
    '--color-text-tertiary': '#9c9a92',
    '--color-border-tertiary': 'rgba(222,220,209,0.15)',
    '--color-border-secondary': 'rgba(222,220,209,0.3)',
    '--color-background-secondary': '#3a3a37',
    '--font-sans': 'ui-sans-serif, system-ui, sans-serif',
  },
  light: {
    '--color-text-primary': '#15181d',
    '--color-text-secondary': '#3b414a',
    '--color-text-tertiary': '#5f6670',
    '--color-border-tertiary': 'rgba(21,24,29,0.108)',
    '--color-border-secondary': 'rgba(21,24,29,0.216)',
    '--color-background-secondary': '#eef0f3',
    '--font-sans': 'ui-sans-serif, system-ui, sans-serif',
  },
};

export const hostContext = (theme) => ({ theme, styles: { variables: HOST_VARIABLES[theme] } });

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
 * The Log Workspace a game-log card was drawn from, on this site
 * (crf04/statsplus#394). Only a link to the Log Workspace counts: the stored
 * result is the publisher's, so nothing else it names is followed.
 */
export const liveLink = (call) => {
  if (call.tool !== 'query_game_logs' || typeof call.structured?.url !== 'string') return null;
  try {
    const url = new URL(call.structured.url);
    return /^https?:$/.test(url.protocol) && url.pathname === '/' && url.search
      ? `/${url.search}`
      : null;
  } catch {
    return null;
  }
};

/*
 * One stored card: the card HTML the report was published with, fed the
 * stored tool result over the MCP Apps host messages, in a sandbox with no
 * same-origin access.
 */
const ReportCard = ({ html, call, label }) => {
  const { resolved: theme } = useTheme();
  const frameRef = useRef(null);
  const themeRef = useRef(theme);
  const initialized = useRef(false);
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
          result: { protocolVersion: '2026-01-26', hostContext: hostContext(themeRef.current) },
        });
      } else if (message.method === 'ui/notifications/initialized') {
        initialized.current = true;
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

  // A theme switch repaints a card already drawn, as Claude's host does.
  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    const frame = frameRef.current;
    if (!initialized.current || !frame?.contentWindow) return;
    frame.contentWindow.postMessage(
      {
        jsonrpc: '2.0',
        method: 'ui/notifications/host-context-changed',
        params: hostContext(theme),
      },
      '*',
    );
  }, [theme]);

  const scale = fitScale(height, view);
  const live = liveLink(call);
  return (
    <>
      <div
        className="report-card-fit"
        data-theme={theme}
        style={{ height: Math.ceil(height * scale), colorScheme: theme }}
      >
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
      {live && (
        <Link className="report-card-live" to={live}>
          Open live game logs <span aria-hidden="true">→</span>
        </Link>
      )}
    </>
  );
};

export default ReportCard;
